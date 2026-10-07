import React, { useEffect, useRef, useState } from "react";
import { TrackNode } from "../core/TrackNode";
import { loadYouTubeIframeApi, type YouTubePlayer } from "../services/youtubeIframeApi";

interface PlayerControlsProps{
    currentTrack: TrackNode | null;
    onNext: () => boolean;
    onPrevious: () => void;
}

/**
 * Reproduce audio directo con `HTMLAudioElement` y delega los videos de YouTube
 * al reproductor oficial incrustado.
 */
export const PlayerControls: React.FC<PlayerControlsProps> = ({
    currentTrack,
    onNext,
    onPrevious,
}) => {
    // Estado para la interfaz (Play / Pausa).
    const [isPlaying, setIsPlaying] = useState<boolean>(false);
    const currentTrackId = currentTrack?.content.getId() ?? null;
    const youtubeVideoId = currentTrack?.content.getYoutubeVideoId() ?? null;
    const [previousTrackId, setPreviousTrackId] = useState(currentTrackId);

    if (currentTrackId !== previousTrackId) {
        setPreviousTrackId(currentTrackId);
        if (!currentTrack || currentTrack.content.getSource() === 'youtube') {
            setIsPlaying(false);
        }
    }

    // Referencia para mantener una unica instancia del objeto Audio.
    const audioRef = useRef<HTMLAudioElement | null >(null);
    const youtubeContainerRef = useRef<HTMLDivElement | null>(null);
    const isPlayingRef = useRef(isPlaying);
    const onNextRef = useRef(onNext);
    const [youtubePlayerError, setYoutubePlayerError] = useState<{ trackId: string; message: string } | null>(null);

    useEffect(() => {
        isPlayingRef.current = isPlaying;
        onNextRef.current = onNext;
    }, [isPlaying, onNext]);

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

        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current = null;
        }

        if (song.getSource() === 'youtube') {
            return;
        }

        const newAudio = new Audio(song.getAudioUrl());
        audioRef.current = newAudio;

        newAudio.onended = () => {
            setIsPlaying(onNextRef.current());
        };

        if (isPlayingRef.current) {
            newAudio.play().catch((err) => console.log('Error al reproducir el audio:', err));
            setIsPlaying(true);
        }

        return () => {
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
                        setIsPlaying(onNextRef.current());
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
                <div className="video-frame">
                    <div className="youtube-player-host" ref={youtubeContainerRef} />
                    <p className="player-note" role={youtubePlayerError?.trackId === currentTrackId ? 'alert' : undefined}>
                        {youtubePlayerError?.trackId === currentTrackId
                            ? youtubePlayerError.message
                            : 'Usa los controles oficiales de YouTube para reproducir o pausar.'}
                    </p>
                </div>
            ) : (
                <p className="player-note">Duración: {song.getDuration()} segundos</p>
            )}

            <div className="player-actions">
                <button className="secondary-button" onClick={onPrevious} aria-label="Canción anterior">Anterior</button>

                {!youtubeVideoId && (
                    <button
                        onClick = {togglePlayPause}
                        className="primary-button"
                    >
                        {isPlaying ? '⏸ Pausa' : '▶ Reproducir'}
                    </button>
                )}

                <button className="secondary-button" onClick={onNext} aria-label="Canción siguiente">Siguiente</button>
            </div>
        </section>
    );
};