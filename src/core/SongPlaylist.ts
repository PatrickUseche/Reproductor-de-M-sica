import { Song} from "../types/Song";
import { TrackNode } from "./TrackNode";

/**
 * Lista doblemente enlazada de canciones con referencias a cabeza, cola
 * y pista actual. Las posiciones usan índices desde cero.
 */
export class SongPlaylist{
    private _head: TrackNode | null;
    private _tail: TrackNode | null;
    private _current: TrackNode | null;
    private _size: number;

    constructor(){
        this._head = null;
        this._tail = null;
        this._current = null;
        this._size = 0;
    }

    /** Devuelve el primer nodo o `null` cuando la lista está vacía. */
    getHead(){
        return this._head;
    }

    /** Devuelve el último nodo o `null` cuando la lista está vacía. */
    getTail(){
        return this._tail;
    }

    /** Devuelve el nodo seleccionado actualmente. */
    getCurrent(){
        return this._current;
    }

    /** Devuelve el número de canciones de la lista. */
    getSize(){
        return this._size;
    }

    /** Inserta una canción al comienzo y la convierte en actual si es la primera. */
    insertAtStart(song: Song){
        const newNode: TrackNode = new TrackNode(song);
        if (this._head === null){
            this._head = newNode;
            this._tail = newNode;
            this._current = newNode;
        }else{
            newNode.nextSong = this._head;
            this._head.previousSong = newNode;
            this._head = newNode;
        }
        this._size++;
    }

    /** Inserta una canción al final y la convierte en actual si es la primera. */
    insertAtEnd(song: Song){
        const newNode: TrackNode = new TrackNode(song);
        if (this._tail === null){
            this._head = newNode;
            this._tail = newNode;
            this._current = newNode;
        }else{
            newNode.previousSong = this._tail;
            this._tail.nextSong = newNode;
            this._tail = newNode;
        }
        this._size++;
    }

    /** Inserta en el índice indicado; devuelve `false` si queda fuera de rango. */
    insertAtPosition(song: Song, position: number){
        if (position < 0 || position > this._size){
            console.log("Posición fuera de rango.");
            return false;
        }

        if (position === 0){
            this.insertAtStart(song);
            return true;
        }

        if (position === this._size){
            this.insertAtEnd(song);
            return true;
        }

        let current = this._head;
        for (let i = 0; i < position; i++){
            current = current!.nextSong;
        }

        const newNode = new TrackNode(song);
        const previous = current!.previousSong;
        newNode.previousSong = previous;
        newNode.nextSong = current;
        previous!.nextSong = newNode;
        current!.previousSong = newNode;
        this._size++;
        return true;
    }

    /** Elimina la cabeza y devuelve `false` si la lista ya estaba vacía. */
    deleteAtStart(){
        if(this._size === 0){
            console.log("La lista de reproducción esta vacia.")
            return false;
        }

        if(this._size === 1){
            this._head = null;
            this._tail = null;
            this._current = null;
            this._size = 0;
            return true;
        }

        const oldHead = this._head;
        if (oldHead === null) {
            return false;
        }

        this._head = oldHead.nextSong;
        if (this._head !== null) {
            this._head.previousSong = null;
        }

        if (this._current === oldHead) {
            this._current = this._head;
        }

        this._size--;
        return true;
    }

    /** Elimina la cola y devuelve `false` si la lista ya estaba vacía. */
    deleteAtEnd(){
        if(this._size === 0){
            console.log("La lista de reproducción esta vacia.")
            return false;
        }

        if(this._size === 1){
            this._head = null;
            this._tail = null;
            this._current = null;
            this._size = 0;
            return true;
        }

        const oldTail = this._tail;
        if (oldTail === null) {
            return false;
        }

        this._tail = oldTail.previousSong;
        if (this._tail !== null) {
            this._tail.nextSong = null;
        }

        if (this._current === oldTail) {
            this._current = this._tail;
        }

        this._size--;
        return true;
    }

    /** Elimina el nodo del índice indicado; devuelve `false` si no existe. */
    deleteAtPosition(position: number){
        if(position < 0 || position >= this._size){
            console.log("Posición fuera de rango.")
            return false;
        }

        if(position === 0){
            return this.deleteAtStart();
        }

        if(position === this._size - 1){
            return this.deleteAtEnd();
        }

        let current = this._head;
        for(let i = 0; i < position && current !== null; i++){
            current = current.nextSong;
        }

        if(current === null){
            return false;
        }

        const previous = current.previousSong;
        const next = current.nextSong;

        if(previous !== null){
            previous.nextSong = next;
        }

        if(next !== null){
            next.previousSong = previous;
        }

        if(this._current === current){
            this._current = next ?? previous;
        }

        this._size--;
        return true;
    }

    /** Avanza una posición; se mantiene en la cola al llegar al final. */
    playNext(){
        if (this._current === null) {
            this._current = this._head;
            return;
        }
        this._current = this._current.nextSong ?? this._current;
    }

    /** Retrocede una posición; se mantiene en la cabeza al llegar al inicio. */
    playPrevious(){
        if(this._current === null){
            this._current = this._tail;
            return;
        }
        this._current = this._current.previousSong ?? this._current;
    }

    /** Devuelve los nodos en orden para renderizar la lista en React. */
    toArray(): TrackNode[]{
        const nodes: TrackNode[] = [];
        let current = this._head;
        while (current !== null){
            nodes.push(current);
            current = current.nextSong;
        }
        return nodes;
    }

    /** Establece el nodo actual, o limpia la selección con `null`. */
    setCurrentNode(node: TrackNode | null){
        this._current = node;
    }
}