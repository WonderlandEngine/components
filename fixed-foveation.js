import {Component, Type} from '@wonderlandengine/api';

/**
 * Applies [fixed foveation](https://www.w3.org/TR/webxrlayers-1/#dom-xrcompositionlayer-fixedfoveation)
 * once a WebXR session is started
 *
 * Fixed foveation reduces shading cost at the periphery by rendering at lower resolutions at the
 * edges of the users vision.
 */
export class FixedFoveation extends Component {
    static TypeName = 'fixed-foveation';
    static Properties = {
        /** Amount to apply from 0 (none) to 1 (full) */
        fixedFoveation: {type: Type.Float, default: 0.5},
    };

    start() {
        if (this.engine.xr) {
            this.setFixedFoveation();
        } else {
            this.engine.onXRSessionStart.push(this.setFixedFoveation.bind(this));
        }
    }

    setFixedFoveation() {
        this.engine.xr.baseLayer.fixedFoveation = this.fixedFoveation;
    }
}
