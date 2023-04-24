import {Component, Type} from '@wonderlandengine/api';
import {vec3, quat, quat2} from 'gl-matrix';
import {setXRRigidTransformLocal} from './utils/webxr.js';

const ORDERED_JOINTS = [
    'wrist',
    'thumb-metacarpal',
    'thumb-phalanx-proximal',
    'thumb-phalanx-distal',
    'thumb-tip',
    'index-finger-metacarpal',
    'index-finger-phalanx-proximal',
    'index-finger-phalanx-intermediate',
    'index-finger-phalanx-distal',
    'index-finger-tip',
    'middle-finger-metacarpal',
    'middle-finger-phalanx-proximal',
    'middle-finger-phalanx-intermediate',
    'middle-finger-phalanx-distal',
    'middle-finger-tip',
    'ring-finger-metacarpal',
    'ring-finger-phalanx-proximal',
    'ring-finger-phalanx-intermediate',
    'ring-finger-phalanx-distal',
    'ring-finger-tip',
    'pinky-finger-metacarpal',
    'pinky-finger-phalanx-proximal',
    'pinky-finger-phalanx-intermediate',
    'pinky-finger-phalanx-distal',
    'pinky-finger-tip',
];

/**
 * Easy hand tracking through the WebXR Device API
 * ["Hand Input" API](https://immersive-web.github.io/webxr-hand-input/).
 *
 * Allows displaying hands either as sphere-joints or skinned mesh.
 *
 * To react to grabbing, use `this.isGrabbing()`. For other gestures, refer
 * to `this.joints` - an array of [WL.Object](/jsapi/object) and use the joint
 * indices listed [in the WebXR Hand Input specification](https://immersive-web.github.io/webxr-hand-input/#skeleton-joints-section).
 *
 * It is often desired to use either hand tracking or controllers, not both.
 * This component provides `deactivateChildrenWithoutPose` to hide the hand
 * tracking visualization if no pose is available and `controllerToDeactivate`
 * for disabling another object once a hand tracking pose *is* available.
 * Outside of XR sessions, tracking or controllers are neither enabled nor disabled
 * to play well with the [vr-mode-active-switch](#vr-mode-active-switch) component.
 *
 * **Requirements:**
 *  - To use hand-tracking, enable "joint tracking" in `chrome://flags` on
 *    Oculus Browser for Oculus Quest/Oculus Quest 2.
 *
 * See [Hand Tracking Example](/showcase/hand-tracking).
 */
export class HandTracking extends Component {
    static TypeName = 'hand-tracking';
    static Properties = {
        /** Handedness determining whether to receive tracking input from right or left hand */
        handedness: {type: Type.Enum, default: 'left', values: ['left', 'right']},
        /** (optional) Mesh to use to visualize joints */
        jointMesh: {type: Type.Mesh, default: null},
        /** Material to use for display. Applied to either the spawned skinned mesh or the joint spheres. */
        jointMaterial: {type: Type.Material, default: null},
        /** (optional) Skin to apply tracked joint poses to. If not present, joint spheres will be used for display instead. */
        handSkin: {type: Type.Skin, default: null},
        /** Deactivate children if no pose was tracked */
        deactivateChildrenWithoutPose: {type: Type.Bool, default: true},
        /** Controller objects to activate including children if no pose is available */
        controllerToDeactivate: {type: Type.Object},
    };

    init() {
        this.handedness = ['left', 'right'][this.handedness];
    }

    joints = {};
    session = null;
    /* Whether last update had a hand pose */
    hasPose = false;
    _childrenActive = true;

    start() {
        if (!('XRHand' in window)) {
            console.warn('WebXR Hand Tracking not supported by this browser.');
            this.active = false;
            return;
        }

        if (this.handSkin) {
            let skin = this.handSkin;
            let jointIds = skin.jointIds;
            /* Map the wrist */
            this.joints[ORDERED_JOINTS[0]] = this.engine.wrapObject(jointIds[0]);

            /* Index in ORDERED_JOINTS that we are mapping to our joints */
            /* Skip thumb0 joint, start at thumb1 */
            for (let j = 0; j < jointIds.length; ++j) {
                let joint = this.engine.wrapObject(jointIds[j]);
                /* tip joints are only needed for joint rendering, so we skip those while mapping */
                this.joints[joint.name] = joint;
            }

            /* If we have a hand skin, no need to spawn the joints-based one */
            return;
        }

        /* Spawn joints */
        const jointObjects = this.engine.scene.addObjects(
            ORDERED_JOINTS.length,
            this.object.parent,
            ORDERED_JOINTS.length
        );
        for (let j = 0; j < ORDERED_JOINTS.length; ++j) {
            let joint = jointObjects[j];
            joint.addComponent(MeshComponent, {
                mesh: this.jointMesh,
                material: this.jointMaterial,
            });

            this.joints[ORDERED_JOINTS[j]] = joint;
        }
    }

