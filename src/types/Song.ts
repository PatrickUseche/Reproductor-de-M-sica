/**
 * Datos de una pista reproducible desde una URL directa o desde YouTube.
 * Para canciones de YouTube, `audioUrl` almacena el ID del video.
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

    /** Identificador único usado, entre otros lugares, como clave de React. */
    getId() {
        return this._id;
    }

    /** Título visible de la pista. */
    getTitle(){
        return this._title;
    }

    /** Nombre del artista o canal que aporta la pista. */
    getArtist(){
        return this._artist;
    }

    /** Duración en segundos; puede ser cero para resultados de YouTube. */
    getDuration(){
        return this._duration;
    }

    /** URL de audio directo o, para YouTube, el ID del video. */
    getAudioUrl(){
        return this._audioUrl;
    }

    /** Devuelve el proveedor que debe usar el reproductor. */
    getSource(){
        return this._source;
    }

    /** Devuelve el ID de YouTube o `null` si la pista es audio directo. */
    getYoutubeVideoId(){
        return this._source === 'youtube' ? this._audioUrl : null;
    }
}