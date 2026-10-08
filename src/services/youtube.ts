/** Campos de YouTube Data API v3 que usa el buscador. */
export interface YouTubeVideo {
  id: {
    videoId: string;
  };
  snippet: {
    title: string;
    channelTitle: string;
    thumbnails: {
      medium?: {
        url: string;
      };
      default?: {
        url: string;
      };
    };
  };
}

/** Respuesta de búsqueda de YouTube con error opcional de la API. */
interface YouTubeSearchResponse {
  items?: YouTubeVideo[];
  error?: {
    message?: string;
    errors?: Array<{
      reason?: string;
    }>;
  };
}

interface CachedSearchResult {
  videos: YouTubeVideo[];
  cachedAt: number;
}

const searchCache = new Map<string, CachedSearchResult>();
const searchCacheTtlMs = 30 * 60 * 1000;
const maxCachedSearches = 50;

function cachedVideosFor(query: string) {
  const cacheKey = query.trim().toLocaleLowerCase().replace(/\s+/g, ' ');
  const cached = searchCache.get(cacheKey);
  if (!cached) return null;
  if (Date.now() - cached.cachedAt >= searchCacheTtlMs) {
    searchCache.delete(cacheKey);
    return null;
  }

  searchCache.delete(cacheKey);
  searchCache.set(cacheKey, cached);
  return cached.videos;
}

function cacheSearchResults(query: string, videos: YouTubeVideo[]) {
  const cacheKey = query.trim().toLocaleLowerCase().replace(/\s+/g, ' ');
  searchCache.delete(cacheKey);
  searchCache.set(cacheKey, { videos, cachedAt: Date.now() });
  if (searchCache.size > maxCachedSearches) {
    const oldestKey = searchCache.keys().next().value;
    if (oldestKey !== undefined) searchCache.delete(oldestKey);
  }
}

/**
 * Busca hasta diez videos de la categoría Música que permiten inserción.
 * Reutiliza resultados recientes y no vuelve a consultar si ya hay una respuesta
 * en caché para esta búsqueda. La clave se toma del entorno de Vite.
 */
export async function searchYouTubeSongs(query: string, signal?: AbortSignal): Promise<YouTubeVideo[]> {
  const cachedVideos = cachedVideosFor(query);
  if (cachedVideos) return cachedVideos;

  const apiKey = import.meta.env.VITE_YOUTUBE_API_KEY;
  if (!apiKey) {
    throw new Error(
      'Falta configurar VITE_YOUTUBE_API_KEY. Añádela en el archivo .env.local y reinicia npm run dev.',
    );
  }

  const params = new URLSearchParams({
    part: 'snippet',
    q: query,
    type: 'video',
    videoCategoryId: '10',
    videoEmbeddable: 'true',
    maxResults: '10',
    key: apiKey,
  });
  const response = await fetch(
    `https://www.googleapis.com/youtube/v3/search?${params.toString()}`,
    { signal },
  );
  const result = (await response.json()) as YouTubeSearchResponse;

  if (!response.ok) {
    const reason = result.error?.errors?.[0]?.reason;
    if (reason === 'quotaExceeded' || reason === 'dailyLimitExceeded') {
      throw new Error('Se agotó la cuota diaria de búsquedas de YouTube. Inténtalo de nuevo después del reinicio de la cuota.');
    }
    throw new Error(result.error?.message ?? `La búsqueda falló (${response.status}).`);
  }

  const videos = result.items ?? [];
  cacheSearchResults(query, videos);
  return videos;
}
