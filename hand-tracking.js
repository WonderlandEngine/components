import {vec3,quat,quat2} from 'gl-matrix';
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
 * **Requirements:**
 *  - To use hand-tracking, enable "joint tracking" in `chrome://flags` on
 *    Oculus Browser for Oculus Quest/Oculus Quest 2.
 *
 * See [Hand Tracking Example](/showcase/hand-tracking).
 */
WL.registerComponent('hand-tracking', {
    /** Handedness determining whether to receive tracking input from right or left hand */
    handedness: {type: WL.Type.Enum, default: 'left', values: ['left', 'right']},
    /** (optional) Skinned mesh to use for display */
    jointMesh: {type: WL.Type.Mesh, default: null},
    /** Material to use for display. Applied to either the spawned skinned mesh or the joint spheres. */
    jointMaterial: {type: WL.Type.Material, default: null},
    /** (optional) Skin to apply tracked joint poses to. If not present, joint spheres will be used for display instead. */
    handSkin: {type: WL.Type.Skin, default: null}
}, {
    ORDERED_JOINTS: [
        "wrist",
        "thumb-metacarpal", "thumb-phalanx-proximal", "thumb-phalanx-distal", "thumb-tip",
        "index-finger-metacarpal", "index-finger-phalanx-proximal", "index-finger-phalanx-intermediate", "index-finger-phalanx-distal", "index-finger-tip",
        "middle-finger-metacarpal", "middle-finger-phalanx-proximal", "middle-finger-phalanx-intermediate", "middle-finger-phalanx-distal", "middle-finger-tip",
        "ring-finger-metacarpal", "ring-finger-phalanx-proximal", "ring-finger-phalanx-intermediate", "ring-finger-phalanx-distal", "ring-finger-tip",
        "pinky-finger-metacarpal", "pinky-finger-phalanx-proximal", "pinky-finger-phalanx-intermediate", "pinky-finger-phalanx-distal", "pinky-finger-tip"
    ],
    init: function() {
        this.handedness = ['left', 'right'][this.handedness];
    },
    start: function() {
        this.joints = [];
        this.session = null;
        this.refSpace = null;
        /* Whether last update had a hand pose */
        this.hasPose = false;

        if(!('XRHand' in window)) {
            console.warn("WebXR Hand Tracking not supported by this browser.");
            this.active = false;
            return;
        }

        if(this.handSkin) {
            let skin = this.handSkin;
            let jointIds = skin.jointIds;
            /* Map the wrist */
            this.joints[this.ORDERED_JOINTS[0]] = new WL.Object(jointIds[0]);

            /* Index in ORDERED_JOINTS that we are mapping to our joints */
            let fingerIndex = 1;
            /* Skip thumb0 joint, start at thumb1 */
            for(let j = 2; j < jointIds.length; ++j, ++fingerIndex) {
                let joint = new WL.Object(jointIds[j]);
                /* tip joints are only needed for joint rendering, so we skip those while mapping */
                if(joint.name.endsWith('index_null') || joint.name.endsWith('middle_null') || joint.name.endsWith('thumb_null')) {
                    ++fingerIndex;
                }
                this.joints[this.ORDERED_JOINTS[fingerIndex]] = joint;
            }

            /* If we have a hand skin, no need to spawn the joints-based one */
            return;
        }

        /* Spawn joints */
        for(let j = 0; j <= this.ORDERED_JOINTS.length; ++j) {
            let joint = WL.scene.addObject(this.object.parent);
            let mesh = joint.addComponent('mesh');

            mesh.mesh = this.jointMesh;
            mesh.material = this.jointMaterial;

            this.joints[this.ORDERED_JOINTS[j]] = joint;
        }
    },
    update: function(dt) {
        if(!this.session) {
            if(WL.xrSession) this.setupVREvents(WL.xrSession);
        }

        this.hasPose = false;
        if(this.session && this.session.inputSources && this.refSpace) {
            for(let i = 0; i <= this.session.inputSources.length; ++i) {
                const inputSource = this.session.inputSources[i];
                if(!inputSource || !inputSource.hand || inputSource.handedness != this.handedness) continue;
                this.hasPose = true;

                if(inputSource.hand.get('wrist') !== null) {
                    const p = Module['webxr_frame'].getJointPose(inputSource.hand.get('wrist'), this.refSpace);
                    if(p) {
                        this.object.resetTranslationRotation();
                        this.object.transformLocal.set([
                            p.transform.orientation.x,
                            p.transform.orientation.y,
                            p.transform.orientation.z,
                            p.transform.orientation.w]);
                        this.object.translate([
                            p.transform.position.x,
                            p.transform.position.y,
                            p.transform.position.z]);
                    }
                }

                let invTranslation = new Float32Array(3);
                let invRotation = new Float32Array(4);
                quat.invert(invRotation, this.object.transformLocal);
                this.object.getTranslationLocal(invTranslation);

                for(let j = 0; j < this.ORDERED_JOINTS.length; ++j) {
                    const jointName = this.ORDERED_JOINTS[j];
                    const joint = this.joints[jointName];
                    if(joint == null) continue;

                    let jointPose = null;
                    if(inputSource.hand.get(jointName) !== null) {
                        jointPose = Module['webxr_frame'].getJointPose(inputSource.hand.get(jointName), this.refSpace);
                    }
                    if(jointPose !== null) {
                        if(this.handSkin) {
                            joint.resetTranslationRotation();

                            joint.translate([
                                100*(jointPose.transform.position.x - invTranslation[0]),
                                100*(jointPose.transform.position.y - invTranslation[1]),
                                100*(jointPose.transform.position.z - invTranslation[2])]);
                            joint.rotate(invRotation);
                            joint.rotateObject([
                                jointPose.transform.orientation.x,
                                jointPose.transform.orientation.y,
                                jointPose.transform.orientation.z,
                                jointPose.transform.orientation.w]);
                        } else {
                            joint.resetTransform();
                            joint.transformLocal.set([
                                jointPose.transform.orientation.x,
                                jointPose.transform.orientation.y,
                                jointPose.transform.orientation.z,
                                jointPose.transform.orientation.w]);
                            joint.translate([
                                jointPose.transform.position.x,
                                jointPose.transform.position.y,
                                jointPose.transform.position.z]);

                            /* Last joint radius of each finger is null */
                            const r = jointPose.radius || 0.007;
                            joint.scale([r, r, r]);
                        }
                    } else {
                        /* Hack to hide the object */
                        if(!this.handSkin) joint.scale([0, 0, 0]);
                    }
                }
            }
        }
    },

    isGrabbing: function() {
        const indexTipPos = [0, 0, 0];
        quat2.getTranslation(indexTipPos, this.joints['index-finger-tip'].transformLocal);
        const thumbTipPos = [0, 0, 0];
        quat2.getTranslation(thumbTipPos, this.joints['thumb-tip'].transformLocal);

        return vec3.sqrDist(thumbTipPos, indexTipPos) < 0.001;
    },

    setupVREvents: function(s) {
        s.requestReferenceSpace('local').then(function(refSpace) { this.refSpace = refSpace; }.bind(this));
        this.session = s;
    },
});
