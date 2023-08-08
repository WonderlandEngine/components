import {Component, Property} from '@wonderlandengine/api';
import {vec3} from 'gl-matrix';

/**
 * Controls the camera oriantation via mouse movement.
 *
 * Efficiently implemented to affect object orientation only
 * when the mouse moves.
 */
export class MouseLookComponent extends Component {
    static TypeName = 'mouse-look';
    static Properties = {
        /** Mouse look sensitivity FIXME typo */
        sensitity: Property.float(0.25),
        /** Require a mouse button to be pressed to control view.
         * Otherwise view will allways follow mouse movement */
        requireMouseDown: Property.bool(true),
        /** If "moveOnClick" is enabled, mouse button which should
         * be held down to control view */
        mouseButtonIndex: Property.int(),
        /** Enables pointer lock on "mousedown" event on canvas */
        pointerLockOnClick: Property.bool(false),
    };

    currentRotationY = 0;
    currentRotationX = 0;
    origin = new Float32Array(3);
    parentOrigin = new Float32Array(3);
    rotationX = 0;
    rotationY = 0;

    onActivate() {
        document.addEventListener('mousemove', this.onMouseMove);

        const canvas = this.engine.canvas;
        if (this.pointerLockOnClick) {
            canvas.addEventListener('mousedown', this.requestPointerLock);
        }
        if (this.requireMouseDown) {
            if (this.mouseButtonIndex == 2) {
                canvas.addEventListener('contextmenu', this.preventDefault, false);
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
            if (this.mouseButtonIndex == 2) {
                canvas.removeEventListener('contextmenu', this.preventDefault, false);
            }
            canvas.removeEventListener('mousedown', this.onMouseDown);
            canvas.removeEventListener('mouseup', this.onMouseUp);
        }
    }

    onMouseMove = (e) => {
        if (!this.mouseDown && this.requireMouseDown) return;
        this.rotationY = (-this.sensitity * e.movementX) / 100;
        this.rotationX = (-this.sensitity * e.movementY) / 100;

        this.currentRotationX += this.rotationX;
        this.currentRotationY += this.rotationY;

        /* 1.507 = PI/2 = 90° */
        this.currentRotationX = Math.min(1.507, this.currentRotationX);
        this.currentRotationX = Math.max(-1.507, this.currentRotationX);

        this.object.getPositionWorld(this.origin);

        const parent = this.object.parent;
        if (parent !== null) {
            parent.getPositionWorld(this.parentOrigin);
            vec3.sub(this.origin, this.origin, this.parentOrigin);
        }

        this.object.resetPositionRotation();
        this.object.rotateAxisAngleRadLocal([1, 0, 0], this.currentRotationX);
        this.object.rotateAxisAngleRadLocal([0, 1, 0], this.currentRotationY);
        this.object.translateLocal(this.origin);
    };

    onMouseUp = (e) => {
        if (e.button != this.mouseButtonIndex) return;
        this.mouseDown = false;
        document.body.style.cursor = 'initial';
    };

    onMouseDown = (e) => {
        if (e.button != this.mouseButtonIndex) return;
        this.mouseDown = true;
        document.body.style.cursor = 'grabbing';
        if (e.button == 1) {
            e.preventDefault();
            /* Prevent scrolling */
            return false;
        }
    };

    /* Requests a pointer lock on the canvas DOM element */
    requestPointerLock = () => {
        canvas.requestPointerLock =
            canvas.requestPointerLock ||
            canvas.mozRequestPointerLock ||
            canvas.webkitRequestPointerLock;
        canvas.requestPointerLock();
    };

    /* Prevents default browser behavior */
    preventDefault = () => {
        e.preventDefault();
    };
}
