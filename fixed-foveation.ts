import {Component, Type} from '@wonderlandengine/api';
import {property} from '@wonderlandengine/api/decorators.js';

/**
 * Applies [fixed foveation](https://www.w3.org/TR/webxrlayers-1/#dom-xrcompositionlayer-fixedfoveation)
 * once a WebXR session is started
 *
 * Fixed foveation reduces shading cost at the periphery by rendering at lower resolutions at the
 * edges of the users vision.
 */
export class FixedFoveation extends Component {
    static TypeName = 'fixed-foveation';

    /** Amount to apply from 0 (none) to 1 (full) */
    @property.float(0.5)
    fixedFoveation!: number;

    onActivate() {
        this.engine.onXRSessionStart.add(this.setFixedFoveation);
    }

    onDeactivate() {
        this.engine.onXRSessionStart.remove(this.setFixedFoveation);
    }

    setFixedFoveation = () => {
        this.engine.xr!.baseLayer.fixedFoveation = this.fixedFoveation;
    };
}
