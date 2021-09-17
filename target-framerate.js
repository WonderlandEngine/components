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
WL.registerComponent('target-framerate', {
    framerate: {type: WL.Type.Float, default: 90.0},
}, {
    start: function() {
        if(WL.xrSession) {
            this.setTargetFramerate(WL.xrSession);
        } else {
            WL.onXRSessionStart.push(this.setTargetFramerate.bind(this));
        }
    },

    setTargetFramerate: function(s) {
        if(s.supportedFrameRates && s.updateTargetFrameRate) {
            const a = WL.xrSession.supportedFrameRates;
            a.sort((a, b) => Math.abs(a - this.framerate) - Math.abs(b - this.framerate));
            WL.xrSession.updateTargetFrameRate(a[0]);
        }
    },
});
