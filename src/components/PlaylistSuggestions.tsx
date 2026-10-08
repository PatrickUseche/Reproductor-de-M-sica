import { useEffect, useState } from 'react';
import { searchYouTubeSongs, type YouTubeVideo } from '../services/youtube';
import type { Song } from '../types/Song';

interface PlaylistSuggestionsProps {
  songs: Song[];
  onAddSong: (video: YouTubeVideo) => void;
}

function normalizeWords(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase()
    .replace(/\([^)]*\)|\[[^\]]*\]/g, ' ')
    .replace(/\b(official|video|audio|lyrics?|visualizer|remaster(ed)?|4k|hd|topic|music|musica)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 1);
}

function titleMatchesPlaylist(candidateTitle: string, playlistTitles: string[][]) {
  const candidateWords = new Set(normalizeWords(candidateTitle));
  if (candidateWords.size === 0) return false;

  return playlistTitles.some((titleWords) => {
    const existingWords = new Set(titleWords);
    if (existingWords.size === 0) return false;
    const sharedWords = [...candidateWords].filter((word) => existingWords.has(word)).length;
    const shorterTitleWordCount = Math.min(candidateWords.size, existingWords.size);
    return sharedWords === shorterTitleWordCount
      || (shorterTitleWordCount >= 3 && sharedWords / shorterTitleWordCount >= 0.75);
  });
}

function shuffledValues<T>(values: T[]) {
  const shuffled = [...values];
  for (let index = shuffled.length - 1; index > 0; index--) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

function shuffledVideos(videos: YouTubeVideo[]) {
  return shuffledValues(videos);
}

function artistSearchQuery(songs: Song[]) {
  const artists = [...new Set(songs
    .map((song) => song.getArtist()
      .replace(/\s*-\s*Topic$/i, '')
      .replace(/\s+(VEVO|Official)$/i, '')
      .trim())
    .filter((artist) => artist && artist !== 'Archivo local'))];

  if (artists.length === 0) return 'canciones música';

  const alternatives = artists.map((artist) => `"${artist.replace(/["|]/g, ' ')}"`);
  let query = '';
  for (const alternative of alternatives) {
    const nextQuery = query ? `${query}|${alternative}` : alternative;
    if (nextQuery.length > 450) continue;
    query = nextQuery;
  }

  return `${query || alternatives[0]} música`;
}

/** Sugiere canciones al azar entre artistas presentes en toda la playlist. */
export function PlaylistSuggestions({ songs, onAddSong }: PlaylistSuggestionsProps) {
  const [results, setResults] = useState<{
    playlistKey: string;
    videos: YouTubeVideo[];
  } | null>(null);
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [failure, setFailure] = useState<{ playlistKey: string; message: string } | null>(null);
  const playlistKey = songs.map((song) =>
    `${song.getId()}:${song.getTitle()}:${song.getArtist()}:${song.getAudioUrl()}`,
  ).join('|');
  const searchQuery = artistSearchQuery(songs);
  const playlistVideoIds = new Set(songs
    .filter((song) => song.getSource() === 'youtube')
    .map((song) => song.getAudioUrl()));
  const playlistTitles = songs.map((song) => normalizeWords(song.getTitle()));
  const videos = results?.playlistKey === playlistKey ? results.videos : [];
  const availableVideos = videos.filter((video) =>
    !playlistVideoIds.has(video.id.videoId)
    && !titleMatchesPlaylist(video.snippet.title, playlistTitles),
  ).slice(0, 10);
  const error = failure?.playlistKey === playlistKey ? failure.message : '';
  const isLoading = loadingKey === playlistKey;

  useEffect(() => {
    if (!playlistKey) return;

    const controller = new AbortController();
    const currentPlaylistKey = playlistKey;
    const timeout = window.setTimeout(() => {
      setLoadingKey(currentPlaylistKey);
      void searchYouTubeSongs(searchQuery, controller.signal).then((nextVideos) => {
        if (controller.signal.aborted) return;
        setResults({
          playlistKey: currentPlaylistKey,
          videos: shuffledVideos(nextVideos),
        });
        setFailure(null);
      }).catch((searchError: unknown) => {
        if (controller.signal.aborted) return;
        setFailure({
          playlistKey: currentPlaylistKey,
          message: searchError instanceof Error
            ? searchError.message
            : 'No se pudieron cargar sugerencias.',
        });
      }).finally(() => {
        if (!controller.signal.aborted) setLoadingKey(null);
      });
    }, 0);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [playlistKey, searchQuery]);

  return (
    <section className="playlist-suggestions" aria-labelledby="playlist-suggestions-title">
      <div className="suggestions-heading">
        <div>
          <p className="eyebrow">PARA SEGUIR ESCUCHANDO</p>
          <h2 id="playlist-suggestions-title">Sugerencias</h2>
          <p className="suggestions-description">Selección aleatoria basada en todos los artistas de tu playlist.</p>
        </div>
        <span>{songs.length} en playlist</span>
      </div>
      {isLoading && <p className="suggestions-message" role="status">Buscando artistas y canciones similares…</p>}
      {!isLoading && error && <p className="form-error" role="alert">{error}</p>}
      {!isLoading && !error && songs.length > 0 && availableVideos.length === 0 && (
        <p className="suggestions-message" role="status">
          No hay sugerencias nuevas. Se excluyen las canciones que ya están en la playlist.
        </p>
      )}
      {songs.length === 0 && (
        <p className="suggestions-message">Añade canciones para recibir sugerencias relacionadas con sus artistas.</p>
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
