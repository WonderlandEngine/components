import {Component, Type} from '@wonderlandengine/api';

/**
 * Sets the target framerate
 *
 * [Updates the target framerate](https://immersive-web.github.io/webxr/#dom-xrsession-updatetargetframerate)
 * to the closest [supported target framerate](https://immersive-web.github.io/webxr/#dom-xrsession-supportedFrameRates)
 * to the given `framerate`.
 *
 * The target framerate is used for the device's VR compositor as an indication of how often to refresh the
 * screen with new images. This means the app will be asked to produce frames in more regular intervals,
 * potentially spending less time on frames that are likely to be dropped.
 *
 * For apps with heavy load, setting a well matching target framerate can improve the apps rendering stability
 * and reduce stutter.
 *
 * Likewise, the target framerate can be used to enable 120Hz refresh rates on Oculus Quest 2 on simpler apps.
 */
export class TargetFramerate extends Component {
    static TypeName = 'target-framerate';
    static Properties = {
        framerate: {type: Type.Float, default: 90.0},
    };

    start() {
        this.onSessionStartCallback = this.setTargetFramerate().bind(this);
    }

    onActivate() {
        this.engine.onXRSessionStart.add(this.onSessionStartCallback);
    }

    onDeactivate() {
        this.engine.onXRSessionStart.remove(this.onSessionStartCallback);
    }

    setTargetFramerate(s) {
        if (s.supportedFrameRates && s.updateTargetFrameRate) {
            const a = this.engine.xrSession.supportedFrameRates;
            a.sort((a, b) => Math.abs(a - this.framerate) - Math.abs(b - this.framerate));
            this.engine.xrSession.updateTargetFrameRate(a[0]);
        }
    }
}
