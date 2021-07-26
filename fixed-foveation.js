/**
 * Applies [fixed foveation](https://www.w3.org/TR/webxrlayers-1/#dom-xrcompositionlayer-fixedfoveation)
 * once a WebXR session is started
 *
 * Fixed foveation reduces shading cost at the periphery by rendering at lower resolutions at the
 * edges of the users vision.
 */
WL.registerComponent('fixed-foveation', {
    /** Amount to apply from 0 (none) to 1 (full) */
    fixedFoveation: {type: WL.Type.Float, default: 0.5},
}, {
    start: function() {
        if(WL.xrSession) {
            this.setFixedFoveation();
        } else {
            WL.onXRSessionStart.push(this.setFixedFoveation.bind(this));
        }
    },
    setFixedFoveation: function() {
        if('webxr_baseLayer' in Module) {
            Module.webxr_baseLayer.fixedFoveation = this.fixedFoveation;
        }
    },
});
