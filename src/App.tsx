import type { Session } from '@supabase/supabase-js';
import { useEffect, useRef, useState } from 'react';
import { AccountAccess } from './components/AccountAccess';
import { PlayerControls } from './components/PlayerControls';
import { PlaylistView } from './components/PlaylistView';
import { SongForm, type AudioFileFailure, type AudioFileImportResult } from './components/SongForm';
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

function shuffledTrackIdsForIds(ids: string[]): string[] {
  const shuffledIds = [...ids];
  for (let index = shuffledIds.length - 1; index > 0; index--) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffledIds[index], shuffledIds[swapIndex]] = [shuffledIds[swapIndex], shuffledIds[index]];
  }

  return shuffledIds;
}

function shuffledTrackIds(playlist: SongPlaylist, excludedId: string | null): string[] {
  const ids = playlist.toArray()
    .map((node) => node.content.getId())
    .filter((id) => id !== excludedId);

  return shuffledTrackIdsForIds(ids);
}

function ProfileAvatar({ avatarUrl, displayName }: { avatarUrl: string | null; displayName: string }) {
  const [imageFailed, setImageFailed] = useState(false);
  const initials = displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toLocaleUpperCase();

  return (
    <span className="profile-avatar">
      {avatarUrl && !imageFailed
        ? <img src={avatarUrl} alt={`Foto de perfil de ${displayName}`} onError={() => setImageFailed(true)} />
        : <span aria-hidden="true">{initials || '♪'}</span>}
    </span>
  );
}

type ColorTheme = 'light' | 'dark';
const colorThemeStorageKey = 'music-player-color-theme';

function loadColorTheme(): ColorTheme {
  try {
    return window.localStorage.getItem(colorThemeStorageKey) === 'light' ? 'light' : 'dark';
  } catch (error) {
    console.error('No se pudo leer la preferencia de tema:', error);
    return 'light';
  }
}

