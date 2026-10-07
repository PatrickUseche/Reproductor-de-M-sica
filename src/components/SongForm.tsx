import React, { useState } from "react";
import { Song } from "../types/Song";

interface SongFormProps {
  onInsertStart: (song: Song) => void;
  onInsertEnd: (song: Song) => void;
  onInsertPosition: (song: Song, position: number) => void;
  onDeletePosition: (position: number) => void;
}

/** Permite insertar pistas de audio directo y borrar una pista por índice. */
export const SongForm: React.FC<SongFormProps> = ({
  onInsertStart,
  onInsertEnd,
  onInsertPosition,
  onDeletePosition,
}) => {
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [duration, setDuration] = useState('');
  const [position, setPosition] = useState(0);
  const [audioUrl, setAudioUrl] = useState('');

  /** Valida el formulario y construye el modelo usado por la playlist. */
  const createSongFromInput = (): Song | null => {
    if (!title.trim() || !artist.trim() || !duration || !audioUrl.trim()) {
      alert('Por favor completa todos los campos (título, artista, duración y URL de audio).');
      return null;
    }

    const id = crypto.randomUUID();
    return new Song(id, title, artist, Number(duration), audioUrl);
  };

  /** Limpia los datos de la pista después de insertarla correctamente. */
  const clearInputs = () => {
    setTitle('');
    setArtist('');
    setDuration('');
  };

  return (
    <section className="tool-panel" aria-labelledby="song-form-title">
      <h2 id="song-form-title">Agregar una canción</h2>

      <div className="song-fields">
        <input
          type="text"
          placeholder="Título"
          aria-label="Título de la canción"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <input
          type="text"
          placeholder="Artista"
          aria-label="Artista"
          value={artist}
          onChange={(e) => setArtist(e.target.value)}
        />
        <input
          type="number"
          placeholder="Duración (segundos)"
          aria-label="Duración en segundos"
          min="0"
          value={duration}
          onChange={(e) => setDuration(e.target.value)}
        />
        <input
          type="text"
          placeholder="URL del archivo de audio (.mp3)"
          aria-label="URL del archivo de audio"
          value={audioUrl}
          onChange={(e) => setAudioUrl(e.target.value)}
        />
        <input
          type="number"
          placeholder="Posición (empieza en 0)"
          aria-label="Posición de la canción, empezando en cero"
          min="0"
          value={position}
          onChange={(e) => setPosition(Number(e.target.value))}
        />
      </div>

      <div className="song-form-actions">
        <button type="button" onClick={() => {
          const song = createSongFromInput();
          if (song) { onInsertStart(song); clearInputs(); }
        }}>
          Agregar al Inicio
        </button>
        <button type="button" onClick={() => {
          const song = createSongFromInput();
          if (song) { onInsertEnd(song); clearInputs(); }
        }}>
          Agregar al Final
        </button>
        <button type="button" onClick={() => {
          const song = createSongFromInput();
          if (song) { onInsertPosition(song, position); clearInputs(); }
        }}>
          Agregar en Posición
        </button>
        <button type="button" className="danger-button" onClick={() => onDeletePosition(position)}>
          Eliminar Posición
        </button>
      </div>
    </section>
  );
};