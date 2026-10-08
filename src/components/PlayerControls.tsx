import React, { useCallback, useEffect, useRef, useState } from "react";
import { TrackNode } from "../core/TrackNode";
import { loadYouTubeIframeApi, type YouTubePlayer } from "../services/youtubeIframeApi";

interface PlayerControlsProps{
    currentTrack: TrackNode | null;
    shuffleEnabled: boolean;
    onToggleShuffle: () => void;
    onNext: (repeatPlaylist?: boolean, shuffle?: boolean) => boolean;
    onPrevious: (shuffle?: boolean) => void;
}

type RepeatMode = 'off' | 'playlist' | 'track';
const repeatModes: RepeatMode[] = ['off', 'playlist', 'track'];
const videoVisibilityStorageKey = 'music-player-youtube-video-visible';
const volumeStorageKey = 'music-player-volume';
const playbackPositionsStorageKey = 'music-player-playback-positions';
const maximumSavedPlaybackPositions = 100;

function loadVolumePreference() {
    try {
        const storedVolume = window.localStorage.getItem(volumeStorageKey);
        if (storedVolume === null) return 1;
        const savedVolume = Number(storedVolume);
        return Number.isFinite(savedVolume) && savedVolume >= 0 && savedVolume <= 1 ? savedVolume : 1;
    } catch (error) {
        console.error('No se pudo leer el volumen guardado:', error);
        return 1;
    }
}

function loadPlaybackPosition(trackId: string) {
    try {
        const savedPositions: unknown = JSON.parse(
            window.localStorage.getItem(playbackPositionsStorageKey) ?? '{}',
        );
        if (typeof savedPositions !== 'object' || savedPositions === null || Array.isArray(savedPositions)) {
            return 0;
        }
        const savedPosition = (savedPositions as Record<string, unknown>)[trackId];
        return typeof savedPosition === 'number' && Number.isFinite(savedPosition) && savedPosition > 0
            ? savedPosition
            : 0;
    } catch (error) {
        console.error('No se pudo leer la posición de reproducción guardada:', error);
        return 0;
    }
}

function savePlaybackPosition(trackId: string, currentTime: number) {
    if (!Number.isFinite(currentTime) || currentTime < 0) return;

    try {
        const savedPositions: Record<string, number> = {};
        const parsed: unknown = JSON.parse(
            window.localStorage.getItem(playbackPositionsStorageKey) ?? '{}',
        );
        if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
            for (const [id, position] of Object.entries(parsed)) {
                if (typeof position === 'number' && Number.isFinite(position) && position >= 0) {
                    savedPositions[id] = position;
                }
            }
        }
        delete savedPositions[trackId];
        savedPositions[trackId] = currentTime;
        const savedTrackIds = Object.keys(savedPositions);
        for (const id of savedTrackIds.slice(0, Math.max(0, savedTrackIds.length - maximumSavedPlaybackPositions))) {
            delete savedPositions[id];
        }
        window.localStorage.setItem(playbackPositionsStorageKey, JSON.stringify(savedPositions));
    } catch (error) {
        console.error('No se pudo guardar la posición de reproducción:', error);
    }
}

function loadVideoVisibilityPreference() {
    try {
        return window.localStorage.getItem(videoVisibilityStorageKey) !== 'false';
    } catch (error) {
        console.error('No se pudo leer la preferencia de visibilidad del video:', error);
        return true;
    }
}

const repeatModeLabels: Record<RepeatMode, string> = {
    off: 'Desactivada',
    playlist: 'Playlist',
    track: 'Canción',
};

/**
 * Reproduce audio directo con `HTMLAudioElement` y delega los videos de YouTube
 * al reproductor oficial incrustado.
 */
