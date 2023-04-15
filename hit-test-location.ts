import {Component} from '@wonderlandengine/api';
import {setXRRigidTransformLocal} from './utils/webxr.js';

/**
 * Sets up a [WebXR Device API "Hit Test"](https://immersive-web.github.io/hit-test/)
 * and places the object to the hit location.
 *
 * **Requirements:**
 *  - Specify `'hit-test'` in the required or optional features on the AR button in your html file.
 *    See [Wastepaperbin AR](/showcase/wpb-ar) as an example.
 */
export class HitTestLocation extends Component {
    static TypeName = 'hit-test-location';
    static Properties = {};

    tempScaling = new Float32Array(3);
    visible = false;
    xrHitTestSource: XRHitTestSource | null = null;

    start() {
        this.engine.onXRSessionStart.add(this.xrSessionStart.bind(this));
        this.engine.onXRSessionEnd.add(this.xrSessionEnd.bind(this));

        if (this.engine.xr) {
            this.xrSessionStart(this.engine.xr.session);
        }

        this.tempScaling.set(this.object.scalingLocal);
        this.object.scale([0, 0, 0]);
    }

    update() {
        const wasVisible = this.visible;
        if (this.xrHitTestSource) {
            const frame = this.engine.xrFrame;
            if (!frame) return;
            let hitTestResults = frame.getHitTestResults(this.xrHitTestSource);
            if (hitTestResults.length > 0) {
                let pose = hitTestResults[0].getPose(
                    this.engine.xr!.referenceSpaceForType('viewer')!
                );
                this.visible = !!pose;
                if (pose) {
                    setXRRigidTransformLocal(this.object, pose.transform);
                }
            } else {
                this.visible = false;
            }
        }

        if (this.visible != wasVisible) {
            if (!this.visible) {
                this.tempScaling.set(this.object.scalingLocal);
                this.object.scale([0, 0, 0]);
            } else {
                this.object.scalingLocal.set(this.tempScaling);
                this.object.setDirty();
            }
        }
    }

    getHitTestResults() {
        if (!this.engine.xr?.frame) return [];
        /* May happen if the hit test source couldn't be created */
        if (!this.xrHitTestSource) return [];
        return this.engine.xr.frame.getHitTestResults(this.xrHitTestSource);
    }

    xrSessionStart(session: XRSession) {
        if (session.requestHitTestSource === undefined) {
            console.error(
                'hit-test-location: hit test feature not available. Deactivating component.'
            );
            this.active = false;
            return;
        }

        const viewerSpace = this.engine.xr!.referenceSpaceForType('viewer')!;
        session!
            .requestHitTestSource({space: viewerSpace})!
            .then((hitTestSource) => {
                this.xrHitTestSource = hitTestSource;
            })
            .catch(console.error);
    }

    xrSessionEnd() {
        if (!this.xrHitTestSource) return;
        this.xrHitTestSource.cancel();
        this.xrHitTestSource = null;
    }
}
