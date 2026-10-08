import React, { useEffect, useRef, useState } from "react";
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
    const [volume, setVolume] = useState(1);
    const [repeatMode, setRepeatMode] = useState<RepeatMode>('off');
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
    const isPlayingRef = useRef(isPlaying);
    const onNextRef = useRef(onNext);
    const [youtubePlayerError, setYoutubePlayerError] = useState<{ trackId: string; message: string } | null>(null);

    useEffect(() => {
        isPlayingRef.current = isPlaying;
        onNextRef.current = onNext;
    }, [isPlaying, onNext]);

    useEffect(() => {
        volumeRef.current = volume;
        if (audioRef.current) audioRef.current.volume = volume;
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

        const updateDuration = () => {
            if (audioRef.current !== newAudio) return;
            const mediaDuration = newAudio.duration;
            const knownDuration = Number.isFinite(mediaDuration) && mediaDuration > 0
                ? mediaDuration
                : song.getDuration();
            setPlaybackProgress((progress) => ({
                trackId: song.getId(),
                currentTime: progress.trackId === song.getId() ? progress.currentTime : 0,
                duration: Number.isFinite(knownDuration) && knownDuration > 0 ? knownDuration : 0,
            }));
        };
        newAudio.ontimeupdate = () => {
            if (audioRef.current !== newAudio) return;
            setPlaybackProgress((progress) => ({
                trackId: song.getId(),
                currentTime: newAudio.currentTime,
                duration: progress.trackId === song.getId() ? progress.duration : 0,
            }));
        };
        newAudio.onloadedmetadata = updateDuration;
        newAudio.ondurationchange = updateDuration;
        newAudio.oncanplay = updateDuration;
        newAudio.onplay = () => {
            if (audioRef.current === newAudio) setIsPlaying(true);
        };
        newAudio.onpause = () => {
            if (audioRef.current === newAudio) setIsPlaying(false);
        };
        newAudio.onended = () => {
            if (audioRef.current !== newAudio) return;
            const mode = repeatModeRef.current;
            if (mode === 'track') {
                newAudio.currentTime = 0;
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
                    },
                    onStateChange: ({ data }) => {
                        if (data !== api.PlayerState.ENDED) return;
                        const mode = repeatModeRef.current;
                        if (mode === 'track') {
                            player?.seekTo(0, true);
                            player?.playVideo();
                            return;
                        }
                        const didAdvance = onNextRef.current(mode === 'playlist', shuffleEnabledRef.current);
                        if (didAdvance) {
                            setIsPlaying(true);
                        } else if (mode === 'playlist') {
                            player?.seekTo(0, true);
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
        }).catch((error: unknown) => {
            if (cancelled) return;
            setYoutubePlayerError({
                trackId,
                message: error instanceof Error ? error.message : 'No se pudo cargar el reproductor de YouTube.',
            });
        });

        return () => {
            cancelled = true;
            player?.destroy();
            container.replaceChildren();
        };
    }, [currentTrack, currentTrackId, youtubeVideoId]);

    const togglePlayPause = () => {
        if (!audioRef.current || !currentTrack) return;

        if (isPlaying) {
            audioRef.current.pause();
            setIsPlaying(false);
        } else {
            audioRef.current.play()
                .then(() => setIsPlaying(true))
                .catch((err) => console.error('Error al iniciar reproduccion:', err));
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
                    <div className="youtube-player-host" ref={youtubeContainerRef} />
                    <p className="player-note" role={youtubePlayerError?.trackId === currentTrackId ? 'alert' : undefined}>
                        {youtubePlayerError?.trackId === currentTrackId
                            ? youtubePlayerError.message
                            : 'Usa los controles oficiales de YouTube para reproducir o pausar.'}
                    </p>
                </div>
            ) : (
                <div className="audio-controls" key="audio-player">
                    <div className="audio-progress">
                        <input
                            type="range"
                            min="0"
                            max={duration > 0 ? duration : 1}
                            step="0.1"
                            value={duration > 0 ? Math.min(currentTime, duration) : 0}
                            disabled={!duration}
                            aria-label="Posición de reproducción"
                            onChange={(event) => {
                                const nextTime = Number(event.target.value);
                                if (audioRef.current) audioRef.current.currentTime = nextTime;
                                setPlaybackProgress({
                                    trackId: currentTrackId,
                                    currentTime: nextTime,
                                    duration,
                                });
                            }}
                        />
                        <div className="audio-time" aria-live="off">
                            <span>{formatTime(currentTime)}</span>
                            <span>{formatTime(duration || song.getDuration())}</span>
                        </div>
                    </div>
                    <label className="audio-volume">
                        <span>Volumen</span>
                        <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.01"
                            value={volume}
                            aria-label="Volumen"
                            onChange={(event) => setVolume(Number(event.target.value))}
                        />
                    </label>
                </div>
            )}

            <div className="player-actions">
                <button className="secondary-button" onClick={() => onPrevious(shuffleEnabled)} aria-label="Canción anterior">Anterior</button>

                {!youtubeVideoId && (
                    <button
                        onClick = {togglePlayPause}
                        className="primary-button"
                    >
                        {isPlaying ? '⏸ Pausa' : '▶ Reproducir'}
                    </button>
                )}

                <label className="repeat-control">
                    <span>Repetir</span>
                    <select
                        value={repeatMode}
                        onChange={(event) => {
                            const selectedMode = event.target.value;
                            if (selectedMode === 'off' || selectedMode === 'playlist' || selectedMode === 'track') {
                                setRepeatMode(selectedMode);
                            }
                        }}
                        aria-label="Modo de repetición"
                    >
                        <option value="off">Desactivada</option>
                        <option value="playlist">Playlist</option>
                        <option value="track">Canción</option>
                    </select>
                </label>

                <button
                    className={`shuffle-button${shuffleEnabled ? ' is-active' : ''}`}
                    type="button"
                    onClick={onToggleShuffle}
                    aria-pressed={shuffleEnabled}
                    aria-label={shuffleEnabled ? 'Desactivar reproducción aleatoria' : 'Activar reproducción aleatoria'}
                >
                    {shuffleEnabled ? '🔀 Aleatorio' : 'Aleatorio'}
                </button>

                <button className="secondary-button" onClick={() => onNext(false, shuffleEnabled)} aria-label="Canción siguiente">Siguiente</button>
            </div>
        </section>
    );
};