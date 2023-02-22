import {Component, Type} from '@wonderlandengine/api';

import {quat2} from 'gl-matrix';
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

    init() {
        this.engine.onXRSessionStart.push(this.xrSessionStart.bind(this));
        this.engine.onXRSessionEnd.push(this.xrSessionEnd.bind(this));

        this.tempScaling = new Float32Array(3);
        this.tempScaling.set(this.object.scalingLocal);
        this.visible = false;
        this.object.scale([0, 0, 0]);
    }

    update(dt) {
        const wasVisible = this.visible;
        if (this.xrHitTestSource) {
            const frame = Module['webxr_frame'];
            if (!frame) return;
            let hitTestResults = frame.getHitTestResults(this.xrHitTestSource);
            if (hitTestResults.length > 0) {
                let pose = hitTestResults[0].getPose(this.xrViewerSpace);
                this.visible = true;
                quat2.fromMat4(this.object.transformLocal, pose.transform.matrix);
                this.object.setDirty();
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

    xrSessionStart(session) {
        session
            .requestReferenceSpace('viewer')
            .then(
                function (refSpace) {
                    this.xrViewerSpace = refSpace;
                    session
                        .requestHitTestSource({space: this.xrViewerSpace})
                        .then(
                            function (hitTestSource) {
                                this.xrHitTestSource = hitTestSource;
                            }.bind(this)
                        )
                        .catch(console.error);
                }.bind(this)
            )
            .catch(console.error);
    }

    xrSessionEnd() {
        if (!this.xrHitTestSource) return;
        this.xrHitTestSource.cancel();
        this.xrHitTestSource = null;
    }
}
