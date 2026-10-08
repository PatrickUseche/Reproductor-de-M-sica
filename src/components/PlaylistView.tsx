import React, { useRef, useState } from 'react';
import { TrackNode } from '../core/TrackNode';

interface PlaylistViewProps {
  nodes: TrackNode[];
  headNode: TrackNode | null;
  tailNode: TrackNode | null;
  currentNode: TrackNode | null;
  onSelectSong: (node: TrackNode) => void;
  onDeleteSong: (position: number) => void;
  onMoveSong: (fromPosition: number, toPosition: number) => void;
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
  const [searchQuery, setSearchQuery] = useState('');
  const [draggedSongId, setDraggedSongId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const draggedSongIdRef = useRef<string | null>(null);
  const normalizedQuery = searchQuery.trim().toLocaleLowerCase();
  const filteredNodes = nodes
    .map((node, index) => ({ node, index }))
    .filter(({ node }) => normalizedQuery === ''
      || node.content.getTitle().toLocaleLowerCase().includes(normalizedQuery)
      || node.content.getArtist().toLocaleLowerCase().includes(normalizedQuery));

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
        <span className="track-count">
          {normalizedQuery
            ? `${filteredNodes.length} de ${nodes.length} pistas`
            : `${nodes.length} ${nodes.length === 1 ? 'pista' : 'pistas'}`}
        </span>
      </div>
      <label className="playlist-search">
        <span>Buscar en la lista</span>
        <input
          type="search"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="Título o artista"
          aria-label="Buscar en la playlist por título o artista"
        />
      </label>
      {filteredNodes.length > 0 ? (
        <ol className="playlist-list">
        {filteredNodes.map(({ node, index }) => {
          const isHead = node === headNode;
          const isTail = node === tailNode;
          const isCurrent = node === currentNode;
          const song = node.content;

          return (
            <li
              className={`playlist-item${isCurrent ? ' is-current' : ''}${draggedSongId === song.getId() ? ' is-dragging' : ''}${dropTargetId === song.getId() ? ' is-drop-target' : ''}`}
              key={song.getId()}
              onDragOver={(event) => {
                event.preventDefault();
                setDropTargetId(song.getId());
              }}
              onDragLeave={(event) => {
                const relatedTarget = event.relatedTarget;
                if (!(relatedTarget instanceof Node) || !event.currentTarget.contains(relatedTarget)) {
                  setDropTargetId(null);
                }
              }}
              onDrop={(event) => {
                event.preventDefault();
                const draggedId = draggedSongIdRef.current
                  || event.dataTransfer.getData('text/plain');
                const fromPosition = nodes.findIndex((item) => item.content.getId() === draggedId);
                if (fromPosition >= 0 && fromPosition !== index) onMoveSong(fromPosition, index);
                draggedSongIdRef.current = null;
                setDraggedSongId(null);
                setDropTargetId(null);
              }}
            >
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
                  className="reorder-track-button"
                  type="button"
                  draggable
                  title={`Arrastrar ${song.getTitle()} para cambiar su posición`}
                  aria-label={`Arrastrar ${song.getTitle()} para cambiar su posición`}
                  onDragStart={(event) => {
                    draggedSongIdRef.current = song.getId();
                    setDraggedSongId(song.getId());
                    event.dataTransfer.effectAllowed = 'move';
                    event.dataTransfer.setData('text/plain', song.getId());
                  }}
                  onDragEnd={() => {
                    draggedSongIdRef.current = null;
                    setDraggedSongId(null);
                    setDropTargetId(null);
                  }}
                >
                  <svg viewBox="0 0 20 20" aria-hidden="true">
                    <circle cx="7" cy="5" r="1.25" />
                    <circle cx="13" cy="5" r="1.25" />
                    <circle cx="7" cy="10" r="1.25" />
                    <circle cx="13" cy="10" r="1.25" />
                    <circle cx="7" cy="15" r="1.25" />
                    <circle cx="13" cy="15" r="1.25" />
                  </svg>
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
      ) : (
        <div className="playlist-filter-empty" role="status">
          <strong>No se encontraron canciones</strong>
          <p>Prueba con otro título o artista.</p>
        </div>
      )}
      <p className="playlist-hint">Arrastra el control de puntos para cambiar el orden; selecciona una pista para cargarla.</p>
    </section>
  );
};