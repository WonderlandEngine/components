import {Component} from '@wonderlandengine/api';
import {property} from '@wonderlandengine/api/decorators.js';

/**
 * Set player height for a Y-offset above the ground for
 * 'local' and 'viewer' reference spaces.
 */
export class PlayerHeight extends Component {
    static TypeName = 'player-height';

    @property.float(1.75)
    height: number = 1.75;

    onSessionStartCallback!: () => void;
    onSessionEndCallback!: () => void;

    start() {
        this.object.resetPositionRotation();
        this.object.translateLocal([0.0, this.height, 0.0]);

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
        const type = this.engine.xr?.currentReferenceSpaceType;
        if (type !== 'local' && type !== 'viewer') {
            this.object.resetPositionRotation();
        }
    }

    onXRSessionEnd() {
        const type = this.engine.xr?.currentReferenceSpaceType;
        if (type !== 'local' && type !== 'viewer') {
            this.object.resetPositionRotation();
            this.object.translateLocal([0.0, this.height, 0.0]);
        }
    }
}
