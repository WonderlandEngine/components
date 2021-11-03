WL.registerComponent('player-height', {
    height: { type: WL.Type.Float, default: 1.75 }
}, {
    init: function() {
        WL.onXRSessionStart.push(this.onXRSessionStart.bind(this));
        WL.onXRSessionEnd.push(this.onXRSessionEnd.bind(this));
    },

    start: function() {
        this.object.resetTranslationRotation();
        this.object.translate([0.0, this.height, 0.0]);
    },

    onXRSessionStart: function() {
        if(!['local', 'viewer'].includes(WebXR.refSpace)) {
            this.object.resetTranslationRotation();
        }
    },

    onXRSessionEnd: function() {
        if(!['local', 'viewer'].includes(WebXR.refSpace)) {
            this.object.resetTranslationRotation();
            this.object.translate([0.0, this.height, 0.0]);
        }
    }
});