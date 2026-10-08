import { Song } from '../types/Song';

interface LocalAudioRecord {
  key: string;
  userId: string;
  songId: string;
  title: string;
  artist: string;
  duration: number;
  audio: Blob;
  addedAt: number;
}

interface LocalAudioFile {
  song: Song;
  file: Blob;
}

const databaseName = 'music-player-local-audio';
const databaseVersion = 1;
const audioStoreName = 'audio-files';
let databasePromise: Promise<IDBDatabase> | null = null;

function openDatabase(): Promise<IDBDatabase> {
  if (databasePromise) return databasePromise;

  databasePromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, databaseVersion);

    request.onupgradeneeded = () => {
      const database = request.result;
      if (database.objectStoreNames.contains(audioStoreName)) return;

      const store = database.createObjectStore(audioStoreName, { keyPath: 'key' });
      store.createIndex('userId', 'userId');
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      databasePromise = null;
      reject(request.error ?? new Error('No se pudo abrir el almacenamiento local.'));
    };
    request.onblocked = () => {
      databasePromise = null;
      reject(new Error('El almacenamiento local está bloqueado por otra pestaña.'));
    };
  });

  return databasePromise;
}

function transactionComplete(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('Falló una operación de almacenamiento local.'));
    transaction.onabort = () => reject(transaction.error ?? new Error('Se canceló una operación de almacenamiento local.'));
  });
}

/** Stores a user's local audio blobs and metadata in IndexedDB. */
export async function saveLocalAudio(userId: string, files: LocalAudioFile[]): Promise<void> {
  if (files.length === 0) return;

  const database = await openDatabase();
  const transaction = database.transaction(audioStoreName, 'readwrite');
  const completion = transactionComplete(transaction);
  const store = transaction.objectStore(audioStoreName);
  const addedAt = Date.now();

  files.forEach(({ song, file }, index) => {
    store.put({
      key: `${userId}:${song.getId()}`,
      userId,
      songId: song.getId(),
      title: song.getTitle(),
      artist: song.getArtist(),
      duration: song.getDuration(),
      audio: file,
      addedAt: addedAt + index / files.length,
    } satisfies LocalAudioRecord);
  });

  await completion;
}

/** Restores a user's local audio records and creates playable object URLs. */
export async function loadLocalAudio(userId: string): Promise<Song[]> {
  const database = await openDatabase();
  const transaction = database.transaction(audioStoreName, 'readonly');
  const completion = transactionComplete(transaction);
  const request = transaction.objectStore(audioStoreName)
    .index('userId')
    .getAll(userId) as IDBRequest<LocalAudioRecord[]>;
  const recordsPromise = new Promise<LocalAudioRecord[]>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('No se pudo leer el audio local.'));
  });
  const [records] = await Promise.all([recordsPromise, completion]);

  return records
    .sort((left, right) => left.addedAt - right.addedAt)
    .map((record) => new Song(
      record.songId,
      record.title,
      record.artist,
      record.duration,
      URL.createObjectURL(record.audio),
    ));
}

/** Deletes one user's local audio record from IndexedDB. */
export async function deleteLocalAudio(userId: string, songId: string): Promise<void> {
  const database = await openDatabase();
  const transaction = database.transaction(audioStoreName, 'readwrite');
  const completion = transactionComplete(transaction);
  transaction.objectStore(audioStoreName).delete(`${userId}:${songId}`);
  await completion;
}
