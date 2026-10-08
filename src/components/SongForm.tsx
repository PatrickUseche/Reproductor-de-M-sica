import { useState, type DragEvent } from 'react';

export interface AudioFileFailure {
  fileName: string;
  message: string;
}

export interface AudioFileImportResult {
  added: number;
  failures: AudioFileFailure[];
}

interface SongFormProps {
  onAddFiles: (
    files: File[],
    onProgress: (processed: number, total: number) => void,
  ) => Promise<AudioFileImportResult>;
}

const audioFileExtension = /\.(aac|aif|aiff|flac|m4a|mp3|oga|ogg|opus|wav)$/i;

function isAudioFile(file: File) {
  return file.type.startsWith('audio/') || (!file.type && audioFileExtension.test(file.name));
}

/** Añade archivos de audio locales soltándolos directamente en la zona. */
export function SongForm({ onAddFiles }: SongFormProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState({ processed: 0, total: 0 });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleDrop = async (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    if (isProcessing) return;
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
    setProgress({ processed: 0, total: audioFiles.length });
    try {
      const result = await onAddFiles(audioFiles, (processed, total) => {
        setProgress({ processed, total });
      });
      if (result.added > 0) {
        setMessage(`${result.added} ${result.added === 1 ? 'canción agregada' : 'canciones agregadas'} al final de la lista.`);
      }
      const failures = result.failures.map(({ fileName, message: failureMessage }) =>
        `- ${fileName}: ${failureMessage}`,
      );
      if (rejectedCount > 0) {
        failures.unshift(`${rejectedCount} ${rejectedCount === 1 ? 'archivo no era' : 'archivos no eran'} de audio compatible.`);
      }
      if (failures.length > 0) {
        setError(`No se agregaron algunos archivos:\n${failures.join('\n')}`);
      } else if (result.added === 0) {
        setError('No se pudo agregar ningún archivo de audio.');
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
        aria-busy={isProcessing}
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
        <strong>
          {isProcessing
            ? `Procesando ${progress.processed} de ${progress.total} archivos…`
            : isDragging
              ? 'Suelta para agregar'
              : 'Arrastra tus archivos de audio aquí'}
        </strong>
        <span>MP3, WAV, M4A, OGG y otros formatos de audio</span>
      </div>
      {isProcessing && (
        <progress
          className="audio-import-progress"
          value={progress.processed}
          max={progress.total}
          aria-label="Progreso de importación de archivos"
        />
      )}
      <p className="audio-local-note">Los archivos solo estarán disponibles en esta pestaña; no se suben a la nube.</p>
      {message && <p className="account-message" role="status">{message}</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
    </section>
  );
}