export const PlayerControls: React.FC<PlayerControlsProps> = ({
    currentTrack,
    shuffleEnabled,
    onToggleShuffle,
    onNext,
    onPrevious,
}) => {
    // Estado para la interfaz (Play / Pausa).
    const [isPlaying, setIsPlaying] = useState<boolean>(false);
    const [playbackProgress, setPlaybackProgress] = useState<{
        trackId: string | null;
        currentTime: number;
        duration: number;
    }>({ trackId: null, currentTime: 0, duration: 0 });
    const [volume, setVolume] = useState(loadVolumePreference);
    const [repeatMode, setRepeatMode] = useState<RepeatMode>('off');
    const [isVideoVisible, setIsVideoVisible] = useState(loadVideoVisibilityPreference);
    const currentTrackId = currentTrack?.content.getId() ?? null;
    const youtubeVideoId = currentTrack?.content.getYoutubeVideoId() ?? null;
    const [previousTrackId, setPreviousTrackId] = useState(currentTrackId);

    if (currentTrackId !== previousTrackId) {
        setPreviousTrackId(currentTrackId);
        if (!currentTrack || currentTrack.content.getSource() === 'youtube') {
            setIsPlaying(false);
        }
    }
    const savedDuration = currentTrack?.content.getDuration() ?? 0;
    const currentTime = playbackProgress.trackId === currentTrackId
        ? playbackProgress.currentTime
        : 0;
    const duration = playbackProgress.trackId === currentTrackId && playbackProgress.duration > 0
        ? playbackProgress.duration
        : Number.isFinite(savedDuration) && savedDuration > 0
            ? savedDuration
            : 0;

    // Referencia para mantener una unica instancia del objeto Audio.
    const audioRef = useRef<HTMLAudioElement | null >(null);
    const volumeRef = useRef(volume);
    const repeatModeRef = useRef(repeatMode);
    const shuffleEnabledRef = useRef(shuffleEnabled);
    const youtubeContainerRef = useRef<HTMLDivElement | null>(null);
    const youtubePlayerRef = useRef<YouTubePlayer | null>(null);
    const isPlayingRef = useRef(isPlaying);
    const onNextRef = useRef(onNext);
    const onPreviousRef = useRef(onPrevious);
    const currentTrackIdRef = useRef(currentTrackId);
    const lastPositionWriteRef = useRef(0);
    const [youtubePlayerError, setYoutubePlayerError] = useState<{ trackId: string; message: string } | null>(null);

    useEffect(() => {
        isPlayingRef.current = isPlaying;
        onNextRef.current = onNext;
        onPreviousRef.current = onPrevious;
        currentTrackIdRef.current = currentTrackId;
        shuffleEnabledRef.current = shuffleEnabled;
    }, [currentTrackId, isPlaying, onNext, onPrevious, shuffleEnabled]);

    useEffect(() => {
        volumeRef.current = volume;
        if (audioRef.current) audioRef.current.volume = volume;
        if (youtubePlayerRef.current) youtubePlayerRef.current.setVolume(Math.round(volume * 100));
        try {
            window.localStorage.setItem(volumeStorageKey, String(volume));
        } catch (error) {
            console.error('No se pudo guardar el volumen:', error);
        }
    }, [volume]);

    useEffect(() => {
        repeatModeRef.current = repeatMode;
    }, [repeatMode]);

    useEffect(() => {
        shuffleEnabledRef.current = shuffleEnabled;
    }, [shuffleEnabled]);

    // EFECTO: Se ejecuta cada vez que cambia la cancion seleccionada (_current).
    useEffect(() => {
        if (!currentTrack) {
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current = null;
            }
            return;
        }

        const song = currentTrack.content;

        if (song.getSource() === 'youtube') {
            return;
        }

        const newAudio = new Audio();
        newAudio.preload = 'metadata';
        newAudio.volume = volumeRef.current;
        audioRef.current = newAudio;
        let restoredPosition = false;
        let trackEnded = false;

        const updateDuration = () => {
            if (audioRef.current !== newAudio) return;
            const mediaDuration = newAudio.duration;
            const knownDuration = Number.isFinite(mediaDuration) && mediaDuration > 0
                ? mediaDuration
                : song.getDuration();
            if (!restoredPosition && Number.isFinite(mediaDuration) && mediaDuration > 0) {
                restoredPosition = true;
                const savedPosition = loadPlaybackPosition(song.getId());
                if (savedPosition > 0 && savedPosition < mediaDuration - 2) {
                    newAudio.currentTime = savedPosition;
                }
            }
            setPlaybackProgress({
                trackId: song.getId(),
                currentTime: newAudio.currentTime,
                duration: Number.isFinite(knownDuration) && knownDuration > 0 ? knownDuration : 0,
            });
        };
        newAudio.ontimeupdate = () => {
            if (audioRef.current !== newAudio) return;
            setPlaybackProgress((progress) => ({
                trackId: song.getId(),
                currentTime: newAudio.currentTime,
                duration: progress.trackId === song.getId() ? progress.duration : 0,
            }));
            if (Date.now() - lastPositionWriteRef.current >= 5000) {
                savePlaybackPosition(song.getId(), newAudio.currentTime);
                lastPositionWriteRef.current = Date.now();
            }
        };
        newAudio.onloadedmetadata = updateDuration;
        newAudio.ondurationchange = updateDuration;
        newAudio.oncanplay = updateDuration;
        newAudio.onplay = () => {
            if (audioRef.current === newAudio) setIsPlaying(true);
        };
        newAudio.onpause = () => {
            if (audioRef.current === newAudio) {
                setIsPlaying(false);
                if (!trackEnded) savePlaybackPosition(song.getId(), newAudio.currentTime);
            }
        };
        newAudio.onended = () => {
            if (audioRef.current !== newAudio) return;
            trackEnded = true;
            savePlaybackPosition(song.getId(), 0);
            const mode = repeatModeRef.current;
            if (mode === 'track') {
                newAudio.currentTime = 0;
                trackEnded = false;
                void newAudio.play().catch((error: unknown) => {
                    console.error('Error al repetir la pista:', error);
                    setIsPlaying(false);
                });
                return;
            }
            setPlaybackProgress((progress) => ({
                trackId: song.getId(),
                currentTime: Number.isFinite(newAudio.duration) ? newAudio.duration : progress.currentTime,
                duration: progress.duration,
            }));
            const didAdvance = onNextRef.current(mode === 'playlist', shuffleEnabledRef.current);
            if (didAdvance) {
                setIsPlaying(true);
            } else if (mode === 'playlist') {
                newAudio.currentTime = 0;
                trackEnded = false;
                void newAudio.play().catch((error: unknown) => {
                    console.error('Error al repetir la playlist:', error);
                    setIsPlaying(false);
                });
            } else {
                setIsPlaying(false);
            }
        };
        newAudio.src = song.getAudioUrl();
        newAudio.load();
        updateDuration();

        if (isPlayingRef.current) {
            newAudio.play().catch((err) => console.log('Error al reproducir el audio:', err));
            setIsPlaying(true);
        }

        return () => {
            if (!trackEnded) savePlaybackPosition(song.getId(), newAudio.currentTime);
            newAudio.ontimeupdate = null;
            newAudio.onloadedmetadata = null;
            newAudio.ondurationchange = null;
            newAudio.oncanplay = null;
            newAudio.onplay = null;
            newAudio.onpause = null;
            newAudio.onended = null;
            if (audioRef.current === newAudio) audioRef.current = null;
            newAudio.pause();
        };
    }, [currentTrack]);

    useEffect(() => {
        const container = youtubeContainerRef.current;
        if (!youtubeVideoId || !container || !currentTrack) return;

        let cancelled = false;
        let player: YouTubePlayer | null = null;
        let trackEnded = false;
        const trackId = currentTrack.content.getId();
        const trackTitle = currentTrack.content.getTitle();

        void loadYouTubeIframeApi().then((api) => {
            if (cancelled) return;

            const playerElement = document.createElement('div');
            container.replaceChildren(playerElement);
            player = new api.Player(playerElement, {
                width: '560',
                height: '315',
                host: 'https://www.youtube-nocookie.com',
                videoId: youtubeVideoId,
                playerVars: {
                    autoplay: 1,
                    enablejsapi: 1,
                    origin: window.location.origin,
                    playsinline: 1,
                    rel: 0,
                },
                events: {
                    onReady: ({ target }) => {
                        target.getIframe().title = `Reproduciendo ${trackTitle}`;
                        target.setVolume(Math.round(volumeRef.current * 100));
                        const savedPosition = loadPlaybackPosition(trackId);
                        const videoDuration = target.getDuration();
                        if (savedPosition > 0 && (!videoDuration || savedPosition < videoDuration - 2)) {
                            target.seekTo(savedPosition, true);
                        }
                    },
                    onStateChange: ({ data }) => {
                        if (data === api.PlayerState.PLAYING) {
                            trackEnded = false;
                            setIsPlaying(true);
                            return;
                        }
                        if (data === api.PlayerState.PAUSED) {
                            setIsPlaying(false);
                            if (!trackEnded) savePlaybackPosition(trackId, player?.getCurrentTime() ?? 0);
                            return;
                        }
                        if (data !== api.PlayerState.ENDED) return;
                        trackEnded = true;
                        setIsPlaying(false);
                        savePlaybackPosition(trackId, 0);
                        const mode = repeatModeRef.current;
                        if (mode === 'track') {
                            player?.seekTo(0, true);
                            trackEnded = false;
                            player?.playVideo();
                            return;
                        }
                        const didAdvance = onNextRef.current(mode === 'playlist', shuffleEnabledRef.current);
                        if (didAdvance) {
                            setIsPlaying(true);
                        } else if (mode === 'playlist') {
                            player?.seekTo(0, true);
                            trackEnded = false;
                            player?.playVideo();
                        } else {
                            setIsPlaying(false);
                        }
                    },
                    onError: () => {
                        setYoutubePlayerError({
                            trackId,
                            message: 'Este video no se puede reproducir aquí. Prueba otra canción.',
                        });
                    },
                },
            });
            youtubePlayerRef.current = player;
        }).catch((error: unknown) => {
            if (cancelled) return;
            setYoutubePlayerError({
                trackId,
                message: error instanceof Error ? error.message : 'No se pudo cargar el reproductor de YouTube.',
            });
        });

        return () => {
            cancelled = true;
            if (player && !trackEnded) {
                savePlaybackPosition(trackId, player.getCurrentTime());
            }
            player?.destroy();
            if (youtubePlayerRef.current === player) youtubePlayerRef.current = null;
            container.replaceChildren();
        };
    }, [currentTrack, currentTrackId, youtubeVideoId]);

    useEffect(() => {
        if (!youtubeVideoId || !currentTrackId) return;
        const syncProgress = () => {
            const player = youtubePlayerRef.current;
            if (!player) return;
            const nextTime = player.getCurrentTime();
            const nextDuration = player.getDuration();
            if (!Number.isFinite(nextTime) || !Number.isFinite(nextDuration)) return;
            setPlaybackProgress({ trackId: currentTrackId, currentTime: nextTime, duration: nextDuration });
            if (Date.now() - lastPositionWriteRef.current >= 5000) {
                savePlaybackPosition(currentTrackId, nextTime);
                lastPositionWriteRef.current = Date.now();
            }
        };
        const interval = window.setInterval(syncProgress, 1000);
        return () => window.clearInterval(interval);
    }, [currentTrackId, youtubeVideoId]);

    useEffect(() => {
        const saveCurrentPosition = () => {
            const trackId = currentTrackIdRef.current;
            if (!trackId) return;
            const currentPosition = audioRef.current?.currentTime ?? youtubePlayerRef.current?.getCurrentTime();
            if (currentPosition !== undefined) savePlaybackPosition(trackId, currentPosition);
        };
        window.addEventListener('pagehide', saveCurrentPosition);
        return () => {
            window.removeEventListener('pagehide', saveCurrentPosition);
            saveCurrentPosition();
        };
    }, []);

    const togglePlayPause = useCallback(() => {
        if (!currentTrack) return;

        if (isPlaying) {
            if (youtubeVideoId) {
                youtubePlayerRef.current?.pauseVideo();
            } else {
                audioRef.current?.pause();
            }
            setIsPlaying(false);
        } else if (youtubeVideoId) {
            youtubePlayerRef.current?.playVideo();
        } else {
            const audio = audioRef.current;
            if (!audio) return;
            audio.play()
                .then(() => setIsPlaying(true))
                .catch((error: unknown) => {
                    console.error('Error al iniciar reproduccion:', error);
                    setIsPlaying(false);
                });
        }
    }, [currentTrack, isPlaying, youtubeVideoId]);

    useEffect(() => {
        const handleKeyboardShortcut = (event: KeyboardEvent) => {
            if (event.repeat || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
            const target = event.target;
            if (target instanceof Element && (
                target.closest('input, textarea, select, button, a, [role="slider"]')
                || (target instanceof HTMLElement && target.isContentEditable)
            )) return;

            if (event.code === 'Space') {
                event.preventDefault();
                togglePlayPause();
            } else if (event.code === 'ArrowLeft') {
                event.preventDefault();
                onPreviousRef.current(shuffleEnabledRef.current);
            } else if (event.code === 'ArrowRight') {
                event.preventDefault();
                onNextRef.current(false, shuffleEnabledRef.current);
            }
        };
        window.addEventListener('keydown', handleKeyboardShortcut);
        return () => window.removeEventListener('keydown', handleKeyboardShortcut);
    }, [togglePlayPause]);

    const toggleVideoVisibility = () => {
        const nextVisibility = !isVideoVisible;
        setIsVideoVisible(nextVisibility);
        try {
            window.localStorage.setItem(videoVisibilityStorageKey, String(nextVisibility));
        } catch (error) {
            console.error('No se pudo guardar la preferencia de visibilidad del video:', error);
        }
    };

    const formatTime = (time: number) => {
        if (!Number.isFinite(time) || time < 0) return '0:00';
        const totalSeconds = Math.floor(time);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;

        return hours > 0
            ? `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
            : `${minutes}:${String(seconds).padStart(2, '0')}`;
    };

    if (!currentTrack){
        return(
            <section className="player-panel player-empty" aria-labelledby="player-title">
               <p className="eyebrow">AHORA</p>
               <h2 id="player-title">Reproductor</h2>
               <div className="player-placeholder" role="status">
                   <span className="placeholder-play" aria-hidden="true">▶</span>
                   <strong>Elige una pista para empezar</strong>
                   <p>Tu selección aparecerá aquí.</p>
               </div>
            </section>
        );
    }

    const song = currentTrack.content;
    return (
        <section className="player-panel" aria-labelledby="player-title">
            <p className="eyebrow">AHORA</p>
            <h2 id="player-title">Reproductor</h2>
            <div className="now-playing-copy">
                <h3>{song.getTitle()}</h3>
                <p>{song.getArtist()}</p>
            </div>
            {youtubeVideoId ? (
                <div className="video-frame" key="youtube-player">
                    <div className="video-visibility-row">
                        <span>{isVideoVisible ? 'Video activo' : 'Modo ligero activado'}</span>
                        <button
                            className="video-visibility-button"
                            type="button"
                            onClick={toggleVideoVisibility}
                            aria-pressed={isVideoVisible}
                        >
                            {isVideoVisible ? 'Ocultar video' : 'Mostrar video'}
                        </button>
                    </div>
                    <div className={`youtube-player-host${isVideoVisible ? '' : ' is-visually-hidden'}`} ref={youtubeContainerRef} />
                    {isVideoVisible ? (
                        <>
                            <p className="player-note" role={youtubePlayerError?.trackId === currentTrackId ? 'alert' : undefined}>
                                {youtubePlayerError?.trackId === currentTrackId
                                    ? youtubePlayerError.message
                                    : 'Usa los controles oficiales de YouTube para reproducir o pausar.'}
                            </p>
                        </>
                    ) : (
                        <div className="youtube-hidden-placeholder" role="status">
                            <span className="placeholder-play" aria-hidden="true">Ⅱ</span>
                            <strong>{isPlaying ? 'Reproducción en curso' : 'Video oculto'}</strong>
                            <p>{isPlaying
                                ? 'El audio sigue reproduciéndose. El video está oculto.'
                                : 'El video está oculto. La reproducción se controla desde los botones inferiores.'}</p>
                        </div>
                    )}
                </div>
            ) : null}

            <div className="audio-controls">
                <div className="audio-progress">
                    <input
                        type="range"
                        min="0"
                        max={duration > 0 ? duration : 1}
                        step="0.1"
                        value={duration > 0 ? Math.min(currentTime, duration) : 0}
                        disabled={!duration}
                        aria-label="Posición de reproducción"
                        aria-valuetext={`${formatTime(currentTime)} de ${formatTime(duration || song.getDuration())}`}
                        onChange={(event) => {
                            const nextTime = Number(event.target.value);
                            if (audioRef.current) audioRef.current.currentTime = nextTime;
                            if (youtubePlayerRef.current) youtubePlayerRef.current.seekTo(nextTime, true);
                            setPlaybackProgress({
                                trackId: currentTrackId,
                                currentTime: nextTime,
                                duration,
                            });
                            if (currentTrackId) savePlaybackPosition(currentTrackId, nextTime);
                        }}
                    />
                    <div className="audio-time" aria-live="off">
                        <span>{formatTime(currentTime)}</span>
                        <span>{formatTime(duration || song.getDuration())}</span>
                    </div>
                </div>
                <label className="audio-volume">
                    <span>Volumen <output>{Math.round(volume * 100)}%</output></span>
                    <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.01"
                        value={volume}
                        aria-label="Volumen"
                        aria-valuetext={`${Math.round(volume * 100)}%`}
                        onChange={(event) => setVolume(Number(event.target.value))}
                    />
                </label>
                <p className="player-shortcuts">Atajos: Espacio reproducir/pausar · ← anterior · → siguiente</p>
            </div>

            <div className="player-actions">
                <button
                    className={`icon-button mode-button${repeatMode !== 'off' ? ' is-active' : ''}`}
                    type="button"
                    onClick={() => {
                        const nextModeIndex = (repeatModes.indexOf(repeatMode) + 1) % repeatModes.length;
                        setRepeatMode(repeatModes[nextModeIndex]);
                    }}
                    aria-label={`Repetición: ${repeatModeLabels[repeatMode]}. Cambiar modo`}
                    title={`Repetición: ${repeatModeLabels[repeatMode]}`}
                    aria-pressed={repeatMode !== 'off'}
                >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M17 2l4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4m14-1v2a3 3 0 0 1-3 3H3" />
                    </svg>
                    {repeatMode === 'track' && <span className="mode-badge" aria-hidden="true">1</span>}
                </button>

                <button
                    className="icon-button navigation-button"
                    type="button"
                    onClick={() => onPrevious(shuffleEnabled)}
                    aria-label="Canción anterior"
                    title="Canción anterior"
                >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M6 5v14M19 6l-10 6 10 6V6Z" />
                    </svg>
                </button>

                <button
                    onClick={togglePlayPause}
                    className="primary-button player-play-button"
                    type="button"
                    aria-label={isPlaying ? 'Pausar reproducción' : 'Reproducir canción seleccionada'}
                    title={isPlaying ? 'Pausar' : 'Reproducir'}
                >
                    {isPlaying ? '⏸' : '▶'}
                </button>

                <button
                    className="icon-button navigation-button"
                    type="button"
                    onClick={() => onNext(false, shuffleEnabled)}
                    aria-label="Canción siguiente"
                    title="Canción siguiente"
                >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M18 5v14M5 6l10 6-10 6V6Z" />
                    </svg>
                </button>

                <button
                    className={`icon-button mode-button${shuffleEnabled ? ' is-active' : ''}`}
                    type="button"
                    onClick={onToggleShuffle}
                    aria-pressed={shuffleEnabled}
                    aria-label={shuffleEnabled ? 'Desactivar reproducción aleatoria' : 'Activar reproducción aleatoria'}
                    title={shuffleEnabled ? 'Aleatorio activado' : 'Aleatorio desactivado'}
                >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5" />
                    </svg>
                </button>
            </div>
        </section>
    );
};