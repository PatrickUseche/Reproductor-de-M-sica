import { useEffect, useState, type FormEvent } from 'react';
import { searchYouTubeSongs, type YouTubeVideo } from '../services/youtube';

interface YouTubeSearchProps {
  onAddSong: (video: YouTubeVideo) => void;
  onPlaySong: (video: YouTubeVideo) => void;
}

/** Busca videos musicales y permite agregarlos a la playlist. */
export function YouTubeSearch({ onAddSong, onPlaySong }: YouTubeSearchProps) {
  const [query, setQuery] = useState('');
  const [videos, setVideos] = useState<YouTubeVideo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const searchTerm = query.trim();
    if (searchTerm.length < 3) return;

    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      setIsLoading(true);
      void searchYouTubeSongs(searchTerm, controller.signal).then((results) => {
        setVideos(results);
        setError(results.length === 0 ? 'No se encontraron videos. Prueba con otro nombre.' : '');
      }).catch((searchError: unknown) => {
        if (controller.signal.aborted) return;
        setVideos([]);
        setError(
          searchError instanceof Error
            ? searchError.message
            : 'No se pudo completar la búsqueda de YouTube.',
        );
      }).finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });
    }, 400);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [query]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
  };

  return (
    <section className="tool-panel" aria-labelledby="youtube-search-title">
      <h2 id="youtube-search-title">Buscar en YouTube</h2>
      <form className="youtube-search-form" onSubmit={handleSubmit}>
        <input
          type="search"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setVideos([]);
            setError('');
            setIsLoading(false);
          }}
          placeholder="Ej.: nombre de canción o artista"
          aria-label="Buscar canciones en YouTube"
          aria-describedby="youtube-search-hint"
        />
      </form>
      <p className="search-hint" id="youtube-search-hint" role="status">
        {query.trim().length < 3
          ? 'Escribe al menos 3 caracteres para buscar.'
          : isLoading ? 'Buscando canciones…' : 'Los resultados se actualizan mientras escribes.'}
      </p>

      {error && <p className="form-error" role="alert">{error}</p>}

      {videos.length > 0 && (
        <ul className="youtube-results">
          {videos.map((video) => {
            const thumbnail =
              video.snippet.thumbnails.medium?.url ?? video.snippet.thumbnails.default?.url;

            return (
              <li className="youtube-result" key={video.id.videoId}>
                <button
                  className="youtube-result-play"
                  type="button"
                  onClick={() => onPlaySong(video)}
                  aria-label={`Añadir y reproducir ${video.snippet.title} de ${video.snippet.channelTitle}`}
                >
                  {thumbnail && (
                    <img
                      src={thumbnail}
                      alt=""
                      width="120"
                      height="90"
                    />
                  )}
                  <span className="youtube-result-copy">
                    <strong>{video.snippet.title}</strong>
                    <span>{video.snippet.channelTitle}</span>
                  </span>
                </button>
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
