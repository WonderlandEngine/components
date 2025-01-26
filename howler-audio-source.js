import {Component, Type} from '@wonderlandengine/api';
import {AudioSource} from '@wonderlandengine/spatial-audio';

/**
 * Deprecated audio source based on [Howler.js](https://howlerjs.com/).
 * @deprecated Use AudioSource (audio-source) instead.
 */
export class HowlerAudioSource extends AudioSource {
    static TypeName = 'howler-audio-source';
}
