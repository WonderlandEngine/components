import {Component, Type} from '@wonderlandengine/api';

import 'howler';

/**
 * (Spatial) audio listener based on [Howler.js](https://howlerjs.com/).
 *
 * Retrieves the location and orientation of the object and passes it
 * to [Howler.pos()](https://github.com/goldfire/howler.js#posx-y-z-id)
 * and [Howler.orientation()](https://github.com/goldfire/howler.js#orientationx-y-z-id).
 */
export class HowlerAudioListener extends Component {
    static TypeName = 'howler-audio-listener';
    static Properties = {
        /** Whether audio should be spatialized/positional. */
        spatial: {type: Type.Bool, default: true},
    };

    init() {
        this.origin = new Float32Array(3);
        this.fwd = new Float32Array(3);
        this.up = new Float32Array(3);
    }

    update() {
        if (!this.spatial) return;
        this.object.getTranslationWorld(this.origin);
        this.object.getForward(this.fwd);
        this.object.getUp(this.up);

        Howler.pos(this.origin[0], this.origin[1], this.origin[2]);
        Howler.orientation(
            this.fwd[0],
            this.fwd[1],
            this.fwd[2],
            this.up[0],
            this.up[1],
            this.up[2]
        );
    }
}
