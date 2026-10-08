import { Song } from '../types/Song';
import { supabase } from './supabase';

/** Serializable track data stored in the user's remote playlist. */
export interface SongSnapshot {
  id: string;
  title: string;
  artist: string;
  duration: number;
  audioUrl: string;
  source: 'audio' | 'youtube';
}

/** Serializable playlist data, including the currently selected track ID. */
export interface PlaylistSnapshot {
  songs: SongSnapshot[];
  currentSongId: string | null;
}

/** Recreates song models from a stored playlist snapshot. */
export function deserializePlaylist(snapshot: PlaylistSnapshot | null): Song[] {
  return snapshot?.songs.map((item) => new Song(
    item.id,
    item.title,
    item.artist,
    item.duration,
    item.audioUrl,
    item.source,
  )) ?? [];
}

/** Converts songs to a remote snapshot, excluding browser-local blob URLs. */
export function serializePlaylist(songs: Song[], currentSongId: string | null): PlaylistSnapshot {
  const persistentSongs = songs.filter((song) => !song.getAudioUrl().startsWith('blob:'));
  const persistentSongIds = new Set(persistentSongs.map((song) => song.getId()));

  return {
    songs: persistentSongs.map((song) => ({
      id: song.getId(),
      title: song.getTitle(),
      artist: song.getArtist(),
      duration: song.getDuration(),
      audioUrl: song.getAudioUrl(),
      source: song.getSource(),
    })),
    currentSongId: currentSongId && persistentSongIds.has(currentSongId) ? currentSongId : null,
  };
}

/** Loads one user's playlist snapshot from Supabase. */
export async function loadPlaylist(userId: string): Promise<PlaylistSnapshot | null> {
  if (!supabase) throw new Error('Supabase no está configurado.');

  const { data, error } = await supabase
    .from('user_playlists')
    .select('playlist_data')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;
  return (data?.playlist_data as PlaylistSnapshot | undefined) ?? null;
}

/** Saves or updates one user's playlist snapshot in Supabase. */
export async function savePlaylist(userId: string, snapshot: PlaylistSnapshot): Promise<void> {
  if (!supabase) throw new Error('Supabase no está configurado.');

  const { error } = await supabase.from('user_playlists').upsert({
    user_id: userId,
    playlist_data: snapshot,
    updated_at: new Date().toISOString(),
  });

  if (error) throw error;
}

/** Subscribes to realtime playlist changes for one user and returns the channel. */
export function subscribeToPlaylist(
  userId: string,
  onUpdate: (snapshot: PlaylistSnapshot) => void,
  onStatus: (status: string) => void,
) {
  if (!supabase) throw new Error('Supabase no está configurado.');

  return supabase
    .channel(`user-playlist:${userId}`)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'user_playlists',
      filter: `user_id=eq.${userId}`,
    }, (payload) => {
      const row = payload.new as { playlist_data?: PlaylistSnapshot };
      if (row.playlist_data) onUpdate(row.playlist_data);
    })
    .subscribe((status) => onStatus(status));
}