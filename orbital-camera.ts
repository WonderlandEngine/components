import {Component} from '@wonderlandengine/api';
import {property} from '@wonderlandengine/api/decorators.js';
import {deg2rad, rad2deg} from './utils/utils.js';
import {quat, vec3} from 'gl-matrix';

const preventDefault = (e: Event) => {
    e.preventDefault();
};

const tempVec = [0, 0, 0];
const tempquat = quat.create();
const tempquat2 = quat.create();
const tempVec3 = vec3.create();

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
    damping = 0.9;

    private _mouseDown: boolean = false;
    private _origin = [0, 0, 0];
    private _azimuth = 0;
    private _polar = 45;

    private _initialPinchDistance: number = 0;
    private _touchStartX: number = 0;
    private _touchStartY: number = 0;

    private _azimuthSpeed: number = 0;
    private _polarSpeed: number = 0;

    start(): void {
        this.object.getPositionWorld(this._origin);
        this._updateCamera();
    }

    onActivate(): void {
        const canvas = this.engine.canvas;

        canvas.addEventListener('mousemove', this._onMouseMove);
        if (this.mouseButtonIndex === 2) {
            canvas.addEventListener('contextmenu', preventDefault, {passive: false});
        }
        canvas.addEventListener('mousedown', this._onMouseDown);
        canvas.addEventListener('mouseup', this._onMouseUp);
        canvas.addEventListener('wheel', this._onMouseScroll, {passive: false});

        canvas.addEventListener('touchstart', this._onTouchStart, {passive: false});
        canvas.addEventListener('touchmove', this._onTouchMove, {passive: false});
        canvas.addEventListener('touchend', this._onTouchEnd);
    }

    onDeactivate(): void {
        const canvas = this.engine.canvas;

        canvas.removeEventListener('mousemove', this._onMouseMove);
        if (this.mouseButtonIndex === 2) {
            canvas.removeEventListener('contextmenu', preventDefault);
        }
        canvas.removeEventListener('mousedown', this._onMouseDown);
        canvas.removeEventListener('mouseup', this._onMouseUp);
        canvas.removeEventListener('wheel', this._onMouseScroll);

        canvas.removeEventListener('touchstart', this._onTouchStart);
        canvas.removeEventListener('touchmove', this._onTouchMove);
        canvas.removeEventListener('touchend', this._onTouchEnd);

        /** Reset state to make sure nothing gets stuck */
        this._mouseDown = false;
        this._initialPinchDistance = 0;
        this._touchStartX = 0;
        this._touchStartY = 0;

        this._azimuthSpeed = 0;
        this._polarSpeed = 0;
    }

    update(): void {
        /** Always apply damping, because there's no event for stop moving */
        this._azimuthSpeed *= this.damping;
        this._polarSpeed *= this.damping;

        /** Stop completely if the speed is very low to avoid endless tiny movements */
        if (Math.abs(this._azimuthSpeed) < 0.01) this._azimuthSpeed = 0;
        if (Math.abs(this._polarSpeed) < 0.01) this._polarSpeed = 0;

        /** Apply the speed to the camera angles */
        this._azimuth += this._azimuthSpeed;
        this._polar += this._polarSpeed;

        /** Clamp the polar angle */
        this._polar = Math.min(this.maxElevation, Math.max(this.minElevation, this._polar));

        /** Update the camera if there's any speed */
        if (this._azimuthSpeed !== 0 || this._polarSpeed !== 0) {
            this._updateCamera();
        }
    }

    /**
     * Get the closest position to the given position on the orbit sphere of the camera.
     * This can be used to get a position and rotation to transition to.
     *
     * You pass this a position object. The method calculates the closest positition and updates the position parameter.
     * It also sets the rotation parameter to reflect the rotate the camera will have when it is on the orbit sphere,
     * pointing towards the center.
     * @param position the position to get the closest position to
     * @param rotation the rotation to get the closest position to
     */
    getClosestPosition(position: vec3, rotation: quat) {
        // It's a bit hacky, but the easiest way to get the rotation of the camera is just briefly
        // change the rotation to look at the center and then get the rotation.
        this.object.getRotationWorld(tempquat);
        this.object.lookAt(this._origin);
        this.object.getRotationWorld(tempquat2);

        if (quat.dot(tempquat, tempquat2) < 0) {
            quat.scale(tempquat2, tempquat2, -1); // Negate to ensure shortest path
        }
        this.object.setRotationWorld(tempquat);

        // Calculate the direction from the center of orbit to the current camera position
        const directionToCamera = vec3.create();
        vec3.subtract(directionToCamera, position, this._origin as vec3);
        vec3.normalize(directionToCamera, directionToCamera);
        // Scale this direction by the radius of your orbital sphere to get the nearest point on the sphere
        const nearestPointOnSphere = vec3.create();
        vec3.scale(nearestPointOnSphere, directionToCamera, this.radial);
        vec3.add(nearestPointOnSphere, nearestPointOnSphere, this._origin as vec3);
        vec3.copy(position, nearestPointOnSphere);
        quat.copy(rotation, tempquat2);
    }

    /**
     * Set the camera position based on the given position and calculate the rotation.
     * @param cameraPosition the position to set the camera to
     */
    setPosition(cameraPosition: vec3) {
        const centerOfOrbit = this._origin as vec3;

        // Compute the direction vector
        const direction = vec3.create();
        vec3.subtract(direction, cameraPosition, centerOfOrbit);
        vec3.normalize(direction, direction);
        // Compute the azimuth angle (in radians)
        const azimuth = Math.atan2(direction[0], direction[2]);
        // Compute the polar angle (in radians)
        const polar = Math.acos(direction[1]);
        const azimuthDeg = rad2deg(azimuth);
        // Polar is inverted to match the orbital camera
        const polarDeg = 90 - rad2deg(polar);
        this._azimuth = azimuthDeg;
        this._polar = polarDeg;
    }

    /**
     * Update the camera position based on the current azimuth,
     * polar and radial values
     */
    private _updateCamera() {
        const azimuthInRadians = deg2rad(this._azimuth);
        const polarInRadians = deg2rad(this._polar);

        tempVec[0] = this.radial * Math.sin(azimuthInRadians) * Math.cos(polarInRadians);
        tempVec[1] = this.radial * Math.sin(polarInRadians);
        tempVec[2] = this.radial * Math.cos(azimuthInRadians) * Math.cos(polarInRadians);

        this.object.setPositionWorld(tempVec);
        this.object.translateWorld(this._origin);
        this.object.lookAt(this._origin);
    }

    /* Mouse Event Handlers */

    private _onMouseDown = (e: MouseEvent) => {
        if (e.button === this.mouseButtonIndex) {
            this._mouseDown = true;
            document.body.style.cursor = 'grabbing';
            if (e.button === 1) {
                e.preventDefault(); /** to prevent scrolling */
                return false;
            }
        }
    };

    private _onMouseUp = (e: MouseEvent) => {
        if (e.button === this.mouseButtonIndex) {
            this._mouseDown = false;
            document.body.style.cursor = 'initial';
        }
    };

    private _onMouseMove = (e: MouseEvent) => {
        if (this.active && this._mouseDown) {
            if (this.active && this._mouseDown) {
                this._azimuthSpeed = -(e.movementX * this.xSensitivity);
                this._polarSpeed = e.movementY * this.ySensitivity;
            }
        }
    };

    private _onMouseScroll = (e: WheelEvent) => {
        e.preventDefault(); /** to prevent scrolling */

        this.radial *= 1 - e.deltaY * this.zoomSensitivity * -0.001;
        this.radial = Math.min(this.maxZoom, Math.max(this.minZoom, this.radial));

        this._updateCamera();
    };

    /* Touch event handlers */

    private _onTouchStart = (e: TouchEvent) => {
        if (e.touches.length === 1) {
            /** to prevent scrolling and allow us to track touch movement */
            e.preventDefault();

            this._touchStartX = e.touches[0].clientX;
            this._touchStartY = e.touches[0].clientY;
            this._mouseDown = true; /** Treat touch like mouse down */
        } else if (e.touches.length === 2) {
            /** Calculate initial pinch distance */
            this._initialPinchDistance = this._getDistanceBetweenTouches(e.touches);
            e.preventDefault(); /** Prevent default pinch actions */
        }
    };

    private _onTouchMove = (e: TouchEvent) => {
        if (!this.active || !this._mouseDown) {
            return;
        }
        e.preventDefault(); /** to prevent moving the page */
        if (e.touches.length === 1) {
            const deltaX = e.touches[0].clientX - this._touchStartX;
            const deltaY = e.touches[0].clientY - this._touchStartY;

            this._azimuthSpeed = -(deltaX * this.xSensitivity);
            this._polarSpeed = deltaY * this.ySensitivity;

            this._touchStartX = e.touches[0].clientX;
            this._touchStartY = e.touches[0].clientY;
        } else if (e.touches.length === 2) {
            /** Handle pinch zoom */
            const currentPinchDistance = this._getDistanceBetweenTouches(e.touches);
            const pinchScale = this._initialPinchDistance / currentPinchDistance;

            this.radial *= pinchScale;
            this.radial = Math.min(this.maxZoom, Math.max(this.minZoom, this.radial));

            this._updateCamera();

            /** Update initial pinch distance for next move */
            this._initialPinchDistance = currentPinchDistance;
        }
    };

    private _onTouchEnd = (e: TouchEvent) => {
        if (e.touches.length < 2) {
            this._mouseDown = false; /** Treat touch end like mouse up */
        }
        if (e.touches.length === 1) {
            /** Prepare for possible single touch movement */
            this._touchStartX = e.touches[0].clientX;
            this._touchStartY = e.touches[0].clientY;
        }
    };

    /**
     * Helper function to calculate the distance between two touch points
     * @param touches list of touch points
     * @returns distance between the two touch points
     */
    private _getDistanceBetweenTouches(touches: TouchList): number {
        const dx = touches[0].clientX - touches[1].clientX;
        const dy = touches[0].clientY - touches[1].clientY;
        return Math.sqrt(dx * dx + dy * dy);
    }
}
