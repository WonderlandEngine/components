import {Component} from '@wonderlandengine/api';
import {property} from '@wonderlandengine/api/decorators.js';
import {vec3} from 'gl-matrix';

/**
 * Controls the camera through mouse movement.
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
    private origin = new Float32Array(3);
    private parentOrigin = new Float32Array(3);
    private rotationX = 0;
    private rotationY = 0;
    private mouseDown = false;

    start() {
        document.addEventListener('mousemove', (e) => {
            if (this.active && (this.mouseDown || !this.requireMouseDown)) {
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
            }
        });

        const canvas = this.engine.canvas;
        if (this.pointerLockOnClick) {
            canvas.addEventListener('mousedown', () => {
                canvas.requestPointerLock =
                    canvas.requestPointerLock ||
                    (canvas as any).mozRequestPointerLock ||
                    (canvas as any).webkitRequestPointerLock;
                canvas.requestPointerLock();
            });
        }

        if (this.requireMouseDown) {
            if (this.mouseButtonIndex == 2) {
                canvas.addEventListener(
                    'contextmenu',
                    (e) => {
                        e.preventDefault();
                    },
                    false
                );
            }
            canvas.addEventListener('mousedown', (e) => {
                if (e.button == this.mouseButtonIndex) {
                    this.mouseDown = true;
                    document.body.style.cursor = 'grabbing';
                    if (e.button == 1) {
                        e.preventDefault();
                        /* Prevent scrolling */
                        return false;
                    }
                }
            });
            canvas.addEventListener('mouseup', (e) => {
                if (e.button == this.mouseButtonIndex) {
                    this.mouseDown = false;
                    document.body.style.cursor = 'initial';
                }
            });
        }
    }
}
