import type { Song } from '../types/Song';
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

export function serializePlaylist(songs: Song[], currentSongId: string | null): PlaylistSnapshot {
  return {
    songs: songs.map((song) => ({
      id: song.getId(),
      title: song.getTitle(),
      artist: song.getArtist(),
      duration: song.getDuration(),
      audioUrl: song.getAudioUrl(),
      source: song.getSource(),
    })),
    currentSongId,
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