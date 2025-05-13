import {Component} from '@wonderlandengine/api';
import {property} from '@wonderlandengine/api/decorators.js';
import {quat} from 'gl-matrix';

const preventDefault = (e: Event) => {
    e.preventDefault();
};

const TEMP_ROT = new Float32Array(4);
const ROT_MUL = 180 / Math.PI / 100;

/**
 * Controls the camera orientation through mouse movement.
 *
 * Efficiently implemented to affect object orientation only
 * when the mouse moves.
 */
export class MouseLookComponent extends Component {
    static TypeName = 'mouse-look';

    /** Mouse look sensitivity */
    @property.float(0.25)
    sensitity = 0.25;

    /** Require a mouse button to be pressed to control view.
     * Otherwise view will allways follow mouse movement */
    @property.bool(true)
    requireMouseDown = true;

    /** If "moveOnClick" is enabled, mouse button which should
     * be held down to control view */
    @property.int()
    mouseButtonIndex = 0;

    /** Enables pointer lock on "mousedown" event on canvas */
    @property.bool(false)
    pointerLockOnClick = false;

    private currentRotationY = 0;
    private currentRotationX = 0;
    private mouseDown = false;

    onActivate() {
        document.addEventListener('mousemove', this.onMouseMove);

        const canvas = this.engine.canvas;
        if (this.pointerLockOnClick) {
            canvas.addEventListener('mousedown', this.requestPointerLock);
        }

        if (this.requireMouseDown) {
            if (this.mouseButtonIndex === 2) {
                canvas.addEventListener('contextmenu', preventDefault, false);
            }
            canvas.addEventListener('mousedown', this.onMouseDown);
            canvas.addEventListener('mouseup', this.onMouseUp);
        }
    }

    onDeactivate() {
        document.removeEventListener('mousemove', this.onMouseMove);

        const canvas = this.engine.canvas;
        if (this.pointerLockOnClick) {
            canvas.removeEventListener('mousedown', this.requestPointerLock);
        }

        if (this.requireMouseDown) {
            if (this.mouseButtonIndex === 2) {
                canvas.removeEventListener('contextmenu', preventDefault, false);
            }
            canvas.removeEventListener('mousedown', this.onMouseDown);
            canvas.removeEventListener('mouseup', this.onMouseUp);
        }
    }

    requestPointerLock = () => {
        const canvas = this.engine.canvas;
        canvas.requestPointerLock =
            canvas.requestPointerLock ||
            (canvas as any).mozRequestPointerLock ||
            (canvas as any).webkitRequestPointerLock;
        canvas.requestPointerLock();
    };

    onMouseDown = (e: MouseEvent) => {
        if (e.button === this.mouseButtonIndex) {
            this.mouseDown = true;
            document.body.style.cursor = 'grabbing';
            if (e.button === 1) {
                e.preventDefault();
                /* Prevent scrolling */
                return false;
            }
        }
    };

    onMouseUp = (e: MouseEvent) => {
        if (e.button === this.mouseButtonIndex) {
            this.mouseDown = false;
            document.body.style.cursor = 'initial';
        }
    };

    onMouseMove = (e: MouseEvent) => {
        if (this.active && (this.mouseDown || !this.requireMouseDown)) {
            this.currentRotationX += -this.sensitity * e.movementY * ROT_MUL;
            this.currentRotationY += -this.sensitity * e.movementX * ROT_MUL;
            // 89 deg instead of 90 so that there are no camera glitches
            // when looking straight down/up
            this.currentRotationX = Math.max(-89, Math.min(89, this.currentRotationX));
            quat.fromEuler(TEMP_ROT, this.currentRotationX, this.currentRotationY, 0);
            this.object.setRotationLocal(TEMP_ROT);
        }
    };
}
