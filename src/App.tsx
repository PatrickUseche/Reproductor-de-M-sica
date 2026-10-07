import { useState } from 'react';
import { PlayerControls } from './components/PlayerControls';
import { PlaylistView } from './components/PlaylistView';
import { SongForm } from './components/SongForm';
import { YouTubeSearch } from './components/YouTubeSearch';
import { SongPlaylist } from './core/SongPlaylist';
import type { YouTubeVideo } from './services/youtube';
import { Song } from './types/Song';

/**
 * Ensambla la interfaz y coordina las acciones sobre la playlist mutable.
 * `refresh` sincroniza React después de que una operación cambia los nodos.
 */
export default function App() {
  // Mantiene la misma instancia de la lista durante el ciclo de vida del componente
  const [playlist] = useState<SongPlaylist>(() => new SongPlaylist());

  // Estado contador para notificar a React que repinte la pantalla
  const [, setVersion] = useState(0);
  const refresh = () => setVersion((v) => v + 1);

  /** Selecciona un nodo existente y actualiza el reproductor y la vista. */
  const handleSelectSong = (node: Parameters<SongPlaylist['setCurrentNode']>[0]) => {
    playlist.setCurrentNode(node);
    refresh();
  };

  /** Convierte un resultado de YouTube al modelo de canción y lo agrega al final. */
  const handleAddYouTubeSong = (video: YouTubeVideo) => {
    const song = new Song(
      crypto.randomUUID(),
      video.snippet.title,
      video.snippet.channelTitle,
      0,
      video.id.videoId,
      'youtube',
    );
    playlist.insertAtEnd(song);
    refresh();
  };

  return (
    <main className="app-shell">
      <header className="app-header">
        <p className="eyebrow">TU ESPACIO DE AUDIO</p>
        <h1>Reproductor de Música</h1>
        <p className="app-description">Organiza tu lista y elige qué escuchar.</p>
      </header>

      <section className="listening-layout" aria-label="Reproductor y lista de reproducción">
        <PlayerControls
          currentTrack={playlist.getCurrent()}
          onNext={() => { playlist.playNext(); refresh(); }}
          onPrevious={() => { playlist.playPrevious(); refresh(); }}
        />

        <PlaylistView
          nodes={playlist.toArray()}
          headNode={playlist.getHead()}
          tailNode={playlist.getTail()}
          currentNode={playlist.getCurrent()}
          onSelectSong={handleSelectSong}
        />
      </section>

      <section className="library-tools" aria-label="Administrar música">
        <SongForm
          onInsertStart={(song: Song) => { playlist.insertAtStart(song); refresh(); }}
          onInsertEnd={(song: Song) => { playlist.insertAtEnd(song); refresh(); }}
          onInsertPosition={(song: Song, pos: number) => { playlist.insertAtPosition(song, pos); refresh(); }}
          onDeletePosition={(pos: number) => { playlist.deleteAtPosition(pos); refresh(); }}
        />

        <YouTubeSearch onAddSong={handleAddYouTubeSong} />
      </section>
    </main>
  );
}