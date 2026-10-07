import { Song } from '../types/Song';
import { supabase } from './supabase';

export interface SongSnapshot {
  id: string;
  title: string;
  artist: string;
  duration: number;
  audioUrl: string;
  source: 'audio' | 'youtube';
}

export interface PlaylistSnapshot {
  songs: SongSnapshot[];
  currentSongId: string | null;
}

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

export async function savePlaylist(userId: string, snapshot: PlaylistSnapshot): Promise<void> {
  if (!supabase) throw new Error('Supabase no está configurado.');

  const { error } = await supabase.from('user_playlists').upsert({
    user_id: userId,
    playlist_data: snapshot,
    updated_at: new Date().toISOString(),
  });

  if (error) throw error;
}

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