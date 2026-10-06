import React, { useRef, useState, useEffect} from "react";
import { TrackNode } from "../core/TrackNode";

interface PlayerControlsProps{
    currentTrack: TrackNode | null;
    onNext: () => void;
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
    const [previousTrackId, setPreviousTrackId] = useState(currentTrackId);

    if (currentTrackId !== previousTrackId) {
        setPreviousTrackId(currentTrackId);
        if (!currentTrack || currentTrack.content.getSource() === 'youtube') {
            setIsPlaying(false);
        }
    }

    // Referencia para mantener una unica instancia del objeto Audio.
    const audioRef = useRef<HTMLAudioElement | null >(null);
    const isPlayingRef = useRef(isPlaying);
    const onNextRef = useRef(onNext);

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
            onNextRef.current();
            setIsPlaying(false);
        };

        if (isPlayingRef.current) {
            newAudio.play().catch((err) => console.log('Error al reproducir el audio:', err));
            setIsPlaying(true);
        }

        return () => {
            newAudio.pause();
        };
    }, [currentTrack]);

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
            <div style = {{border: '1px solid #css', padding: '15px', borderRadius: '8px', marginBottom: '20px'}}>
               <h2>Reproductor</h2>
               <p><i>No hay ninguna canción en reproducción.</i></p>

            </div>
        );
    }

    const song = currentTrack.content;
    const youtubeVideoId = song.getYoutubeVideoId();

    return (
        <div style={{border: '2px solid #4CAF50', padding: '15px', borderRadius: '8px', marginBottom: '20px' }}>
            <h2>Reproductor</h2>
            <h3>{song.getTitle()} - {song.getArtist()}</h3>
            {youtubeVideoId ? (
                <div style={{ width: '100%', maxWidth: '560px', margin: '0 auto' }}>
                    <iframe
                        key={youtubeVideoId}
                        width="560"
                        height="315"
                        src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(youtubeVideoId)}?autoplay=1`}
                        title={`Reproduciendo ${song.getTitle()}`}
                        allow="autoplay; encrypted-media; picture-in-picture"
                        referrerPolicy="strict-origin-when-cross-origin"
                        allowFullScreen
                        style={{ width: '100%', aspectRatio: '16 / 9', height: 'auto', border: 0 }}
                    />
                    <p>Usa los controles oficiales de YouTube para reproducir o pausar.</p>
                </div>
            ) : (
                <p>Duración: {song.getDuration()} segundos</p>
            )}

            <div style={{display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button onClick={onPrevious}>Anterior</button>

                {!youtubeVideoId && (
                    <button
                        onClick = {togglePlayPause}
                        style={{ backgroundColor: isPlaying ? '#ff9800' : '#4CAF50', color: 'white', fontWeight: 'bold' }}
                    >
                        {isPlaying ? '⏸ Pausa' : '▶ Reproducir'}
                    </button>
                )}

                <button onClick={onNext}>Siguiente</button>
            </div>
        </div>
    );
};