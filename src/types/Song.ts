/**
 * Data for a track playable from a direct URL or YouTube.
 * For YouTube tracks, `audioUrl` stores the video ID.
 */
export class Song{
    private _id: string;
    private _title: string;
    private _artist: string;
    private _duration: number;
    private _audioUrl: string;
    private _source: 'audio' | 'youtube';

        constructor(
            id: string,
            title: string,
            artist: string,
            duration: number,
            audioUrl: string,
            source: 'audio' | 'youtube' = 'audio',
        ){
        this._id = id;
        this._title = title;
        this._artist = artist;
        this._duration = duration;
        this._audioUrl = audioUrl;
        this._source = source;

    }

    /** Unique identifier, also used as a React key. */
    getId() {
        return this._id;
    }

    /** Track title displayed in the interface. */
    getTitle(){
        return this._title;
    }

    /** Name of the artist or channel providing the track. */
    getArtist(){
        return this._artist;
    }

    /** Duration in seconds; may be zero for YouTube search results. */
    getDuration(){
        return this._duration;
    }

    /** Direct audio URL or, for YouTube, the video ID. */
    getAudioUrl(){
        return this._audioUrl;
    }

    /** Returns the source used by the player. */
    getSource(){
        return this._source;
    }

    /** Returns the YouTube ID, or `null` for direct audio tracks. */
    getYoutubeVideoId(){
        return this._source === 'youtube' ? this._audioUrl : null;
    }
}