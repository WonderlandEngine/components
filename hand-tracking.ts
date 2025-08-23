import {
    Component,
    MeshComponent,
    Object3D,
    Mesh,
    Skin,
    Material,
} from '@wonderlandengine/api';
import {property} from '@wonderlandengine/api/decorators.js';
import {VrModeActiveSwitch} from './vr-mode-active-switch.js';
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
const tempRotation = quat.create();
const tempScaling = vec3.create();
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

    onActivate(): void {
        const vrModeActiveSwitchCompForHand = this.object.getComponent(VrModeActiveSwitch);

        const VrModeActiveSwitchCompForController =
            this.controllerToDeactivate!.getComponent(VrModeActiveSwitch);

        if (vrModeActiveSwitchCompForHand) vrModeActiveSwitchCompForHand.active = false;
        if (VrModeActiveSwitchCompForController)
            VrModeActiveSwitchCompForController.active = false;

        this.setChildrenActive(false, this.controllerToDeactivate!);
        this.setChildrenActive(false);
    }

    onDeactivate(): void {
        const vrModeActiveSwitchCompForHand = this.object.getComponent(VrModeActiveSwitch);

        const VrModeActiveSwitchCompForController =
            this.controllerToDeactivate!.getComponent(VrModeActiveSwitch);

        if (vrModeActiveSwitchCompForHand) vrModeActiveSwitchCompForHand.active = true;
        if (VrModeActiveSwitchCompForController)
            VrModeActiveSwitchCompForController.active = true;
    }

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
            this.joints[ORDERED_JOINTS[0]] = this.engine.scene.wrap(jointIds[0]);

            /* Index in ORDERED_JOINTS that we are mapping to our joints */
            /* Skip thumb0 joint, start at thumb1 */
            for (let j = 0; j < jointIds.length; ++j) {
                const joint = this.engine.scene.wrap(jointIds[j]);
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
        const inputSources = this.engine.xr.session.inputSources;
        if (!inputSources) return;
        for (const inputSource of inputSources) {
            if (inputSource.hand && inputSource.handedness === this.handedness) {
                // Handle hand tracking input
                this.updateHandPose(inputSource);
                this.hasPose = true;
            }
        }
        this.manageVisibility();
    }

    updateHandPose(inputSource: XRInputSource) {
        const wristSpace = (inputSource.hand as unknown as XRHand).get('wrist');

        if (wristSpace) {
            const pose = this.engine.xr!.frame!.getJointPose!(
                wristSpace,
                this.engine.xr!.currentReferenceSpace
            );
            if (pose) {
                setXRRigidTransformLocal(this.object, pose.transform);
            }
        }

        this.object.getRotationLocal(invRotation);
        quat.conjugate(invRotation, invRotation);
        this.object.getPositionLocal(invTranslation);

        for (const jointName of ORDERED_JOINTS) {
            const joint = this.joints[jointName];
            if (!joint) continue;

            const jointSpace = (inputSource.hand as unknown as XRHand).get(jointName);
            if (!jointSpace) continue;

            const jointPose = this.engine.xr!.frame!.getJointPose!(
                jointSpace,
                this.engine.xr!.currentReferenceSpace
            );

            if (!jointPose) continue;
            joint.resetPositionRotation();
            joint.translateLocal([
                jointPose.transform.position.x - invTranslation[0],
                jointPose.transform.position.y - invTranslation[1],
                jointPose.transform.position.z - invTranslation[2],
            ]);
            joint.rotateLocal(invRotation);

            tempRotation[0] = jointPose.transform.orientation.x;
            tempRotation[1] = jointPose.transform.orientation.y;
            tempRotation[2] = jointPose.transform.orientation.z;
            tempRotation[3] = jointPose.transform.orientation.w;

            joint.rotateObject(tempRotation);

            if (!this.handSkin) {
                const radius = jointPose.radius || 0.007;
                tempScaling[0] = radius;
                tempScaling[1] = radius;
                tempScaling[2] = radius;
                joint.setScalingLocal(tempScaling);
            }
        }
    }

    manageVisibility() {
        const hasHandPose = this.hasPose;

        // If no hand pose and children are currently active, deactivate them
        if (!hasHandPose && this._childrenActive) {
            this._childrenActive = false;

            if (this.deactivateChildrenWithoutPose) {
                this.setChildrenActive(false); // Deactivate hand tracking
            }

            if (this.controllerToDeactivate) {
                this.controllerToDeactivate.active = true; // Activate controller visualization
                this.setChildrenActive(true, this.controllerToDeactivate);
            }
        }
        // If hand pose is available and children are inactive, activate them
        else if (hasHandPose && !this._childrenActive) {
            this._childrenActive = true;

            if (this.deactivateChildrenWithoutPose) {
                this.setChildrenActive(true); // Activate hand tracking
            }

            if (this.controllerToDeactivate) {
                this.controllerToDeactivate.active = false; // Deactivate controller visualization
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

    onSessionEnd() {
        // Reset visibility states for hand tracking and controllers
        this._childrenActive = false;

        if (this.controllerToDeactivate) {
            this.controllerToDeactivate.active = true;
            this.setChildrenActive(true, this.controllerToDeactivate);
        }

        // Deactivate hand tracking visualization
        this.setChildrenActive(false);
    }

    onSessionStart() {
        // Initialize state on session start
        this._childrenActive = false;

        // Ensure visibility is set based on the current input source
        this.manageVisibility();
    }
}
