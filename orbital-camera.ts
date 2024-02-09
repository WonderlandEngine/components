import {Component} from '@wonderlandengine/api';
import {property} from '@wonderlandengine/api/decorators.js';
import {deg2rad} from './utils/utils.js';

const preventDefault = (e: Event) => {
    e.preventDefault();
};

const tempVec = [0, 0, 0];

/**
 * OrbitalCamera component allows the user to orbit around a target point, which
 * is the position of the object itself. It rotates at the specified distance.
 *  
 * @remarks
 * The component works using mouse or touch. Therefor it does not work in VR.
 */
export class OrbitalCamera extends Component {
    static TypeName = 'orbital-camera';

    @property.int()
    mouseButtonIndex = 0;

    @property.float(5)
    radial = 5;

    @property.float()
    minElevation = 0.0;

    @property.float(89.99)
    maxElevation = 89.99;

    @property.float()
    minZoom = 0.01;

    @property.float(10.0)
    maxZoom = 10.0;

    @property.float(0.5)
    xSensitivity = 0.5;

    @property.float(0.5)
    ySensitivity = 0.5;

    @property.float(0.02)
    zoomSensitivity = 0.02;

    @property.float(0.9)
    decelerationFactor = 0.9;

    private mouseDown: boolean = false;
    private origin = [0, 0, 0];
    private azimuth = 0;
    private polar = 45;

    private initialPinchDistance: number = 0;
    private touchStartX: number = 0;
    private touchStartY: number = 0;

    private azimuthSpeed: number = 0;
    private polarSpeed: number = 0;

    start(): void {
        this.object.getPositionWorld(this.origin);
        this.updateCamera();
    }

    onActivate(): void {
        const canvas = this.engine.canvas;

        canvas.addEventListener('mousemove', this.onMouseMove);
        if (this.mouseButtonIndex === 2) {
            canvas.addEventListener('contextmenu', preventDefault, {passive: false});
        }
        canvas.addEventListener('mousedown', this.onMouseDown);
        canvas.addEventListener('mouseup', this.onMouseUp);
        canvas.addEventListener('wheel', this.onMouseScroll, {passive: false});

        canvas.addEventListener('touchstart', this.onTouchStart, {passive: false});
        canvas.addEventListener('touchmove', this.onTouchMove, {passive: false});
        canvas.addEventListener('touchend', this.onTouchEnd);
    }

    onDeactivate(): void {
        const canvas = this.engine.canvas;

        canvas.removeEventListener('mousemove', this.onMouseMove);
        if (this.mouseButtonIndex === 2) {
            canvas.removeEventListener('contextmenu', preventDefault);
        }
        canvas.removeEventListener('mousedown', this.onMouseDown);
        canvas.removeEventListener('mouseup', this.onMouseUp);
        canvas.removeEventListener('wheel', this.onMouseScroll);

        canvas.removeEventListener('touchstart', this.onTouchStart);
        canvas.removeEventListener('touchmove', this.onTouchMove);
        canvas.removeEventListener('touchend', this.onTouchEnd);

        // Reset state to make sure nothing gets stuck
        this.mouseDown = false;
        this.initialPinchDistance = 0;
        this.touchStartX = 0;
        this.touchStartY = 0;

        this.azimuthSpeed = 0;
        this.polarSpeed = 0;
    }

    update(): void {
        if (!this.mouseDown) {
            // Apply deceleration only when the user is not actively dragging
            this.azimuthSpeed *= this.decelerationFactor;
            this.polarSpeed *= this.decelerationFactor;

            // Stop completely if the speed is very low to avoid endless tiny movements
            if (Math.abs(this.azimuthSpeed) < 0.01) this.azimuthSpeed = 0;
            if (Math.abs(this.polarSpeed) < 0.01) this.polarSpeed = 0;
        }

        // Apply the speed to the camera angles
        this.azimuth += this.azimuthSpeed;
        this.polar += this.polarSpeed;

        // Clamp the polar angle
        this.polar = Math.min(this.maxElevation, Math.max(this.minElevation, this.polar));

        // Update the camera if there's any speed
        if (this.azimuthSpeed !== 0 || this.polarSpeed !== 0) {
            this.updateCamera();
        }
    }

