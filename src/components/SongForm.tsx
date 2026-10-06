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
    <div style={{ border: '1px solid #ccc', padding: '15px', borderRadius: '8px', marginBottom: '20px' }}>
      <h3>Administrar Canciones</h3>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxWidth: '350px' }}>
        <input
          type="text"
          placeholder="Título"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <input
          type="text"
          placeholder="Artista"
          value={artist}
          onChange={(e) => setArtist(e.target.value)}
        />
        <input
          type="number"
          placeholder="Duración (segundos)"
          value={duration}
          onChange={(e) => setDuration(e.target.value)}
        />
        <input
          type="text"
          placeholder="URL del archivo de audio (.mp3)"
          value={audioUrl}
          onChange={(e) => setAudioUrl(e.target.value)}
        />
        <input
          type="number"
          placeholder="Posición (índice)"
          value={position}
          onChange={(e) => setPosition(Number(e.target.value))}
        />
      </div>

      <div style={{ display: 'flex', gap: '10px', marginTop: '15px', flexWrap: 'wrap' }}>
        <button onClick={() => {
          const song = createSongFromInput();
          if (song) { onInsertStart(song); clearInputs(); }
        }}>
          Agregar al Inicio
        </button>
        <button onClick={() => {
          const song = createSongFromInput();
          if (song) { onInsertEnd(song); clearInputs(); }
        }}>
          Agregar al Final
        </button>
        <button onClick={() => {
          const song = createSongFromInput();
          if (song) { onInsertPosition(song, position); clearInputs(); }
        }}>
          Agregar en Posición
        </button>
        <button onClick={() => onDeletePosition(position)} style={{ backgroundColor: '#ff4d4d', color: 'white' }}>
          Eliminar Posición
        </button>
      </div>
    </div>
  );
};