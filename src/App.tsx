import { useState } from 'react';
import { SongPlaylist } from './core/SongPlaylist';
import { Song } from './types/Song';
import { PlayerControls } from './components/PlayerControls';
import { SongForm } from './components/SongForm';
import { PlaylistView } from './components/PlaylistView';
import { YouTubeSearch } from './components/YouTubeSearch';
import type { YouTubeVideo } from './services/youtube';

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

  /** Convierte un resultado de YouTube al modelo de canción y lo selecciona. */
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
    playlist.setCurrentNode(playlist.getTail());
    refresh();
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif', maxWidth: '900px', margin: '0 auto' }}>
      <h1>Reproductor de Música</h1>

      <PlayerControls
        currentTrack={playlist.getCurrent()}
        onNext={() => { playlist.playNext(); refresh(); }}
        onPrevious={() => { playlist.playPrevious(); refresh(); }}
      />

      <SongForm
        onInsertStart={(song: Song) => { playlist.insertAtStart(song); refresh(); }}
        onInsertEnd={(song: Song) => { playlist.insertAtEnd(song); refresh(); }}
        onInsertPosition={(song: Song, pos: number) => { playlist.insertAtPosition(song, pos); refresh(); }}
        onDeletePosition={(pos: number) => { playlist.deleteAtPosition(pos); refresh(); }}
      />

      <YouTubeSearch onAddSong={handleAddYouTubeSong} />

      <PlaylistView
        nodes={playlist.toArray()}
        headNode={playlist.getHead()}
        tailNode={playlist.getTail()}
        currentNode={playlist.getCurrent()}
        onSelectSong={handleSelectSong}
      />
    </div>
  );
}