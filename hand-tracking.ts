import {
    Component,
    MeshComponent,
    Object3D,
    Mesh,
    Skin,
    Material,
} from '@wonderlandengine/api';
import {property} from '@wonderlandengine/api/decorators.js';
import {vec3, quat} from 'gl-matrix';
import {setXRRigidTransformLocal} from './utils/webxr.js';

const ORDERED_JOINTS: XRHandJoint[] = [
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

const invTranslation = vec3.create();
const invRotation = quat.create();
const tempVec0 = vec3.create();
const tempVec1 = vec3.create();

/**
 * Easy hand tracking through the WebXR Device API
 * ["Hand Input" API](https://immersive-web.github.io/webxr-hand-input/).
 *
 * Allows displaying hands either as sphere-joints or skinned mesh.
 *
 * To react to grabbing, use `this.isGrabbing()`. For other gestures, refer
 * to `this.joints` - an array of [Object3D](/jsapi/object3d) and use the joint
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

    /** Handedness determining whether to receive tracking input from right or left hand */
    @property.enum(['left', 'right'])
    handedness: string | number = 0;

    /** (optional) Mesh to use to visualize joints */
    @property.mesh()
    jointMesh: Mesh | null = null;

    /** Material to use for display. Applied to either the spawned skinned mesh or the joint spheres. */
    @property.material()
    jointMaterial: Material | null = null;

    /** (optional) Skin to apply tracked joint poses to. If not present,
     * joint spheres will be used for display instead. */
    @property.skin()
    handSkin: Skin | null = null;

    /** Deactivate children if no pose was tracked */
    @property.bool(true)
    deactivateChildrenWithoutPose = true;

    /** Controller objects to activate including children if no pose is available */
    @property.object()
    controllerToDeactivate: Object3D | null = null;

    init() {
        this.handedness = ['left', 'right'][this.handedness as number];
    }

    joints: Record<string, Object3D> = {};
    session: XRSession | null = null;
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
            const skin = this.handSkin;
            const jointIds = skin.jointIds;
            /* Map the wrist */
            this.joints[ORDERED_JOINTS[0]] = this.engine.wrapObject(jointIds[0]);

            /* Index in ORDERED_JOINTS that we are mapping to our joints */
            /* Skip thumb0 joint, start at thumb1 */
            for (let j = 0; j < jointIds.length; ++j) {
                const joint = this.engine.wrapObject(jointIds[j]);
                /* tip joints are only needed for joint rendering, so we skip those while mapping */
                this.joints[joint.name] = joint;
            }

            /* If we have a hand skin, no need to spawn the joints-based one */
            return;
        }

        /* Spawn joints */
        const jointObjects = this.engine.scene.addObjects(
            ORDERED_JOINTS.length,
            this.object,
            ORDERED_JOINTS.length
        );
        for (let j = 0; j < ORDERED_JOINTS.length; ++j) {
            const joint = jointObjects[j];
            joint.addComponent(MeshComponent, {
                mesh: this.jointMesh,
                material: this.jointMaterial,
            });

            this.joints[ORDERED_JOINTS[j]] = joint;
            joint.name = ORDERED_JOINTS[j];
        }
    }

    update(dt: number) {
        if (!this.engine.xr) return;

        this.hasPose = false;
        if (this.engine.xr.session.inputSources) {
            for (let i = 0; i < this.engine.xr.session.inputSources.length; ++i) {
                const inputSource = this.engine.xr.session.inputSources[i];
                if (!inputSource?.hand || inputSource?.handedness != this.handedness)
                    continue;

                const wristSpace = (inputSource.hand as unknown as XRHand).get('wrist');
                if (wristSpace) {
                    const p = this.engine.xr.frame.getJointPose!(
                        wristSpace,
                        this.engine.xr.currentReferenceSpace
                    );
                    if (p) {
                        setXRRigidTransformLocal(this.object, p.transform);
                    }
                }

                this.object.getRotationLocal(invRotation);
                quat.conjugate(invRotation, invRotation);
                this.object.getPositionLocal(invTranslation);

                /* There is a bone 'wrist', but it just sits on the root
                 * object. It could have an initial transform we want to
                 * clear for skinning, though. */
                this.joints['wrist'].resetTransform();

                /* Wrist is already handled, so start at 1 */
                for (let j = 0; j < ORDERED_JOINTS.length; ++j) {
                    const jointName = ORDERED_JOINTS[j];
                    const joint = this.joints[jointName];
                    if (!joint) continue;

                    let jointPose = null;
                    const jointSpace = (inputSource.hand as unknown as XRHand).get(
                        jointName
                    );
                    if (jointSpace) {
                        jointPose = this.engine.xr.frame.getJointPose!(
                            jointSpace,
                            this.engine.xr.currentReferenceSpace
                        );
                    }
                    if (jointPose) {
                        this.hasPose = true;
                        joint.resetPositionRotation();

                        joint.translateLocal([
                            jointPose.transform.position.x - invTranslation[0],
                            jointPose.transform.position.y - invTranslation[1],
                            jointPose.transform.position.z - invTranslation[2],
                        ]);
                        joint.rotateLocal(invRotation);
                        joint.rotateObject([
                            jointPose.transform.orientation.x,
                            jointPose.transform.orientation.y,
                            jointPose.transform.orientation.z,
                            jointPose.transform.orientation.w,
                        ]);

                        if (!this.handSkin) {
                            /* Last joint radius of each finger is null */
                            const r = jointPose.radius || 0.007;
                            joint.setScalingLocal([r, r, r]);
                        }
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

    setChildrenActive(active: boolean, object?: Object3D) {
        object = object || this.object;

        const children = object.children;
        for (const o of children) {
            o.active = active;
            this.setChildrenActive(active, o);
        }
    }

    isGrabbing() {
        this.joints['index-finger-tip'].getPositionLocal(tempVec0);
        this.joints['thumb-tip'].getPositionLocal(tempVec1);
        return vec3.sqrDist(tempVec0, tempVec1) < 0.001;
    }
}
