class Song{
    private _id: string;
    private title: string;
    private artist: string;
    private duration: number;

    constructor(id: string, title: string, artist: string, duration: number){
        this._id = id;
        this.title = title;
        this.artist = artist;
        this.duration = duration;
    }
}