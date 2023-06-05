import {vec3} from 'gl-matrix';
import {Component, Type} from '@wonderlandengine/api';
/**
 * Basic movement with W/A/S/D keys.
 */
export class WasdControlsComponent extends Component {
    static TypeName = 'wasd-controls';
    static Properties = {
        /** Movement speed in m/s. */
        speed: {type: Type.Float, default: 0.1},
        /** Flag for only moving the object on the global x & z planes */
        alignedToFloor: {type: Type.Bool, default: false},
        /** Object of which the orientation is used to determine forward direction */
        headObject: {type: Type.Object},
    };

    init() {
        this.up = false;
        this.right = false;
        this.down = false;
        this.left = false;

        this.zero = [0, 0, 0]
        this.direction = new Float32Array(3);

        window.addEventListener('keydown', this.press.bind(this));
        window.addEventListener('keyup', this.release.bind(this));
    }

    start() {
        this.headObject = this.headObject || this.object;
    }

    update() {
        this.direction.set(this.zero);

        if (this.up) this.direction[2] -= 1.0;
        if (this.down) this.direction[2] += 1.0;
        if (this.left) this.direction[0] -= 1.0;
        if (this.right) this.direction[0] += 1.0;

        vec3.normalize(this.direction, this.direction);
        this.direction[0] *= this.speed;
        this.direction[2] *= this.speed;
        vec3.transformQuat(this.direction, this.direction, this.headObject.transformWorld);

        if(this.alignedToFloor) {
            this.direction[1] = 0;
            vec3.normalize(this.direction, this.direction);
            vec3.scale(this.direction, this.direction, this.speed);
        }

        this.object.translateLocal(this.direction);
    }

    press(e) {
        if (
            e.keyCode === 38 /* up */ ||
            e.keyCode === 87 /* w */ ||
            e.keyCode === 90 /* z */
        ) {
            this.up = true;
        } else if (e.keyCode === 39 /* right */ || e.keyCode === 68 /* d */) {
            this.right = true;
        } else if (e.keyCode === 40 /* down */ || e.keyCode === 83 /* s */) {
            this.down = true;
        } else if (
            e.keyCode === 37 /* left */ ||
            e.keyCode === 65 /* a */ ||
            e.keyCode === 81 /* q */
        ) {
            this.left = true;
        }
    }

    release(e) {
        if (
            e.keyCode === 38 /* up */ ||
            e.keyCode === 87 /* w */ ||
            e.keyCode === 90 /* z */
        ) {
            this.up = false;
        } else if (e.keyCode === 39 /* right */ || e.keyCode === 68 /* d */) {
            this.right = false;
        } else if (e.keyCode === 40 /* down */ || e.keyCode === 83 /* s */) {
            this.down = false;
        } else if (
            e.keyCode === 37 /* left */ ||
            e.keyCode === 65 /* a */ ||
            e.keyCode === 81 /* q */
        ) {
            this.left = false;
        }
    }
}