    update(dt) {
        if (!this.session) {
            if (this.engine.xr) this.setupVREvents(this.engine.xr.session);
        }

        if (!this.session) return;

        this.hasPose = false;
        if (this.session && this.session.inputSources) {
            for (let i = 0; i <= this.session.inputSources.length; ++i) {
                const inputSource = this.session.inputSources[i];
                if (
                    !inputSource ||
                    !inputSource.hand ||
                    inputSource.handedness != this.handedness
                )
                    continue;
                this.hasPose = true;

                if (inputSource.hand.get('wrist') !== null) {
                    const p = this.engine.xr.frame.getJointPose(
                        inputSource.hand.get('wrist'),
                        this.engine.xr.currentReferenceSpace
                    );
                    if (p) {
                        setXRRigidTransformLocal(this.object, p.transform);
                    }
                }

                let invTranslation = new Float32Array(3);
                let invRotation = new Float32Array(4);
                quat.invert(invRotation, this.object.transformLocal);
                this.object.getTranslationLocal(invTranslation);

                for (let j = 0; j < ORDERED_JOINTS.length; ++j) {
                    const jointName = ORDERED_JOINTS[j];
                    const joint = this.joints[jointName];
                    if (joint == null) continue;

                    let jointPose = null;
                    if (inputSource.hand.get(jointName) !== null) {
                        jointPose = this.engine.xr.frame.getJointPose(
                            inputSource.hand.get(jointName),
                            this.engine.xr.currentReferenceSpace
                        );
                    }
                    if (jointPose !== null) {
                        if (this.handSkin) {
                            joint.resetTranslationRotation();

                            joint.translate([
                                jointPose.transform.position.x - invTranslation[0],
                                jointPose.transform.position.y - invTranslation[1],
                                jointPose.transform.position.z - invTranslation[2],
                            ]);
                            joint.rotate(invRotation);
                            joint.rotateObject([
                                jointPose.transform.orientation.x,
                                jointPose.transform.orientation.y,
                                jointPose.transform.orientation.z,
                                jointPose.transform.orientation.w,
                            ]);
                        } else {
                            setXRRigidTransformLocal(this.object, p.transform);

                            /* Last joint radius of each finger is null */
                            const r = jointPose.radius || 0.007;
                            joint.scale([r, r, r]);
                        }
                    } else {
                        /* Hack to hide the object */
                        if (!this.handSkin) joint.scale([0, 0, 0]);
                    }
                }
            }
        }

        if (!this.hasPose && this._childrenActive) {
            this._childrenActive = false;

            if (this.deactivateChildrenWithoutPose) {
                this.setChildrenActive(false);
            }

            if (this.controllerToDeactivate) {
                this.controllerToDeactivate.active = true;
                this.setChildrenActive(true, this.controllerToDeactivate);
            }
        } else if (this.hasPose && !this._childrenActive) {
            this._childrenActive = true;

            if (this.deactivateChildrenWithoutPose) {
                this.setChildrenActive(true);
            }

            if (this.controllerToDeactivate) {
                this.controllerToDeactivate.active = false;
                this.setChildrenActive(false, this.controllerToDeactivate);
            }
        }
    }

    setChildrenActive(active, object) {
        object = object || this.object;

        const children = object.children;
        for (const o of children) {
            o.active = active;
            this.setChildrenActive(active, o);
        }
    }

    isGrabbing() {
        const indexTipPos = [0, 0, 0];
        quat2.getTranslation(indexTipPos, this.joints['index-finger-tip'].transformLocal);
        const thumbTipPos = [0, 0, 0];
        quat2.getTranslation(thumbTipPos, this.joints['thumb-tip'].transformLocal);

        return vec3.sqrDist(thumbTipPos, indexTipPos) < 0.001;
    }

    setupVREvents(s) {
        this.session = s;
    }
}
