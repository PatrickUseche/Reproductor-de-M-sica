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
    playlist.replaceAll([]);

    void loadPlaylist(userId).then((snapshot) => {
      if (!active) return;
      restorePlaylist(playlist, snapshot ?? { songs: [], currentSongId: null });
      setLoadedUserId(userId);
      setSyncStatus('saved');
    }).catch((error: unknown) => {
      if (!active) return;
      setLoadError(error instanceof Error ? error.message : 'No se pudo cargar la playlist.');
      setSyncStatus('error');
    });

    return () => {
      active = false;
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

      restorePlaylist(playlist, snapshot);
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
          onNext={() => { playlist.playNext(); refresh(); }}
          onPrevious={() => { playlist.playPrevious(); refresh(); }}
        />

        <PlaylistView
          nodes={playlist.toArray()}
          headNode={playlist.getHead()}
          tailNode={playlist.getTail()}
          currentNode={playlist.getCurrent()}
          onSelectSong={handleSelectSong}
          onDeleteSong={(position) => { playlist.deleteAtPosition(position); refresh(); }}
          onMoveSong={(position, direction) => {
            if (playlist.moveAtPosition(position, direction)) refresh();
          }}
        />
      </section>

      <section className="library-tools" aria-label="Administrar música">
        <SongForm
          onInsertStart={(song: Song) => { playlist.insertAtStart(song); refresh(); }}
          onInsertEnd={(song: Song) => { playlist.insertAtEnd(song); refresh(); }}
          onInsertPosition={(song: Song, pos: number) => { playlist.insertAtPosition(song, pos); refresh(); }}
          onDeletePosition={(pos: number) => { playlist.deleteAtPosition(pos); refresh(); }}
        />

        <YouTubeSearch onAddSong={handleAddYouTubeSong} />
      </section>
    </main>
  );
}