    /**
     * Update the camera position based on the current azimuth,
     * polar and radial values
     */
    private updateCamera() {
        const azimuthInRadians = deg2rad(this.azimuth);
        const polarInRadians = deg2rad(this.polar);

        tempVec[0] = this.radial * Math.sin(azimuthInRadians) * Math.cos(polarInRadians);
        tempVec[1] = this.radial * Math.sin(polarInRadians);
        tempVec[2] = this.radial * Math.cos(azimuthInRadians) * Math.cos(polarInRadians);

        this.object.setPositionWorld(tempVec);
        this.object.translateWorld(this.origin);
        this.object.lookAt(this.origin);
    }

    /* Mouse Event Handlers */

    private onMouseDown = (e: MouseEvent) => {
        if (e.button === this.mouseButtonIndex) {
            this.mouseDown = true;
            document.body.style.cursor = 'grabbing';
            if (e.button === 1) {
                e.preventDefault(); // to prevent scrolling
                return false;
            }
        }
    };

    private onMouseUp = (e: MouseEvent) => {
        if (e.button === this.mouseButtonIndex) {
            this.mouseDown = false;
            document.body.style.cursor = 'initial';
        }
    };

    private onMouseMove = (e: MouseEvent) => {
        if (this.active && this.mouseDown) {
            if (this.active && this.mouseDown) {
                this.azimuthSpeed = -(e.movementX * this.xSensitivity);
                this.polarSpeed = e.movementY * this.ySensitivity;
            }
        }
    };

    private onMouseScroll = (e: WheelEvent) => {
        e.preventDefault(); // to prevent scrolling

        this.radial *= 1 - e.deltaY * this.zoomSensitivity * -0.001;
        this.radial = Math.min(this.maxZoom, Math.max(this.minZoom, this.radial));

        this.updateCamera();
    };

    /* Touch event handlers */

    private onTouchStart = (e: TouchEvent) => {
        if (e.touches.length === 1) {
            e.preventDefault(); // to prevent scrolling and allow us to track touch movement

            this.touchStartX = e.touches[0].clientX;
            this.touchStartY = e.touches[0].clientY;
            this.mouseDown = true; // Treat touch like mouse down
        } else if (e.touches.length === 2) {
            // Calculate initial pinch distance
            this.initialPinchDistance = this.getDistanceBetweenTouches(e.touches);
            e.preventDefault(); // Prevent default pinch actions
        }
    };

    private onTouchMove = (e: TouchEvent) => {
        if (this.active && this.mouseDown) {
            e.preventDefault(); // to prevent moving the page
            if (e.touches.length === 1) {
                const deltaX = e.touches[0].clientX - this.touchStartX;
                const deltaY = e.touches[0].clientY - this.touchStartY;

                this.azimuthSpeed = -(deltaX * this.xSensitivity);
                this.polarSpeed = deltaY * this.ySensitivity;

                this.touchStartX = e.touches[0].clientX;
                this.touchStartY = e.touches[0].clientY;
            } else if (e.touches.length === 2) {
                // Handle pinch zoom
                const currentPinchDistance = this.getDistanceBetweenTouches(e.touches);
                const pinchScale = this.initialPinchDistance / currentPinchDistance;

                this.radial *= pinchScale;
                this.radial = Math.min(this.maxZoom, Math.max(this.minZoom, this.radial));

                this.updateCamera();

                // Update initial pinch distance for next move
                this.initialPinchDistance = currentPinchDistance;
            }
        }
    };

    private onTouchEnd = (e: TouchEvent) => {
        if (e.touches.length < 2) {
            this.mouseDown = false; // Treat touch end like mouse up
        }
        if (e.touches.length === 1) {
            // Prepare for possible single touch movement
            this.touchStartX = e.touches[0].clientX;
            this.touchStartY = e.touches[0].clientY;
        }
    };

    /**
     * Helper function to calculate the distance between two touch points
     * @param touches list of touch points
     * @returns distance between the two touch points
     */
    private getDistanceBetweenTouches(touches: TouchList): number {
        const dx = touches[0].clientX - touches[1].clientX;
        const dy = touches[0].clientY - touches[1].clientY;
        return Math.sqrt(dx * dx + dy * dy);
    }
}
