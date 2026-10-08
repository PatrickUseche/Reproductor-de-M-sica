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

/** Permite elegir archivos locales o soltarlos en el panel compacto. */
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
    <section
      className={`tool-panel audio-import-panel${isDragging ? ' is-dragging' : ''}`}
      aria-labelledby="song-form-title"
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
      <div className="audio-import-heading">
        <div>
          <h2 id="song-form-title">Música local</h2>
          <p>Elige archivos o arrástralos aquí</p>
        </div>
        <button
          className="add-audio-button"
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isProcessing}
        >
          <span aria-hidden="true">＋</span>
          {isProcessing ? 'Procesando…' : 'Añadir'}
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
      </div>
      {isDragging && <p className="audio-drop-hint" role="status">Suelta los archivos para agregarlos</p>}
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
      <p className="audio-local-note">Los archivos se guardan solo en este navegador.</p>
      {message && <p className="account-message" role="status">{message}</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
    </section>
  );
}
