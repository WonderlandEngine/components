import {Component} from '@wonderlandengine/api';
import {property} from '@wonderlandengine/api/decorators.js';
import {deg2rad} from './utils/utils.js';

const preventDefault = (e: Event) => {
    e.preventDefault();
};

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

    private mouseDown: boolean = false;
    private origin = [0, 0, 0];
    private azimuth = 0;
    private polar = 45;

    private touchStartX: number = 0;
    private touchStartY: number = 0;

    start(): void {
        this.object.getPositionWorld(this.origin);
        this.updateCamera();
    }

    onActivate(): void {
        document.addEventListener('mousemove', this.onMouseMove);

        const canvas = this.engine.canvas;

        if (this.mouseButtonIndex === 2) {
            canvas.addEventListener('contextmenu', preventDefault, false);
        }
        canvas.addEventListener('mousedown', this.onMouseDown);
        canvas.addEventListener('mouseup', this.onMouseUp);
        canvas.addEventListener('wheel', this.onMouseScroll);
        

        canvas.addEventListener('touchstart', this.onTouchStart, {passive: false});
        canvas.addEventListener('touchmove', this.onTouchMove, {passive: false});
        canvas.addEventListener('touchend', this.onTouchEnd);
    }

    onDeactivate(): void {
        document.removeEventListener('mousemove', this.onMouseMove);
        const canvas = this.engine.canvas;

        if (this.mouseButtonIndex === 2) {
            canvas.removeEventListener('contextmenu', preventDefault, false);
        }
        canvas.removeEventListener('mousedown', this.onMouseDown);
        canvas.removeEventListener('mouseup', this.onMouseUp);
        canvas.removeEventListener('wheel', this.onMouseScroll);

        canvas.removeEventListener('touchstart', this.onTouchStart);
        canvas.removeEventListener('touchmove', this.onTouchMove);
        canvas.removeEventListener('touchend', this.onTouchEnd);
    }

    private updateCamera() {
        this.object.setPositionWorld([
            this.radial * Math.sin(deg2rad(this.azimuth)) * Math.cos(deg2rad(this.polar)),
            this.radial * Math.sin(deg2rad(this.polar)),
            this.radial * Math.cos(deg2rad(this.azimuth)) * Math.cos(deg2rad(this.polar)),
        ]);
        this.object.translateWorld(this.origin);
        this.object.lookAt(this.origin);
    }

    // Mouse Event Handlers

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
            this.azimuth += -(e.movementX * this.xSensitivity);
            this.polar += e.movementY * this.ySensitivity;
            this.polar = Math.min(
                this.maxElevation,
                Math.max(this.minElevation, this.polar)
            );
            this.updateCamera();
        }
    };

    private onMouseScroll = (e: WheelEvent) => {
        this.radial *= 1 - (e.deltaY * this.zoomSensitivity * -0.001);
        this.radial = Math.min(this.maxZoom, Math.max(this.minZoom, this.radial));
    
        this.updateCamera();
      }

    // Touch event handlers

    private onTouchStart = (e: TouchEvent) => {
        if (e.touches.length === 1) {
            e.preventDefault(); // to prevent scrolling and allow us to track touch movement

            this.touchStartX = e.touches[0].clientX;
            this.touchStartY = e.touches[0].clientY;
            this.mouseDown = true; // Treat touch like mouse down
        }
    };

    private onTouchMove = (e: TouchEvent) => {
        if (this.active && this.mouseDown && e.touches.length === 1) {
            const deltaX = e.touches[0].clientX - this.touchStartX;
            const deltaY = e.touches[0].clientY - this.touchStartY;

            // Apply the deltas as you would in onMouseMove
            this.azimuth += -(deltaX * this.xSensitivity);
            this.polar += deltaY * this.ySensitivity;
            this.polar = Math.min(
                this.maxElevation,
                Math.max(this.minElevation, this.polar)
            );

            this.updateCamera();

            // Update the start positions for the next touch move
            this.touchStartX = e.touches[0].clientX;
            this.touchStartY = e.touches[0].clientY;
        }
    };

    private onTouchEnd = (e: TouchEvent) => {
        if (e.touches.length === 0) {
            // Treat touch end like mouse up
            this.mouseDown = false; 
        }
    };
}
