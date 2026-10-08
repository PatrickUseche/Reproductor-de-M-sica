export interface YouTubePlayer {
  destroy: () => void;
  getIframe: () => HTMLIFrameElement;
  playVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
}

export interface YouTubePlayerEvent {
  data: number;
  target: YouTubePlayer;
}

export interface YouTubeIframeApi {
  PlayerState: {
    ENDED: number;
  };
  Player: new (
    element: HTMLElement,
    options: {
      width: string;
      height: string;
      host: string;
      videoId: string;
      playerVars: Record<string, number | string>;
      events: {
        onReady: (event: { target: YouTubePlayer }) => void;
        onStateChange: (event: YouTubePlayerEvent) => void;
        onError: () => void;
      };
    },
  ) => YouTubePlayer;
}

declare global {
  interface Window {
    YT?: YouTubeIframeApi;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiLoadPromise: Promise<YouTubeIframeApi> | null = null;

export function loadYouTubeIframeApi(): Promise<YouTubeIframeApi> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (apiLoadPromise) return apiLoadPromise;

  apiLoadPromise = new Promise((resolve, reject) => {
    const previousReadyHandler = window.onYouTubeIframeAPIReady;
    const scriptUrl = 'https://www.youtube.com/iframe_api';
    const script = document.querySelector<HTMLScriptElement>(`script[src="${scriptUrl}"]`);
    const timeout = window.setTimeout(() => {
      window.onYouTubeIframeAPIReady = previousReadyHandler;
      apiLoadPromise = null;
      reject(new Error('YouTube tardó demasiado en cargar el reproductor.'));
    }, 15000);

    window.onYouTubeIframeAPIReady = () => {
      window.clearTimeout(timeout);
      window.onYouTubeIframeAPIReady = previousReadyHandler;
      if (window.YT?.Player) {
        resolve(window.YT);
      } else {
        apiLoadPromise = null;
        reject(new Error('YouTube no pudo iniciar el reproductor.'));
      }
    };

    if (!script) {
      const apiScript = document.createElement('script');
      apiScript.src = scriptUrl;
      apiScript.async = true;
      apiScript.onerror = () => {
        window.clearTimeout(timeout);
        window.onYouTubeIframeAPIReady = previousReadyHandler;
        apiLoadPromise = null;
        reject(new Error('No se pudo cargar el reproductor de YouTube.'));
      };
      document.head.appendChild(apiScript);
    } else {
      script.addEventListener('error', () => {
        window.clearTimeout(timeout);
        window.onYouTubeIframeAPIReady = previousReadyHandler;
        apiLoadPromise = null;
        reject(new Error('No se pudo cargar el reproductor de YouTube.'));
      }, { once: true });
    }
  });

  return apiLoadPromise;
}