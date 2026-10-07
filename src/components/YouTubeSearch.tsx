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
    <section className="tool-panel" aria-labelledby="youtube-search-title">
      <h2 id="youtube-search-title">Buscar en YouTube</h2>
      <form className="youtube-search-form" onSubmit={handleSearch}>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Ej.: nombre de canción o artista"
          aria-label="Buscar canciones en YouTube"
        />
        <button type="submit" disabled={isLoading}>
          {isLoading ? 'Buscando…' : 'Buscar'}
        </button>
      </form>

      {error && <p className="form-error" role="alert">{error}</p>}

      {videos.length > 0 && (
        <ul className="youtube-results">
          {videos.map((video) => {
            const thumbnail =
              video.snippet.thumbnails.medium?.url ?? video.snippet.thumbnails.default?.url;

            return (
              <li className="youtube-result" key={video.id.videoId}>
                {thumbnail && (
                  <img
                    src={thumbnail}
                    alt=""
                    width="120"
                    height="90"
                  />
                )}
                <div className="youtube-result-copy">
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
