import {Component, Emitter} from '@wonderlandengine/api';
import {property} from '@wonderlandengine/api/decorators.js';
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

    tempScaling = new Float32Array(3);
    visible = false;
    xrHitTestSource: XRHitTestSource | null = null;

    /** Reference space for creating the hit test when the session starts */
    xrReferenceSpace: XRReferenceSpace | null = null;

    /**
     * For maintaining backwards compatibility: Whether to scale the object to 0 and back.
     * @deprecated Use onHitLost and onHitFound instead.
     */
    @property.bool(true)
    scaleObject = true;

    /** Emits an event when the hit test switches from visible to invisible */
    onHitLost = new Emitter<[HitTestLocation]>();

    /** Emits an event when the hit test switches from invisible to visible */
    onHitFound = new Emitter<[HitTestLocation]>();

    start() {
        this.engine.onXRSessionStart.add(this.xrSessionStart.bind(this));
        this.engine.onXRSessionEnd.add(this.xrSessionEnd.bind(this));

        if (this.engine.xr) {
            this.xrSessionStart(this.engine.xr.session);
        }

        if (this.scaleObject) {
            this.tempScaling.set(this.object.scalingLocal);
            this.object.scale([0, 0, 0]);

            this.onHitLost.add(() => {
                this.tempScaling.set(this.object.scalingLocal);
                this.object.scale([0, 0, 0]);
            });
            this.onHitFound.add(() => {
                this.object.scalingLocal.set(this.tempScaling);
                this.object.setDirty();
            });
        }
    }

    update() {
        const wasVisible = this.visible;
        if (this.xrHitTestSource) {
            const frame = this.engine.xrFrame;
            if (!frame) return;

            let hitTestResults = frame.getHitTestResults(this.xrHitTestSource);
            if (hitTestResults.length > 0) {
                let pose = hitTestResults[0].getPose(this.engine.xr!.currentReferenceSpace);
                this.visible = !!pose;
                if (pose) {
                    setXRRigidTransformLocal(this.object, pose.transform);
                }
            } else {
                this.visible = false;
            }
        }

        /* Emit events for visible state change */
        if (this.visible != wasVisible) {
            (this.visible ? this.onHitFound : this.onHitLost).notify(this);
        }
    }

    getHitTestResults(frame: XRFrame | null = this.engine.xr?.frame ?? null) {
        if (!frame) return [];
        /* May happen if the hit test source couldn't be created */
        if (!this.xrHitTestSource) return [];
        return frame.getHitTestResults(this.xrHitTestSource);
    }

    xrSessionStart(session: XRSession) {
        if (session.requestHitTestSource === undefined) {
            console.error(
                'hit-test-location: hit test feature not available. Deactivating component.'
            );
            this.active = false;
            return;
        }

        session!
            .requestHitTestSource({
                space:
                    this.xrReferenceSpace ??
                    this.engine.xr!.referenceSpaceForType('viewer')!,
            })!
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
