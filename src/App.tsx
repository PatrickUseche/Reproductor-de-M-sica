import type { Session } from '@supabase/supabase-js';
import { useEffect, useRef, useState } from 'react';
import { AccountAccess } from './components/AccountAccess';
import { PlayerControls } from './components/PlayerControls';
import { PlaylistView } from './components/PlaylistView';
import { SongForm } from './components/SongForm';
import { YouTubeSearch } from './components/YouTubeSearch';
import { SongPlaylist } from './core/SongPlaylist';
import {
    deserializePlaylist,
    loadPlaylist,
    savePlaylist,
    serializePlaylist,
    subscribeToPlaylist,
    type PlaylistSnapshot,
} from './services/playlistPersistence';
import { deleteLocalAudio, loadLocalAudio, saveLocalAudio } from './services/localAudioPersistence';
import { supabase } from './services/supabase';
import type { YouTubeVideo } from './services/youtube';
import { Song } from './types/Song';

function snapshotsMatch(left: PlaylistSnapshot, right: PlaylistSnapshot) {
  return left.currentSongId === right.currentSongId
    && left.songs.length === right.songs.length
    && left.songs.every((song, index) => {
      const other = right.songs[index];
      return song.id === other.id
        && song.title === other.title
        && song.artist === other.artist
        && song.duration === other.duration
        && song.audioUrl === other.audioUrl
        && song.source === other.source;
    });
}

function restorePlaylist(playlist: SongPlaylist, snapshot: PlaylistSnapshot) {
  playlist.replaceAll(deserializePlaylist(snapshot), snapshot.currentSongId);
}

function restoreRemotePlaylist(playlist: SongPlaylist, snapshot: PlaylistSnapshot) {
  const localSongs = playlist.toArray()
    .map((node) => node.content)
    .filter((song) => song.getAudioUrl().startsWith('blob:'));
  const currentSong = playlist.getCurrent()?.content;
  const currentLocalSongId = currentSong?.getAudioUrl().startsWith('blob:')
    ? currentSong.getId()
    : null;

  playlist.replaceAll(
    [...deserializePlaylist(snapshot), ...localSongs],
    currentLocalSongId ?? snapshot.currentSongId,
  );
}

/**
 * Ensambla la interfaz y coordina las acciones sobre la playlist mutable.
 * `refresh` sincroniza React después de que una operación cambia los nodos.
 */
