import {Component, Property} from '@wonderlandengine/api';
import {vec3} from 'gl-matrix';

function clamp(v, a, b) {
    return Math.max(a, Math.min(v, b));
}

const rootScaling = new Float32Array(3);
const tempQuat = new Float32Array(4);

const middlePos = new Float32Array(3);
const endPos = new Float32Array(3);
const targetPos = new Float32Array(3);
const helperPos = new Float32Array(3);

const rootTransform = new Float32Array(8);
const middleTransform = new Float32Array(8);
const endTransform = new Float32Array(8);

/**
 * Solve inverse kinematics for a two joint chains
 *
 * Inspired by http://theorangeduck.com/page/simple-two-joint
 */
const twoJointIK = (function () {
    const ta = new Float32Array(3);
    const ca = new Float32Array(3);
    const ba = new Float32Array(3);
    const ab = new Float32Array(3);
    const cb = new Float32Array(3);

    const axis0 = new Float32Array(3);
    const axis1 = new Float32Array(3);

    const temp = new Float32Array(3);

    return function (root, middle, b, c, targetPos, eps, helper) {
        /* a = [0, 0, 0], since everything is computed in root-space */
        ba.set(b);
        const lab = vec3.length(ba);
        vec3.sub(ta, b, c);
        const lcb = vec3.length(ta);
        ta.set(targetPos);
        const lat = clamp(vec3.length(ta), eps, lab + lcb - eps);

        ca.set(c);
        vec3.scale(ab, b, -1);
        vec3.sub(cb, c, b);

        vec3.normalize(ca, ca);
        vec3.normalize(ba, ba);
        vec3.normalize(ab, ab);
        vec3.normalize(cb, cb);
        vec3.normalize(ta, ta);

        /* Supposedly numerical errors can cause the dot to go out of -1, 1 range */
        const ac_ab_0 = Math.acos(clamp(vec3.dot(ca, ba), -1, 1));
        const ba_bc_0 = Math.acos(clamp(vec3.dot(ab, cb), -1, 1));
        const ac_at_0 = Math.acos(clamp(vec3.dot(ca, ta), -1, 1));

        const ac_ab_1 = Math.acos(
            clamp((lcb * lcb - lab * lab - lat * lat) / (-2 * lab * lat), -1, 1)
        );
        const ba_bc_1 = Math.acos(
            clamp((lat * lat - lab * lab - lcb * lcb) / (-2 * lab * lcb), -1, 1)
        );

        if (helper) {
            vec3.sub(ba, helper, b);
            vec3.normalize(ba, ba);
        }

        vec3.cross(axis0, ca, ba);
        vec3.normalize(axis0, axis0);

        vec3.cross(axis1, c, targetPos);
        vec3.normalize(axis1, axis1);

        middle.transformVectorInverseLocal(temp, axis0);

        root.rotateAxisAngleRadObject(axis1, ac_at_0);
        root.rotateAxisAngleRadObject(axis0, ac_ab_1 - ac_ab_0);
        middle.rotateAxisAngleRadObject(axis0, ba_bc_1 - ba_bc_0);
    };
})();

/**
 * Inverse kinematics for two-joint chains (e.g. knees or elbows)
 */
export class TwoJointIkSolver extends Component {
    static TypeName = 'two-joint-ik-solver';
    static Properties = {
        /** Root bone, never moves */
        root: Property.object(),
        /** Bone attached to the root */
        middle: Property.object(),
        /** Bone attached to the middle */
        end: Property.object(),
        /** Target the joins should reach for */
        target: Property.object(),
        /** Flag for copying rotation from target to end */
        copyTargetRotation: Property.bool(true),
        /** Helper object to use to determine joint rotation axis */
        helper: Property.object(),
    };

    time = 0;

    start() {
        this.root.getTransformLocal(rootTransform);
        this.middle.getTransformLocal(middleTransform);
        this.end.getTransformLocal(endTransform);
    }

    update(dt) {
        this.time += dt;

        /* Reset to original pose for stability */
        this.root.setTransformLocal(rootTransform);
        this.middle.setTransformLocal(middleTransform);
        this.end.setTransformLocal(endTransform);

        this.root.getScalingWorld(rootScaling);

        /* Get joint positions in root-space */
        this.middle.getPositionLocal(middlePos);

        this.end.getPositionLocal(endPos);
        this.middle.transformPointLocal(endPos, endPos);

        if (this.helper) {
            /* Get helper position in root space */
            this.helper.getPositionWorld(helperPos);
            this.root.transformPointInverseWorld(helperPos, helperPos);
            vec3.div(helperPos, helperPos, rootScaling);
        }

        /* Get target position in root space */
        this.target.getPositionWorld(targetPos);
        this.root.transformPointInverseWorld(targetPos, targetPos);
        vec3.div(targetPos, targetPos, rootScaling);

        twoJointIK(
            this.root,
            this.middle,
            middlePos,
            endPos,
            targetPos,
            0.01,
            this.helper ? helperPos : null,
            this.time
        );

        if (this.copyTargetRotation) {
            this.end.setRotationWorld(this.target.getRotationWorld(tempQuat));
        }
    }
}
