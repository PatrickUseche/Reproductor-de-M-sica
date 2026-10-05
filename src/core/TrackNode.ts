import { Song } from "../types/Song"
class TrackNode{
    content: Song;
    nextSong: TrackNode | null;
    previousSong: TrackNode | null;

    constructor(content: Song){
        this.content = content;
        this.nextSong = null;
        this.previousSong = null;
    }
}