export default function App() {
  const [playlist] = useState<SongPlaylist>(() => new SongPlaylist());
  const [version, setVersion] = useState(0);
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(Boolean(supabase));
  const [loadedUserId, setLoadedUserId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState('');
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [playlistDirty, setPlaylistDirty] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [realtimeStatus, setRealtimeStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const [syncError, setSyncError] = useState('');
  const [localAudioError, setLocalAudioError] = useState('');
  const saveQueue = useRef<Promise<void>>(Promise.resolve());
  const saveRevision = useRef(0);
  const playlistDirtyRef = useRef(false);
  const syncStatusRef = useRef(syncStatus);
  const refresh = () => {
    playlistDirtyRef.current = true;
    setVersion((currentVersion) => currentVersion + 1);
    setPlaylistDirty(true);
    setSyncError('');
  };

  useEffect(() => {
    playlistDirtyRef.current = playlistDirty;
    syncStatusRef.current = syncStatus;
  }, [playlistDirty, syncStatus]);

  useEffect(() => {
    if (session) return;

    for (const node of playlist.toArray()) {
      const audioUrl = node.content.getAudioUrl();
      if (audioUrl.startsWith('blob:')) URL.revokeObjectURL(audioUrl);
    }
    playlist.replaceAll([]);
  }, [playlist, session]);

  useEffect(() => {
    if (!supabase) return;

    let active = true;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      const nextUserId = nextSession?.user.id ?? null;
      if (sessionUserId.current !== nextUserId) {
        setLoadedUserId(null);
        setLoadError('');
        playlistDirtyRef.current = false;
        setPlaylistDirty(false);
        setRealtimeStatus('connecting');
      }
      sessionUserId.current = nextUserId;
      setSession(nextSession);
    });

    void supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      if (error) setLoadError(error.message);
      sessionUserId.current = data.session?.user.id ?? null;
      setSession(data.session);
      setAuthLoading(false);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const sessionUserId = useRef<string | null>(null);
  const userId = session?.user.id;

  useEffect(() => {
    if (!userId) return;

    let active = true;
    let loadedLocalSongs: Song[] = [];
    for (const node of playlist.toArray()) {
      const audioUrl = node.content.getAudioUrl();
      if (audioUrl.startsWith('blob:')) URL.revokeObjectURL(audioUrl);
    }
    playlist.replaceAll([]);

    void (async () => {
      const snapshot = await loadPlaylist(userId);
      loadedLocalSongs = await loadLocalAudio(userId);
      if (!active) {
        loadedLocalSongs.forEach((song) => URL.revokeObjectURL(song.getAudioUrl()));
        return;
      }
      restorePlaylist(playlist, snapshot ?? { songs: [], currentSongId: null });
      for (const song of loadedLocalSongs) playlist.insertAtEnd(song);
      setLoadedUserId(userId);
      setSyncStatus('saved');
      setLocalAudioError('');
    })().catch((error: unknown) => {
      loadedLocalSongs.forEach((song) => URL.revokeObjectURL(song.getAudioUrl()));
      if (!active) return;
      setLoadError(error instanceof Error ? error.message : 'No se pudo cargar la playlist.');
      setSyncStatus('error');
    });

    return () => {
      active = false;
      loadedLocalSongs.forEach((song) => URL.revokeObjectURL(song.getAudioUrl()));
    };
  }, [userId, loadAttempt, playlist]);

  useEffect(() => {
    if (!userId || loadedUserId !== userId) return;

    const channel = subscribeToPlaylist(userId, (snapshot) => {
      const currentSnapshot = serializePlaylist(
        playlist.toArray().map((node) => node.content),
        playlist.getCurrent()?.content.getId() ?? null,
      );
      if (snapshotsMatch(currentSnapshot, snapshot) || playlistDirtyRef.current || syncStatusRef.current === 'saving') return;

      restoreRemotePlaylist(playlist, snapshot);
      setVersion((currentVersion) => currentVersion + 1);
      setSyncStatus('saved');
      setSyncError('');
    }, (status) => {
      if (status === 'SUBSCRIBED') {
        setRealtimeStatus('connected');
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        setRealtimeStatus('disconnected');
      }
    });

    return () => {
      void supabase?.removeChannel(channel);
    };
  }, [loadedUserId, playlist, userId]);

  useEffect(() => {
    const userId = session?.user.id;
    if (!userId || loadedUserId !== userId || !playlistDirty) return;

    const revision = ++saveRevision.current;
    const snapshot = serializePlaylist(
      playlist.toArray().map((node) => node.content),
      playlist.getCurrent()?.content.getId() ?? null,
    );

    const timeout = window.setTimeout(() => {
      setSyncStatus('saving');
      const saveOperation = saveQueue.current
        .catch(() => undefined)
        .then(() => savePlaylist(userId, snapshot));
      saveQueue.current = saveOperation;

      void saveOperation.then(() => {
        if (revision !== saveRevision.current) return;
        playlistDirtyRef.current = false;
        setPlaylistDirty(false);
        setSyncStatus('saved');
        setSyncError('');
      }).catch((error: unknown) => {
        if (revision !== saveRevision.current) return;
        setPlaylistDirty(false);
        setSyncStatus('error');
        setSyncError(error instanceof Error ? error.message : 'No se pudo guardar la playlist.');
      });
    }, 400);

    return () => window.clearTimeout(timeout);
  }, [loadedUserId, playlist, playlistDirty, session?.user.id, version]);

  if (!supabase) {
    return (
      <main className="app-shell">
        <header className="app-header">
          <p className="eyebrow">TU ESPACIO DE AUDIO</p>
          <h1>Reproductor de Música</h1>
        </header>
        <section className="loading-panel" role="alert">
          <h2>Falta configurar la sincronización</h2>
          <p>Añade VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en las variables de entorno del despliegue y vuelve a publicar la aplicación.</p>
        </section>
      </main>
    );
  }

  if (authLoading) {
    return <main className="app-shell"><section className="loading-panel"><p>Comprobando tu cuenta…</p></section></main>;
  }

  if (!session) {
    return (
      <main className="app-shell">
        <header className="app-header">
          <p className="eyebrow">TU ESPACIO DE AUDIO</p>
          <h1>Reproductor de Música</h1>
          <p className="app-description">Inicia sesión para acceder a tu playlist personal.</p>
        </header>
        <AccountAccess client={supabase} />
      </main>
    );
  }

  if (loadedUserId !== session.user.id) {
    return (
      <main className="app-shell">
        <section className="loading-panel" aria-live="polite">
          {loadError ? (
            <>
              <h2>No se pudo cargar tu playlist</h2>
              <p>{loadError}</p>
              <button className="primary-button" type="button" onClick={() => { setLoadError(''); setLoadAttempt((attempt) => attempt + 1); }}>Reintentar</button>
            </>
          ) : <p>Cargando tu playlist…</p>}
        </section>
      </main>
    );
  }

  /** Selecciona un nodo existente y actualiza el reproductor y la vista. */
  const handleSelectSong = (node: Parameters<SongPlaylist['setCurrentNode']>[0]) => {
    playlist.setCurrentNode(node);
    refresh();
  };

  /** Convierte un resultado de YouTube al modelo de canción y lo agrega al final. */
  const handleAddYouTubeSong = (video: YouTubeVideo) => {
    const song = new Song(
      crypto.randomUUID(),
      video.snippet.title,
      video.snippet.channelTitle,
      0,
      video.id.videoId,
      'youtube',
    );
    playlist.insertAtEnd(song);
    refresh();
  };

  const handlePlayYouTubeSong = (video: YouTubeVideo) => {
    const existingNode = playlist.toArray().find((node) =>
      node.content.getSource() === 'youtube'
      && node.content.getAudioUrl() === video.id.videoId,
    );

    if (existingNode) {
      playlist.setCurrentNode(existingNode);
    } else {
      const song = new Song(
        crypto.randomUUID(),
        video.snippet.title,
        video.snippet.channelTitle,
        0,
        video.id.videoId,
        'youtube',
      );
      playlist.insertAtEnd(song);
      playlist.setCurrentNode(playlist.getTail());
    }

    refresh();
  };

  return (
    <main className="app-shell">
      <header className="app-header">
        <div className="app-header-content">
          <div>
            <p className="eyebrow">TU ESPACIO DE AUDIO</p>
            <h1>Reproductor de Música</h1>
            <p className="app-description">Organiza tu lista y elige qué escuchar.</p>
          </div>
          <div className="account-actions">
            <div>
              <p>{session.user.email}</p>
              <p className={syncStatus === 'error' ? 'sync-error' : 'sync-status'}>
                {syncStatus === 'saving'
                  ? 'Guardando cambios…'
                  : syncStatus === 'error'
                    ? 'Error de sincronización'
                    : realtimeStatus === 'connected'
                      ? 'Sincronizada en vivo'
                      : realtimeStatus === 'disconnected'
                        ? 'Guardada; sincronización en vivo desconectada'
                        : 'Playlist sincronizada'}
              </p>
              {syncError && <p className="sync-error" role="alert">{syncError}</p>}
            </div>
            {syncStatus === 'error' && (
              <button className="secondary-button" type="button" onClick={() => setPlaylistDirty(true)}>Reintentar guardado</button>
            )}
            <button className="secondary-button" type="button" onClick={() => { void supabase?.auth.signOut(); }}>Cerrar sesión</button>
          </div>
        </div>
      </header>

      <section className="listening-layout" aria-label="Reproductor y lista de reproducción">
        <PlayerControls
          currentTrack={playlist.getCurrent()}
          onNext={(repeatPlaylist = false) => {
            const currentTrack = playlist.getCurrent();
            if (!currentTrack) return false;
            if (currentTrack === playlist.getTail()) {
              const head = playlist.getHead();
              if (!repeatPlaylist || !head || head === currentTrack) return false;
              playlist.setCurrentNode(head);
              refresh();
              return true;
            }
            playlist.playNext();
            refresh();
            return true;
          }}
          onPrevious={() => { playlist.playPrevious(); refresh(); }}
        />

        <PlaylistView
          nodes={playlist.toArray()}
          headNode={playlist.getHead()}
          tailNode={playlist.getTail()}
          currentNode={playlist.getCurrent()}
          onSelectSong={handleSelectSong}
          onDeleteSong={(position) => {
            const song = playlist.toArray()[position]?.content;
            if (!song) return;

            const audioUrl = song.getAudioUrl();
            const finishDeletion = () => {
              const currentPosition = playlist.toArray()
                .findIndex((node) => node.content.getId() === song.getId());
              if (currentPosition < 0 || !playlist.deleteAtPosition(currentPosition)) return;
              if (audioUrl.startsWith('blob:')) URL.revokeObjectURL(audioUrl);
              refresh();
            };

            if (audioUrl.startsWith('blob:')) {
              void deleteLocalAudio(session.user.id, song.getId()).then(() => {
                setLocalAudioError('');
                finishDeletion();
              }).catch((error: unknown) => {
                setLocalAudioError(error instanceof Error ? error.message : 'No se pudo eliminar el archivo local.');
              });
            } else {
              finishDeletion();
            }
          }}
          onMoveSong={(position, direction) => {
            if (playlist.moveAtPosition(position, direction)) refresh();
          }}
        />
      </section>

      <section className="library-tools" aria-label="Administrar música">
        <SongForm
          onAddFiles={async (files) => {
            const songs = await Promise.all(files.map(async (file) => {
              const audioUrl = URL.createObjectURL(file);
              const audio = new Audio();
              audio.preload = 'metadata';
              const duration = await new Promise<number>((resolve) => {
                const finish = (value: number) => {
                  audio.onloadedmetadata = null;
                  audio.onerror = null;
                  audio.removeAttribute('src');
                  audio.load();
                  resolve(Number.isFinite(value) ? Math.round(value) : 0);
                };
                audio.onloadedmetadata = () => finish(audio.duration);
                audio.onerror = () => finish(0);
                audio.src = audioUrl;
              });
              const title = file.name.replace(/\.[^.]+$/, '') || file.name;
              return new Song(crypto.randomUUID(), title, 'Archivo local', duration, audioUrl);
            }));

            try {
              await saveLocalAudio(session.user.id, songs.map((song, index) => ({
                song,
                file: files[index],
              })));
            } catch (error) {
              songs.forEach((song) => URL.revokeObjectURL(song.getAudioUrl()));
              throw error;
            }

            songs.forEach((song) => playlist.insertAtEnd(song));
            setLocalAudioError('');
            refresh();
          }}
        />

        <YouTubeSearch onAddSong={handleAddYouTubeSong} onPlaySong={handlePlayYouTubeSong} />
      </section>
      {localAudioError && <p className="form-error" role="alert">{localAudioError}</p>}
    </main>
  );
}