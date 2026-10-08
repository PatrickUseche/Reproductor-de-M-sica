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
  };
}

/**
 * Busca hasta diez videos de la categoría Música que permiten inserción.
 * La clave se toma del entorno de Vite y nunca debe escribirse en el código.
 */
export async function searchYouTubeSongs(query: string, signal?: AbortSignal): Promise<YouTubeVideo[]> {
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
    throw new Error(result.error?.message ?? `La búsqueda falló (${response.status}).`);
  }

  return result.items ?? [];
}
