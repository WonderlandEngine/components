import {Component} from '@wonderlandengine/api';

/**
 * Function to convert a Euler in YXZ order to a quaternion
 */
function quatFromEulerYXZDeg(out: number[], x: number, y: number, z: number) {
    const halfToRad = (0.5 * Math.PI) / 180.0;
    x *= halfToRad;
    y *= halfToRad;
    z *= halfToRad;

    const c1 = Math.cos(x);
    const c2 = Math.cos(y);
    const c3 = Math.cos(z);

    const s1 = Math.sin(x);
    const s2 = Math.sin(y);
    const s3 = Math.sin(z);

    out[0] = s1 * c2 * c3 + c1 * s2 * s3;
    out[1] = c1 * s2 * c3 - s1 * c2 * s3;
    out[2] = c1 * c2 * s3 - s1 * s2 * c3;
    out[3] = c1 * c2 * c3 + s1 * s2 * s3;
}

/**
 * Retrieve device orientation from a mobile device and set the object's
 * orientation accordingly.
 *
 * Useful for magic window experiences.
 */
export class DeviceOrientationLook extends Component {
    static TypeName = 'device-orientation-look';
    static Properties = {};

    rotationX = 0;
    rotationY = 0;

    lastClientX = -1;
    lastClientY = -1;

    /* Initialize device orientation with Identity Quaternion */
    deviceOrientation = [0, 0, 0, 1];
    screenOrientation = 0;
    private _origin = [0, 0, 0];

    onActivate() {
        this.screenOrientation = window.innerHeight > window.innerWidth ? 0 : 90;
        window.addEventListener('deviceorientation', this.onDeviceOrientation);

        window.addEventListener('orientationchange', this.onOrientationChange, false);
    }

    onDeactivate() {
        window.removeEventListener('deviceorientation', this.onDeviceOrientation);

        window.removeEventListener('orientationchange', this.onOrientationChange);
    }

    update() {
        /* Don't use device orientation in VR */
        if (this.engine.xr) return;

        this.object.getPositionLocal(this._origin);

        this.object.resetTransform();
        if (this.screenOrientation != 0) {
            this.object.rotateAxisAngleDegLocal([0, 0, -1], this.screenOrientation);
        }
        this.object.rotateLocal([-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5)]);
        this.object.rotateLocal(this.deviceOrientation);
        this.object.translateLocal(this._origin);
    }

    onDeviceOrientation = (e: DeviceOrientationEvent) => {
        let alpha = e.alpha ?? 0;
        let beta = e.beta ?? 0;
        let gamma = e.gamma ?? 0;
        quatFromEulerYXZDeg(this.deviceOrientation, beta, alpha, -gamma);
    };

    onOrientationChange = () => {
        this.screenOrientation =
            window.screen?.orientation.angle ?? window.orientation ?? 0;
    };
}
