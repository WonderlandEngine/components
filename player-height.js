import {Component, Type} from '@wonderlandengine/api';

/**
 * Set player height for a Y-offset above the ground for
 * 'local' and 'viewer' reference spaces.
 */
export class PlayerHeight extends Component {
    static TypeName = 'player-height';
    static Properties = {
        height: {type: Type.Float, default: 1.75},
    };

    start() {
        this.object.resetTranslationRotation();
        this.object.translate([0.0, this.height, 0.0]);

        this.onSessionStartCallback = this.onXRSessionStart.bind(this);
        this.onSessionEndCallback = this.onXRSessionEnd.bind(this);
    }

    onActivate() {
        this.engine.onXRSessionStart.add(this.onSessionStartCallback);
        this.engine.onXRSessionEnd.add(this.onSessionEndCallback);
    }

    onDeactivate() {
        this.engine.onXRSessionStart.remove(this.onSessionStartCallback);
        this.engine.onXRSessionEnd.remove(this.onSessionEndCallback);
    }

    onXRSessionStart() {
        if (!['local', 'viewer'].includes(this.engine.xr.currentReferenceSpace)) {
            this.object.resetTranslationRotation();
        }
    }

    onXRSessionEnd() {
        if (!['local', 'viewer'].includes(this.engine.xr.currentReferenceSpace)) {
            this.object.resetTranslationRotation();
            this.object.translate([0.0, this.height, 0.0]);
        }
    }
}
