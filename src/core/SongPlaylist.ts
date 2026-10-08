import { Song } from "../types/Song";
import { TrackNode } from "./TrackNode";

/**
 * A doubly linked list of songs with references to its head, tail, and
 * current track. Positions use zero-based indices.
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

    /** Returns the first node, or `null` if the list is empty. */
    getHead(){
        return this._head;
    }

    /** Returns the last node, or `null` if the list is empty. */
    getTail(){
        return this._tail;
    }

    /** Returns the currently selected node. */
    getCurrent(){
        return this._current;
    }

    /** Returns the number of songs in the list. */
    getSize(){
        return this._size;
    }

    /** Inserts a song at the beginning without changing the current track. */
    insertAtStart(song: Song){
        const newNode: TrackNode = new TrackNode(song);
        if (this._head === null){
            this._head = newNode;
            this._tail = newNode;
        }else{
            newNode.nextSong = this._head;
            this._head.previousSong = newNode;
            this._head = newNode;
        }
        this._size++;
    }

    /** Inserts a song at the end without changing the current track. */
    insertAtEnd(song: Song){
        const newNode: TrackNode = new TrackNode(song);
        if (this._tail === null){
            this._head = newNode;
            this._tail = newNode;
        }else{
            newNode.previousSong = this._tail;
            this._tail.nextSong = newNode;
            this._tail = newNode;
        }
        this._size++;
    }

    /** Inserts at the given index; returns `false` if the index is out of range. */
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

    /** Removes the head and returns `false` if the list is already empty. */
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

    /** Removes the tail and returns `false` if the list is already empty. */
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

    /** Removes the node at the given index; returns `false` if it does not exist. */
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

    /** Moves a song up (`-1`) or down (`1`) by one position. */
    moveAtPosition(position: number, direction: -1 | 1){
        if (!Number.isInteger(position) || position < 0 || position >= this._size){
            return false;
        }

        const targetPosition = position + direction;
        if (targetPosition < 0 || targetPosition >= this._size){
            return false;
        }

        let node = this._head;
        for (let index = 0; index < position && node !== null; index++){
            node = node.nextSong;
        }

        if (node === null){
            return false;
        }

        const earlierNode = direction === -1 ? node.previousSong : node;
        const laterNode = direction === -1 ? node : node.nextSong;
        if (earlierNode === null || laterNode === null){
            return false;
        }

        const previousNode = earlierNode.previousSong;
        const nextNode = laterNode.nextSong;

        if (previousNode !== null){
            previousNode.nextSong = laterNode;
        }else{
            this._head = laterNode;
        }
        laterNode.previousSong = previousNode;
        laterNode.nextSong = earlierNode;
        earlierNode.previousSong = laterNode;
        earlierNode.nextSong = nextNode;

        if (nextNode !== null){
            nextNode.previousSong = earlierNode;
        }else{
            this._tail = earlierNode;
        }

        return true;
    }

    /** Moves a song to the given position while maintaining the list links. */
    moveToPosition(fromPosition: number, toPosition: number){
        if (!Number.isInteger(fromPosition) || !Number.isInteger(toPosition)
            || fromPosition < 0 || fromPosition >= this._size
            || toPosition < 0 || toPosition >= this._size
            || fromPosition === toPosition){
            return false;
        }

        const direction = toPosition < fromPosition ? -1 : 1;
        for (let position = fromPosition; position !== toPosition; position += direction){
            this.moveAtPosition(position, direction);
        }
        return true;
    }

    /** Advances one position and stays at the tail when it reaches the end. */
    playNext(){
        if (this._current === null) {
            this._current = this._head;
            return;
        }
        this._current = this._current.nextSong ?? this._current;
    }

    /** Moves back one position and stays at the head when it reaches the beginning. */
    playPrevious(){
        if(this._current === null){
            this._current = this._tail;
            return;
        }
        this._current = this._current.previousSong ?? this._current;
    }

    /** Returns the nodes in order for rendering the list in React. */
    toArray(): TrackNode[]{
        const nodes: TrackNode[] = [];
        let current = this._head;
        while (current !== null){
            nodes.push(current);
            current = current.nextSong;
        }
        return nodes;
    }

    /** Sets the current node, or clears the selection with `null`. */
    setCurrentNode(node: TrackNode | null){
        this._current = node;
    }

    /** Replaces the list contents and restores the selected track by ID. */
    replaceAll(songs: Song[], currentSongId: string | null = null){
        this._head = null;
        this._tail = null;
        this._current = null;
        this._size = 0;

        for (const song of songs){
            this.insertAtEnd(song);
            if (song.getId() === currentSongId){
                this._current = this._tail;
            }
        }
    }
}