function ThemeToggle({ theme, onToggle }: { theme: ColorTheme; onToggle: () => void }) {
  const nextThemeLabel = theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro';

  return (
    <button
      className="theme-toggle"
      type="button"
      onClick={onToggle}
      aria-label={nextThemeLabel}
      title={nextThemeLabel}
    >
      {theme === 'dark' ? (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M20.5 15.5A8.5 8.5 0 0 1 8.5 3.5 8.5 8.5 0 1 0 20.5 15.5Z" />
        </svg>
      )}
    </button>
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
  const [shuffleEnabled, setShuffleEnabled] = useState(false);
  const [colorTheme, setColorTheme] = useState<ColorTheme>(loadColorTheme);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const suppressProfileFocusOpenRef = useRef(false);
  const saveQueue = useRef<Promise<void>>(Promise.resolve());
  const saveRevision = useRef(0);
  const playlistDirtyRef = useRef(false);
  const syncStatusRef = useRef(syncStatus);
  const shuffleQueueRef = useRef<string[]>([]);
  const shuffleHistoryRef = useRef<string[]>([]);
  const refresh = () => {
    playlistDirtyRef.current = true;
    setVersion((currentVersion) => currentVersion + 1);
    setPlaylistDirty(true);
    setSyncError('');
  };
  const resetShuffleQueue = (currentTrackId: string | null) => {
    shuffleQueueRef.current = shuffledTrackIds(playlist, currentTrackId);
    shuffleHistoryRef.current = [];
  };
  const insertShuffleTrack = (trackId: string) => {
    if (!shuffleEnabled || shuffleQueueRef.current.includes(trackId)) return;
    const index = Math.floor(Math.random() * (shuffleQueueRef.current.length + 1));
    shuffleQueueRef.current.splice(index, 0, trackId);
  };
  const removeShuffleTrack = (trackId: string) => {
    shuffleQueueRef.current = shuffleQueueRef.current.filter((id) => id !== trackId);
    shuffleHistoryRef.current = shuffleHistoryRef.current.filter((id) => id !== trackId);
  };
  const toggleShuffle = () => {
    const enabled = !shuffleEnabled;
    setShuffleEnabled(enabled);
    if (enabled) {
      resetShuffleQueue(playlist.getCurrent()?.content.getId() ?? null);
    } else {
      shuffleQueueRef.current = [];
      shuffleHistoryRef.current = [];
    }
  };
  const toggleColorTheme = () => {
    setColorTheme((theme) => theme === 'light' ? 'dark' : 'light');
  };

  useEffect(() => {
    playlistDirtyRef.current = playlistDirty;
    syncStatusRef.current = syncStatus;
  }, [playlistDirty, syncStatus]);

  useEffect(() => {
    document.documentElement.dataset.theme = colorTheme;
    try {
      window.localStorage.setItem(colorThemeStorageKey, colorTheme);
    } catch (error) {
      console.error('No se pudo guardar la preferencia de tema:', error);
    }
  }, [colorTheme]);

  useEffect(() => {
    const closeMenuOnOutsideClick = (event: PointerEvent) => {
      if (event.target instanceof Node && !profileMenuRef.current?.contains(event.target)) {
        setIsProfileMenuOpen(false);
      }
    };
    const closeMenuOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || !isProfileMenuOpen) return;
      setIsProfileMenuOpen(false);
      suppressProfileFocusOpenRef.current = true;
      profileMenuRef.current?.querySelector('button')?.focus();
      queueMicrotask(() => {
        suppressProfileFocusOpenRef.current = false;
      });
    };
    window.addEventListener('pointerdown', closeMenuOnOutsideClick);
    window.addEventListener('keydown', closeMenuOnEscape);
    return () => {
      window.removeEventListener('pointerdown', closeMenuOnOutsideClick);
      window.removeEventListener('keydown', closeMenuOnEscape);
    };
  }, [isProfileMenuOpen]);

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
        setShuffleEnabled(false);
        shuffleQueueRef.current = [];
        shuffleHistoryRef.current = [];
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
      shuffleQueueRef.current = [];
      shuffleHistoryRef.current = [];
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
          <div className="app-header-content">
            <div>
              <p className="eyebrow">TU ESPACIO DE AUDIO</p>
              <h1>Reproductor de Música</h1>
            </div>
            <ThemeToggle theme={colorTheme} onToggle={toggleColorTheme} />
          </div>
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
          <div className="app-header-content">
            <div>
              <p className="eyebrow">TU ESPACIO DE AUDIO</p>
              <h1>Reproductor de Música</h1>
              <p className="app-description">Inicia sesión para acceder a tu playlist personal.</p>
            </div>
            <div className="profile-menu-theme">
              <span>Tema {colorTheme === 'dark' ? 'oscuro' : 'claro'}</span>
              <ThemeToggle theme={colorTheme} onToggle={toggleColorTheme} />
            </div>
          </div>
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
    if (!node) return;
    playlist.setCurrentNode(node);
    if (shuffleEnabled) resetShuffleQueue(node.content.getId());
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
    insertShuffleTrack(song.getId());
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

    if (shuffleEnabled) resetShuffleQueue(existingNode?.content.getId() ?? playlist.getTail()?.content.getId() ?? null);
    refresh();
  };

  const handleAddLocalFiles = async (
    files: File[],
    onProgress: (processed: number, total: number) => void,
  ): Promise<AudioFileImportResult> => {
    let processed = 0;
    const outcomes = await Promise.all(files.map(async (file) => {
      let audioUrl: string | null = null;
      try {
        const createdAudioUrl = URL.createObjectURL(file);
        audioUrl = createdAudioUrl;
        const audio = new Audio();
        audio.preload = 'metadata';
        const duration = await new Promise<number>((resolve, reject) => {
          let timeoutId = 0;
          let settled = false;
          const finish = (error?: Error, loadedDuration = audio.duration) => {
            if (settled) return;
            settled = true;
            window.clearTimeout(timeoutId);
            audio.onloadedmetadata = null;
            audio.onerror = null;
            audio.removeAttribute('src');
            audio.load();
            if (error) reject(error);
            else resolve(Number.isFinite(loadedDuration) ? Math.round(loadedDuration) : 0);
          };
          audio.onloadedmetadata = () => finish(undefined, audio.duration);
          audio.onerror = () => finish(new Error(
            audio.error?.message || 'El navegador no pudo leer o reproducir el archivo.',
          ));
          timeoutId = window.setTimeout(() => finish(new Error(
            'El navegador tardó demasiado en leer el archivo.',
          )), 15000);
          audio.src = createdAudioUrl;
          audio.load();
        });
        const title = file.name.replace(/\.[^.]+$/, '') || file.name;
        const song = new Song(crypto.randomUUID(), title, 'Archivo local', duration, createdAudioUrl);
        await saveLocalAudio(session.user.id, [{ song, file }]);
        return { song, failure: null };
      } catch (error) {
        if (audioUrl) URL.revokeObjectURL(audioUrl);
        return {
          song: null,
          failure: {
            fileName: file.name,
            message: error instanceof Error ? error.message : 'No se pudo procesar el archivo.',
          } satisfies AudioFileFailure,
        };
      } finally {
        processed += 1;
        onProgress(processed, files.length);
      }
    }));

    const songs = outcomes.flatMap(({ song }) => song ? [song] : []);
    const failures = outcomes.flatMap(({ failure }) => failure ? [failure] : []);
    songs.forEach((song) => {
      playlist.insertAtEnd(song);
      insertShuffleTrack(song.getId());
    });
    if (songs.length > 0) refresh();
    setLocalAudioError('');
    return { added: songs.length, failures };
  };

  const userMetadata = session.user.user_metadata;
  const displayName = [
    userMetadata.full_name,
    userMetadata.name,
    userMetadata.preferred_username,
  ].find((value): value is string => typeof value === 'string' && value.trim() !== '')?.trim() ?? 'Mi perfil';
  const avatarUrl = [userMetadata.avatar_url, userMetadata.picture]
    .find((value): value is string => typeof value === 'string' && value.trim() !== '')?.trim() ?? null;
  const syncIndicatorLabel = syncStatus === 'saving'
    ? 'Guardando cambios'
    : syncStatus === 'error'
      ? 'Error al guardar la playlist'
      : realtimeStatus === 'disconnected'
        ? 'Playlist guardada; sincronización en vivo desconectada'
        : syncStatus === 'saved'
          ? 'Playlist guardada correctamente'
          : 'Estado de sincronización pendiente';
  const syncIndicatorIcon = syncStatus === 'saving'
    ? '↻'
    : syncStatus === 'error' || realtimeStatus === 'disconnected'
      ? '!'
      : syncStatus === 'saved'
        ? '✓'
        : '•';

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
            <div
              className={`profile-menu${isProfileMenuOpen ? ' is-open' : ''}`}
              ref={profileMenuRef}
              onMouseEnter={() => setIsProfileMenuOpen(true)}
              onMouseLeave={(event) => {
                if (!event.currentTarget.contains(document.activeElement)) setIsProfileMenuOpen(false);
              }}
              onFocusCapture={() => {
                if (!suppressProfileFocusOpenRef.current) setIsProfileMenuOpen(true);
              }}
              onBlurCapture={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget)) setIsProfileMenuOpen(false);
              }}
            >
              <button
                className="profile-menu-trigger"
                type="button"
                aria-haspopup="true"
                aria-expanded={isProfileMenuOpen}
                aria-label={`Perfil de ${displayName}`}
                onClick={() => setIsProfileMenuOpen(true)}
              >
                <ProfileAvatar key={avatarUrl ?? 'fallback'} avatarUrl={avatarUrl} displayName={displayName} />
                <span>{displayName}</span>
                <svg viewBox="0 0 20 20" aria-hidden="true">
                  <path d="m5 7 5 5 5-5" />
                </svg>
              </button>
              <div className="profile-menu-popover" aria-label="Opciones de perfil">
                <div className="profile-menu-sync">
                  <span
                    className={`sync-indicator${syncStatus === 'error' || realtimeStatus === 'disconnected' ? ' is-warning' : ''}${syncStatus === 'saving' ? ' is-saving' : ''}`}
                    role="status"
                    aria-label={syncIndicatorLabel}
                    title={syncIndicatorLabel}
                  >
                    {syncIndicatorIcon}
                  </span>
                  <span>{syncIndicatorLabel}</span>
                </div>
                {syncError && <p className="sync-error" role="alert">{syncError}</p>}
                {syncStatus === 'error' && (
                  <button className="profile-menu-action" type="button" onClick={() => setPlaylistDirty(true)}>
                    Reintentar guardado
                  </button>
                )}
                <ThemeToggle theme={colorTheme} onToggle={toggleColorTheme} />
                <button
                  className="profile-menu-action"
                  type="button"
                  onClick={() => { void supabase?.auth.signOut(); }}
                >
                  Cerrar sesión
                </button>
              </div>
            </div>
            <SongForm onAddFiles={handleAddLocalFiles} />
          </div>
        </div>
      </header>

      <YouTubeSearch
        onAddSong={handleAddYouTubeSong}
        onPlaySong={handlePlayYouTubeSong}
      />

      <section className="listening-layout" aria-label="Reproductor y lista de reproducción">
        <PlayerControls
          currentTrack={playlist.getCurrent()}
          canStartPlayback={playlist.getSize() > 0}
          onStartPlayback={() => {
            const firstTrack = playlist.getHead();
            if (!firstTrack) return false;
            playlist.setCurrentNode(firstTrack);
            if (shuffleEnabled) resetShuffleQueue(firstTrack.content.getId());
            refresh();
            return true;
          }}
          shuffleEnabled={shuffleEnabled}
          onToggleShuffle={toggleShuffle}
          onNext={(repeatPlaylist = false, shuffle = false) => {
            const currentTrack = playlist.getCurrent();
            if (!currentTrack) {
              const firstTrack = playlist.getHead();
              if (!firstTrack) return false;
              playlist.setCurrentNode(firstTrack);
              if (shuffle) resetShuffleQueue(firstTrack.content.getId());
              refresh();
              return true;
            }
            if (shuffle) {
              const nodes = playlist.toArray();
              const existingIds = new Set(nodes.map((node) => node.content.getId()));
              const visitedIds = new Set(shuffleHistoryRef.current);
              const queuedIds = new Set(shuffleQueueRef.current);
              const unqueuedIds = nodes
                .map((node) => node.content.getId())
                .filter((id) => id !== currentTrack.content.getId()
                  && !visitedIds.has(id)
                  && !queuedIds.has(id));
              for (const id of shuffledTrackIdsForIds(unqueuedIds)) {
                const index = Math.floor(Math.random() * (shuffleQueueRef.current.length + 1));
                shuffleQueueRef.current.splice(index, 0, id);
              }

              let nextId: string | undefined;
              while (shuffleQueueRef.current.length > 0 && !nextId) {
                const candidateId = shuffleQueueRef.current.shift();
                if (candidateId && candidateId !== currentTrack.content.getId() && existingIds.has(candidateId)) {
                  nextId = candidateId;
                }
              }

              if (!nextId && repeatPlaylist && nodes.length > 1) {
                shuffleQueueRef.current = shuffledTrackIds(playlist, currentTrack.content.getId());
                nextId = shuffleQueueRef.current.shift();
                shuffleHistoryRef.current = [];
              }
              if (!nextId) return false;

              shuffleHistoryRef.current.push(currentTrack.content.getId());
              const nextNode = nodes.find((node) => node.content.getId() === nextId);
              if (!nextNode) return false;
              playlist.setCurrentNode(nextNode);
              refresh();
              return true;
            }

            shuffleHistoryRef.current = [];
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
          onPrevious={(shuffle = false) => {
            const currentTrack = playlist.getCurrent();
            if (!currentTrack) {
              const lastTrack = playlist.getTail();
              if (!lastTrack) return;
              playlist.setCurrentNode(lastTrack);
              if (shuffle) resetShuffleQueue(lastTrack.content.getId());
              refresh();
              return;
            }
            if (shuffle && currentTrack) {
              let previousId = shuffleHistoryRef.current.pop();
              const nodes = playlist.toArray();
              while (previousId && !nodes.some((node) => node.content.getId() === previousId)) {
                previousId = shuffleHistoryRef.current.pop();
              }
              if (previousId) {
                const currentId = currentTrack.content.getId();
                if (!shuffleQueueRef.current.includes(currentId)) shuffleQueueRef.current.unshift(currentId);
                const previousNode = nodes.find((node) => node.content.getId() === previousId);
                if (previousNode) {
                  playlist.setCurrentNode(previousNode);
                  refresh();
                  return;
                }
              }
            }
            playlist.playPrevious();
            if (shuffle) resetShuffleQueue(playlist.getCurrent()?.content.getId() ?? null);
            refresh();
          }}
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
                removeShuffleTrack(song.getId());
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
            onMoveSong={(fromPosition, toPosition) => {
              if (playlist.moveToPosition(fromPosition, toPosition)) refresh();
            }}
          />
      </section>

      {localAudioError && <p className="form-error" role="alert">{localAudioError}</p>}
    </main>
  );
}