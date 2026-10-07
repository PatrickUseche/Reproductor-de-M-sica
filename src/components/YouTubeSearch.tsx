import { useState, type FormEvent } from 'react';
import { searchYouTubeSongs, type YouTubeVideo } from '../services/youtube';

interface YouTubeSearchProps {
  onAddSong: (video: YouTubeVideo) => void;
}

/** Busca videos musicales y permite agregarlos a la playlist. */
export function YouTubeSearch({ onAddSong }: YouTubeSearchProps) {
  const [query, setQuery] = useState('');
  const [videos, setVideos] = useState<YouTubeVideo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  /** Ejecuta la consulta y refleja carga, resultados y errores en la interfaz. */
  const handleSearch = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const searchTerm = query.trim();
    if (!searchTerm) {
      setError('Escribe el nombre de una canción o artista para buscar.');
      setVideos([]);
      return;
    }

    setIsLoading(true);
    setError('');
    try {
      const results = await searchYouTubeSongs(searchTerm);
      setVideos(results);
      if (results.length === 0) {
        setError('No se encontraron videos. Prueba con otro nombre.');
      }
    } catch (searchError) {
      setVideos([]);
      setError(
        searchError instanceof Error
          ? searchError.message
          : 'No se pudo completar la búsqueda de YouTube.',
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section style={{ border: '1px solid #ccc', padding: '15px', borderRadius: '8px', marginBottom: '20px' }}>
      <h3>Buscar canciones en YouTube</h3>
      <form onSubmit={handleSearch} style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Ej.: nombre de canción o artista"
          aria-label="Buscar canciones en YouTube"
          style={{ flex: '1 1 250px' }}
        />
        <button type="submit" disabled={isLoading}>
          {isLoading ? 'Buscando…' : 'Buscar'}
        </button>
      </form>

      {error && <p role="alert" style={{ color: '#b00020', marginTop: '10px' }}>{error}</p>}

      {videos.length > 0 && (
        <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: '12px' }}>
          {videos.map((video) => {
            const thumbnail =
              video.snippet.thumbnails.medium?.url ?? video.snippet.thumbnails.default?.url;

            return (
              <li
                key={video.id.videoId}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  border: '1px solid #ddd',
                  borderRadius: '8px',
                  padding: '10px',
                  textAlign: 'left',
                }}
              >
                {thumbnail && (
                  <img
                    src={thumbnail}
                    alt=""
                    width="120"
                    height="90"
                    style={{ objectFit: 'cover', borderRadius: '4px' }}
                  />
                )}
                <div style={{ flex: 1 }}>
                  <strong>{video.snippet.title}</strong>
                  <p>{video.snippet.channelTitle}</p>
                </div>
                <button type="button" onClick={() => onAddSong(video)}>
                  Añadir a la lista
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
