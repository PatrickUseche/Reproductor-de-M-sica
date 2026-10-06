import React from 'react';
import { TrackNode } from '../core/TrackNode';

interface PlaylistViewProps {
  nodes: TrackNode[];
  headNode: TrackNode | null;
  tailNode: TrackNode | null;
  currentNode: TrackNode | null;
  onSelectSong: (node: TrackNode) => void;
}

/** Representa los enlaces y la selección actual de la lista doblemente enlazada. */
export const PlaylistView: React.FC<PlaylistViewProps> = ({
  nodes,
  headNode,
  tailNode,
  currentNode,
  onSelectSong,
}) => {
  if (nodes.length === 0) {
    return <p>La lista de reproducción está vacía.</p>;
  }

  return (
    <div>
      <h3>Estructura Visual de la Lista Doblemente Enlazada</h3>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflowX: 'auto', padding: '10px 0' }}>
        {nodes.map((node, index) => {
          const isHead = node === headNode;
          const isTail = node === tailNode;
          const isCurrent = node === currentNode;
          const song = node.content;

          return (
            <React.Fragment key={song.getId()}>
              {/* Tarjeta del Nodo */}
              <div
                onClick={() => onSelectSong(node)}
                style={{
                  border: isCurrent ? '3px solid #4CAF50' : '1px solid #aaa',
                  borderRadius: '8px',
                  padding: '10px',
                  minWidth: '150px',
                  backgroundColor: isCurrent ? '#e8f5e9' : '#fff',
                  boxShadow: '0 2px 5px rgba(0,0,0,0.1)',
                  cursor: 'pointer'
                }}
              >
                <div style={{ display: 'flex', gap: '5px', marginBottom: '5px' }}>
                  {isHead && <span style={{ background: '#2196F3', color: 'white', fontSize: '10px', padding: '2px 5px', borderRadius: '3px' }}>CABEZA</span>}
                  {isTail && <span style={{ background: '#9C27B0', color: 'white', fontSize: '10px', padding: '2px 5px', borderRadius: '3px' }}>COLA</span>}
                </div>

                <strong>[{index}] {song.getTitle()}</strong>
                <p style={{ margin: '5px 0', fontSize: '12px' }}>{song.getArtist()}</p>

                {isCurrent && <small style={{ color: '#2e7d32', fontWeight: 'bold' }}>▶ SONANDO</small>}
              </div>

              {/* Conector bidireccional entre nodos */}
              {index < nodes.length - 1 && (
                <span style={{ fontSize: '20px', fontWeight: 'bold', color: '#666' }}>
                  &lt;---&gt;
                </span>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};