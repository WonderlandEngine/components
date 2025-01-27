import {Component, Type} from '@wonderlandengine/api';
import {AudioListener} from '@wonderlandengine/spatial-audio';

/**
 * Deprecated audio listener based on [Howler.js](https://howlerjs.com/).
 * @deprecated Use AudioListener (audio-listener) instead.
 */
export class HowlerAudioListener extends AudioListener {
    static TypeName = 'howler-audio-listener';
}
