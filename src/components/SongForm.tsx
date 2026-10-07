import { useState, type DragEvent } from 'react';

interface SongFormProps {
  onAddFiles: (files: File[]) => Promise<void>;
}

const audioFileExtension = /\.(aac|aif|aiff|flac|m4a|mp3|oga|ogg|opus|wav)$/i;

function isAudioFile(file: File) {
  return file.type.startsWith('audio/') || (!file.type && audioFileExtension.test(file.name));
}

/** Añade archivos de audio locales soltándolos directamente en la zona. */
export function SongForm({ onAddFiles }: SongFormProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleDrop = async (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    setMessage('');
    setError('');

    const droppedFiles = Array.from(event.dataTransfer.files);
    const audioFiles = droppedFiles.filter(isAudioFile);
    const rejectedCount = droppedFiles.length - audioFiles.length;

    if (audioFiles.length === 0) {
      setError('Suelta archivos de audio compatibles, como MP3, WAV, M4A u OGG.');
      return;
    }

    setIsProcessing(true);
    try {
      await onAddFiles(audioFiles);
      setMessage(`${audioFiles.length} ${audioFiles.length === 1 ? 'canción agregada' : 'canciones agregadas'} al final de la lista.`);
      if (rejectedCount > 0) {
        setError(`${rejectedCount} ${rejectedCount === 1 ? 'archivo no era' : 'archivos no eran'} de audio y no se agregó${rejectedCount === 1 ? '' : 'n'}.`);
      }
    } catch (addError) {
      setError(addError instanceof Error ? addError.message : 'No se pudieron agregar los archivos.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <section className="tool-panel" aria-labelledby="song-form-title">
      <h2 id="song-form-title">Agregar canciones locales</h2>
      <div
        className={`audio-dropzone${isDragging ? ' is-dragging' : ''}`}
        role="region"
        aria-label="Zona para arrastrar archivos de audio"
        onDragEnter={(event) => { event.preventDefault(); setIsDragging(true); }}
        onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = 'copy'; setIsDragging(true); }}
        onDragLeave={(event) => {
          const relatedTarget = event.relatedTarget;
          if (!(relatedTarget instanceof Node) || !event.currentTarget.contains(relatedTarget)) {
            setIsDragging(false);
          }
        }}
        onDrop={(event) => { void handleDrop(event); }}
      >
        <span className="audio-drop-icon" aria-hidden="true">↓</span>
        <strong>{isProcessing ? 'Agregando canciones…' : isDragging ? 'Suelta para agregar' : 'Arrastra tus archivos de audio aquí'}</strong>
        <span>MP3, WAV, M4A, OGG y otros formatos de audio</span>
      </div>
      <p className="audio-local-note">Los archivos solo estarán disponibles en esta pestaña; no se suben a la nube.</p>
      {message && <p className="account-message" role="status">{message}</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
    </section>
  );
}