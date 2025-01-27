import {vec3} from 'gl-matrix';
import {Component, Object3D, Type} from '@wonderlandengine/api';
import {property} from '@wonderlandengine/api/decorators.js';

const _direction = new Float32Array(3);
const _tempDualQuat = new Float32Array(8);

/**
 * Basic movement with W/A/S/D keys.
 */
export class WasdControlsComponent extends Component {
    static TypeName = 'wasd-controls';

    /** Movement speed in m/s. */
    @property.float(0.1)
    speed!: number;

    /** Flag for only moving the object on the global x & z planes */
    @property.bool(false)
    lockY!: boolean;

    /** Object of which the orientation is used to determine forward direction */
    @property.object()
    headObject!: Object3D | null;

    right = false;
    down = false;
    left = false;
    up = false;

    start() {
        this.headObject = this.headObject || this.object;
    }

    onActivate() {
        window.addEventListener('keydown', this.press);
        window.addEventListener('keyup', this.release);
    }

    onDeactivate() {
        window.removeEventListener('keydown', this.press);
        window.removeEventListener('keyup', this.release);
    }

    update() {
        vec3.zero(_direction);

        if (this.up) _direction[2] -= 1.0;
        if (this.down) _direction[2] += 1.0;
        if (this.left) _direction[0] -= 1.0;
        if (this.right) _direction[0] += 1.0;

        vec3.normalize(_direction, _direction);
        _direction[0] *= this.speed;
        _direction[2] *= this.speed;
        vec3.transformQuat(
            _direction,
            _direction,
            this.headObject!.getTransformWorld(_tempDualQuat)
        );

        if (this.lockY) {
            _direction[1] = 0;
            vec3.normalize(_direction, _direction);
            vec3.scale(_direction, _direction, this.speed);
        }

        this.object.translateLocal(_direction);
    }

    press = (e: KeyboardEvent) => {
        this.handleKey(e, true);
    };

    release = (e: KeyboardEvent) => {
        this.handleKey(e, false);
    };

    handleKey(e: KeyboardEvent, b: boolean) {
        if (e.code === 'ArrowUp' || e.code === 'KeyW' || e.code === 'KeyZ') {
            this.up = b;
        } else if (e.code === 'ArrowRight' || e.code === 'KeyD') {
            this.right = b;
        } else if (e.code === 'ArrowDown' || e.code === 'KeyS') {
            this.down = b;
        } else if (e.code === 'ArrowLeft' || e.code === 'KeyA' || e.code === 'KeyQ') {
            this.left = b;
        }
    }
}
