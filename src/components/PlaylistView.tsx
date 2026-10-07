import React from 'react';
import { TrackNode } from '../core/TrackNode';

interface PlaylistViewProps {
  nodes: TrackNode[];
  headNode: TrackNode | null;
  tailNode: TrackNode | null;
  currentNode: TrackNode | null;
  onSelectSong: (node: TrackNode) => void;
  onDeleteSong: (position: number) => void;
  onMoveSong: (position: number, direction: -1 | 1) => void;
}

/** Representa los enlaces y la selección actual de la lista doblemente enlazada. */
export const PlaylistView: React.FC<PlaylistViewProps> = ({
  nodes,
  headNode,
  tailNode,
  currentNode,
  onSelectSong,
  onDeleteSong,
  onMoveSong,
}) => {
  if (nodes.length === 0) {
    return (
      <section className="playlist-panel" aria-labelledby="playlist-title">
        <div className="playlist-heading">
          <div>
            <p className="eyebrow">EN COLA</p>
            <h2 id="playlist-title">Lista de reproducción</h2>
          </div>
          <span className="track-count">0 pistas</span>
        </div>
        <div className="playlist-empty" role="status">
          <span className="empty-mark" aria-hidden="true">+</span>
          <strong>Tu lista está vacía</strong>
          <p>Agrega una canción desde tus archivos o busca en YouTube.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="playlist-panel" aria-labelledby="playlist-title">
      <div className="playlist-heading">
        <div>
          <p className="eyebrow">EN COLA</p>
          <h2 id="playlist-title">Lista de reproducción</h2>
        </div>
        <span className="track-count">{nodes.length} {nodes.length === 1 ? 'pista' : 'pistas'}</span>
      </div>
      <ol className="playlist-list">
        {nodes.map((node, index) => {
          const isHead = node === headNode;
          const isTail = node === tailNode;
          const isCurrent = node === currentNode;
          const song = node.content;

          return (
            <li className={`playlist-item${isCurrent ? ' is-current' : ''}`} key={song.getId()}>
              <button
                className="playlist-track"
                type="button"
                onClick={() => onSelectSong(node)}
                aria-current={isCurrent ? 'true' : undefined}
                aria-label={`Seleccionar ${song.getTitle()} de ${song.getArtist()}`}
              >
                <span className="track-index">{String(index + 1).padStart(2, '0')}</span>
                <span className="track-copy">
                  <strong>{song.getTitle()}</strong>
                  <span>{song.getArtist()}</span>
                </span>
                <span className="track-tags">
                  {isHead && <span className="track-tag tag-head">INICIO</span>}
                  {isTail && <span className="track-tag tag-tail">FINAL</span>}
                  {isCurrent && <span className="track-tag tag-current">SELECCIONADA</span>}
                </span>
              </button>
              <div className="track-row-actions">
                <button
                  className="move-track-button"
                  type="button"
                  title={`Mover ${song.getTitle()} arriba`}
                  aria-label={`Mover ${song.getTitle()} arriba`}
                  disabled={index === 0}
                  onClick={() => onMoveSong(index, -1)}
                >
                  ↑
                </button>
                <button
                  className="move-track-button"
                  type="button"
                  title={`Mover ${song.getTitle()} abajo`}
                  aria-label={`Mover ${song.getTitle()} abajo`}
                  disabled={index === nodes.length - 1}
                  onClick={() => onMoveSong(index, 1)}
                >
                  ↓
                </button>
                <button
                  className="remove-track-button"
                  type="button"
                  title={`Quitar ${song.getTitle()} de la lista`}
                  aria-label={`Quitar ${song.getTitle()} de la lista`}
                  onClick={() => {
                    if (isCurrent && !window.confirm(`¿Quitar "${song.getTitle()}"? Se seleccionará otra canción.`)) {
                      return;
                    }
                    onDeleteSong(index);
                  }}
                >
                  Quitar
                </button>
              </div>
            </li>
          );
        })}
      </ol>
      <p className="playlist-hint">Selecciona una pista para cargarla en el reproductor.</p>
    </section>
  );
};