import { useEffect, useState } from 'react';
import { searchYouTubeSongs, type YouTubeVideo } from '../services/youtube';
import type { Song } from '../types/Song';

interface PlaylistSuggestionsProps {
  seedSong: Song | null;
  existingVideoIds: string[];
  onAddSong: (video: YouTubeVideo) => void;
}

function normalizedSongTitle(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase()
    .replace(/\([^)]*\)|\[[^\]]*\]/g, ' ')
    .replace(/\b(official|video|audio|lyrics?|visualizer|remaster(ed)?|4k|hd|topic)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function shuffledVideos(videos: YouTubeVideo[]) {
  const shuffled = [...videos];
  for (let index = shuffled.length - 1; index > 0; index--) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

/** Sugiere canciones relacionadas con la última pista añadida, sin agregarlas automáticamente. */
export function PlaylistSuggestions({
  seedSong,
  existingVideoIds,
  onAddSong,
}: PlaylistSuggestionsProps) {
  const [results, setResults] = useState<{
    seedId: string;
    videos: YouTubeVideo[];
  } | null>(null);
  const [loadingSeedId, setLoadingSeedId] = useState<string | null>(null);
  const [failure, setFailure] = useState<{ seedId: string; message: string } | null>(null);
  const existingIds = new Set(existingVideoIds);
  const seedId = seedSong?.getId() ?? null;
  const videos = results?.seedId === seedId ? results.videos : [];
  const seedTitle = seedSong ? normalizedSongTitle(seedSong.getTitle()) : '';
  const availableVideos = videos.filter((video) => {
    if (existingIds.has(video.id.videoId)) return false;
    const candidateTitle = normalizedSongTitle(video.snippet.title);
    return candidateTitle !== seedTitle
      && !candidateTitle.startsWith(`${seedTitle} `)
      && !seedTitle.startsWith(`${candidateTitle} `);
  }).slice(0, 5);
  const error = failure?.seedId === seedId ? failure.message : '';
  const isLoading = loadingSeedId === seedId;

  useEffect(() => {
    if (!seedSong) return;

    const controller = new AbortController();
    const currentSeedId = seedSong.getId();
    const timeout = window.setTimeout(() => {
      setLoadingSeedId(currentSeedId);
      const artist = seedSong.getArtist() === 'Archivo local' ? '' : seedSong.getArtist();
      const query = `${artist} ${seedSong.getTitle()} música`.trim();
      void searchYouTubeSongs(query, controller.signal).then((nextVideos) => {
        if (controller.signal.aborted) return;
        setResults({ seedId: currentSeedId, videos: shuffledVideos(nextVideos) });
        setFailure(null);
      }).catch((searchError: unknown) => {
        if (controller.signal.aborted) return;
        setFailure({
          seedId: currentSeedId,
          message: searchError instanceof Error
            ? searchError.message
            : 'No se pudieron cargar sugerencias.',
        });
      }).finally(() => {
        if (!controller.signal.aborted) setLoadingSeedId(null);
      });
    }, 0);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [seedSong]);

  return (
    <section className="playlist-suggestions" aria-labelledby="playlist-suggestions-title">
      <div className="suggestions-heading">
        <div>
          <p className="eyebrow">PARA SEGUIR ESCUCHANDO</p>
          <h2 id="playlist-suggestions-title">Sugerencias</h2>
          <p className="suggestions-description">Opciones aleatorias relacionadas con la canción añadida.</p>
        </div>
        {seedSong && <span>Basadas en {seedSong.getTitle()}</span>}
      </div>
      {isLoading && <p className="suggestions-message" role="status">Buscando canciones relacionadas…</p>}
      {!isLoading && error && <p className="form-error" role="alert">{error}</p>}
      {!isLoading && !error && seedSong && availableVideos.length === 0 && (
        <p className="suggestions-message" role="status">
          No hay sugerencias nuevas por ahora. Las sugerencias solo se agregan cuando eliges «Añadir».
        </p>
      )}
      {!seedSong && (
        <p className="suggestions-message">Añade una canción para recibir sugerencias relacionadas.</p>
      )}
      {availableVideos.length > 0 && (
        <ul className="youtube-results">
          {availableVideos.map((video) => {
            const thumbnail = video.snippet.thumbnails.medium?.url
              ?? video.snippet.thumbnails.default?.url;

            return (
              <li className="youtube-result" key={video.id.videoId}>
                <div className="youtube-result-info">
                  {thumbnail && <img src={thumbnail} alt="" width="120" height="90" />}
                  <span className="youtube-result-copy">
                    <strong>{video.snippet.title}</strong>
                    <span>{video.snippet.channelTitle}</span>
                  </span>
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
