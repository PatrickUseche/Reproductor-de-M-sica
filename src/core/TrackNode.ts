import { Song } from "../types/Song"

/** Nodo de una lista doblemente enlazada que contiene una canción. */
export class TrackNode{
    content: Song;
    nextSong: TrackNode | null;
    previousSong: TrackNode | null;

    constructor(content: Song){
        this.content = content;
        this.nextSong = null;
        this.previousSong = null;
    }
}