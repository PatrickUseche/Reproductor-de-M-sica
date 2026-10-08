import { Song } from "../types/Song"

/** A doubly linked list node containing a song. */
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