import { useRef, useState, type DragEvent } from 'react';

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

/** Allows users to select local files or drop them onto the compact button. */
export function SongForm({ onAddFiles }: SongFormProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState({ processed: 0, total: 0 });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleFiles = async (selectedFiles: File[]) => {
    if (isProcessing || selectedFiles.length === 0) return;
    setMessage('');
    setError('');

    const audioFiles = selectedFiles.filter(isAudioFile);
    const rejectedCount = selectedFiles.length - audioFiles.length;
    if (audioFiles.length === 0) {
      setError('Selecciona archivos de audio compatibles, como MP3, WAV, M4A u OGG.');
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

  const handleDrop = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    setIsDragging(false);
    void handleFiles(Array.from(event.dataTransfer.files));
  };

  return (
    <div
      className={`audio-import-widget${isDragging ? ' is-dragging' : ''}`}
      aria-label="Agregar música local"
      aria-busy={isProcessing}
      onDragEnter={(event) => { event.preventDefault(); setIsDragging(true); }}
      onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = 'copy'; setIsDragging(true); }}
      onDragLeave={(event) => {
        const relatedTarget = event.relatedTarget;
        if (!(relatedTarget instanceof Node) || !event.currentTarget.contains(relatedTarget)) {
          setIsDragging(false);
        }
      }}
      onDrop={handleDrop}
    >
      <button
        className="add-audio-button"
        type="button"
        title="Añadir canciones locales"
        aria-label={isProcessing ? 'Procesando archivos de audio' : 'Añadir canciones locales'}
        onClick={() => fileInputRef.current?.click()}
        disabled={isProcessing}
      >
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <path d="M11 2v11.1a3.2 3.2 0 1 1-2-3V5l8-2v10.1a3.2 3.2 0 1 1-2-3V2.5L11 4v-2Z" />
          <path d="M3 6h3M4.5 4.5v3" />
        </svg>
        <span>{isProcessing ? 'Importando' : 'Añadir canción local'}</span>
      </button>
      <input
        ref={fileInputRef}
        className="visually-hidden"
        type="file"
        accept="audio/*,.aac,.aif,.aiff,.flac,.m4a,.mp3,.oga,.ogg,.opus,.wav"
        multiple
        aria-label="Seleccionar archivos de audio"
        onChange={(event) => {
          const selectedFiles = Array.from(event.currentTarget.files ?? []);
          event.currentTarget.value = '';
          void handleFiles(selectedFiles);
        }}
      />
      {isDragging && <span className="audio-drop-hint" role="status">Suelta aquí</span>}
      {isProcessing && (
        <div className="audio-import-progress-wrap">
          <span>Procesando {progress.processed} de {progress.total}</span>
          <progress
            className="audio-import-progress"
            value={progress.processed}
            max={progress.total}
            aria-label="Progreso de importación de archivos"
          />
        </div>
      )}
      {message && <span className="audio-import-feedback" role="status">{message}</span>}
      {error && <span className="audio-import-feedback is-error" role="alert">{error}</span>}
    </div>
  );
}
