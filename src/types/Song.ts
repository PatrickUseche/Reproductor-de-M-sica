class Song{
    private _id: string;
    private _title: string;
    private _artist: string;
    private _duration: number;

    constructor(id: string, title: string, artist: string, duration: number){
        this._id = id;
        this._title = title;
        this._artist = artist;
        this._duration = duration;
    }

    getId() {
        return this._id;
    }

    getTitle(){
        return this._title;
    }

    getArtist(){
        return this._artist;
    }
    
    getDuration(){
        return this._duration;
    }
}