import {Component} from '@wonderlandengine/api';
import {property} from '@wonderlandengine/api/decorators.js';
import {quat} from 'gl-matrix';

const preventDefault = (e: Event) => {
    e.preventDefault();
};

const TEMP_ROT = new Float32Array(4);
const ROT_MUL = 180 / Math.PI / 100;

/**
 * Controls the camera orientation through mouse and touch movement.
 *
 * Efficiently implemented to affect object orientation only
 * when the mouse or touch moves.
 */
export class MouseLookComponent extends Component {
    static TypeName = 'mouse-look';

    /** Mouse look sensitivity */
    @property.float(0.25)
    sensitity = 0.25;

    /** Require a mouse button or touch to be pressed to control view.
     * Otherwise view will always follow mouse or touch movement */
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
    /** Pointerlock spec prevents calling pointerlock right after user exiting it via esc for ~1 second */
    private pointerLockCooldown = false;

    onActivate() {
        const canvas = this.engine.canvas;
        if (this.mouseButtonIndex === 2) {
            canvas.addEventListener('contextmenu', preventDefault, false);
        }
        canvas.addEventListener('pointermove', this.onPointerMove);
        if (this.pointerLockOnClick) {
            canvas.addEventListener('pointerdown', this.onPointerDown);
            document.addEventListener('pointerlockchange', this.onPointerLockChange);
        }

        if (this.requireMouseDown && !this.pointerLockOnClick) {
            canvas.addEventListener('pointerdown', this.onPointerDown);
            canvas.addEventListener('pointerup', this.onPointerUp);
        }
    }

    onDeactivate() {
        const canvas = this.engine.canvas;
        canvas.removeEventListener('pointermove', this.onPointerMove);

        if (this.pointerLockOnClick) {
            canvas.removeEventListener('pointerdown', this.onPointerDown);
            document.removeEventListener('pointerlockchange', this.onPointerLockChange);
        }

        if (this.requireMouseDown && !this.pointerLockOnClick) {
            if (this.mouseButtonIndex === 2) {
                canvas.removeEventListener('contextmenu', preventDefault, false);
            }
            canvas.removeEventListener('pointerdown', this.onPointerDown);
            canvas.removeEventListener('pointerup', this.onPointerUp);
        }
    }

    async requestPointerLock() {
        const canvas = this.engine.canvas;
        canvas.requestPointerLock =
            canvas.requestPointerLock ||
            (canvas as any).mozRequestPointerLock ||
            (canvas as any).webkitRequestPointerLock;

        try {
            await navigator.locks.request('pointer-lock', async (lock) => {
                if (!document.pointerLockElement) {
                    await canvas.requestPointerLock();
                }
            });
        } catch (error) {
            console.error('Pointer lock request failed:', error);
        }
    }

    onPointerLockChange = () => {
        const canvas = this.engine.canvas;
        if (document.pointerLockElement === canvas) return;
        this.mouseDown = false;
        this.pointerLockCooldown = true;
        document.body.style.cursor = 'initial';

        setTimeout(() => {
            this.pointerLockCooldown = false;
        }, 1500);
    };

    onPointerDown = (e: PointerEvent) => {
        if (
            this.pointerLockCooldown ||
            !(e.button === this.mouseButtonIndex || e.pointerType === 'touch')
        )
            return;
        this.mouseDown = true;
        document.body.style.cursor = 'grabbing';
        if (e.button === 2) {
            e.preventDefault();
        }

        if (this.pointerLockOnClick && document.pointerLockElement !== this.engine.canvas) {
            this.requestPointerLock();
        }
        if (e.button === 1) {
            e.preventDefault();
            /* Prevent scrolling */
            return false;
        }
    };

    onPointerUp = (e: PointerEvent) => {
        if (e.button === this.mouseButtonIndex || e.pointerType === 'touch') {
            this.mouseDown = false;
            document.body.style.cursor = 'initial';
        }
    };

    onPointerMove = (e: PointerEvent) => {
        if (this.active && (this.mouseDown || !this.requireMouseDown)) {
            this.currentRotationX += (-this.sensitity * e.movementY) * ROT_MUL;
            this.currentRotationY += (-this.sensitity * e.movementX) * ROT_MUL;
            // 89 deg instead of 90 so that there are no camera glitches
            // when looking straight down/up
            this.currentRotationX = Math.max(-89, Math.min(89, this.currentRotationX));
            quat.fromEuler(TEMP_ROT, this.currentRotationX, this.currentRotationY, 0);
            this.object.setRotationLocal(TEMP_ROT);
        }
    };
}
