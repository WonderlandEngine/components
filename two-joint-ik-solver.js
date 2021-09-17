import {vec3, quat} from 'gl-matrix';

Math.clamp = function(v, a, b) {
    return Math.max(a, Math.min(v, b));
}

// From http://theorangeduck.com/page/simple-two-joint
const twoJointIK = (function() {
    let ta = new Float32Array(3);
    let ca = new Float32Array(3);
    let ba = new Float32Array(3);
    let ab = new Float32Array(3);
    let cb = new Float32Array(3);

    let axis0 = new Float32Array(3);
    let axis1 = new Float32Array(3);

    let temp = new Float32Array(4);

    let r0 = new Float32Array(4);
    let r1 = new Float32Array(4);
    let r2 = new Float32Array(4);

    return function(a_lr, b_lr, a, b, c, t, eps, a_gr, b_gr, helper) {
        vec3.sub(ba, b, a);
        const lab = vec3.length(ba);
        vec3.sub(ta, b, c);
        const lcb = vec3.length(ta);
        vec3.sub(ta, t, a);
        const lat = Math.clamp(vec3.length(ta), eps, lab + lcb - eps);

        vec3.sub(ca, c, a);
        vec3.sub(ab, a, b);
        vec3.sub(cb, c, b);

        vec3.normalize(ca, ca);
        vec3.normalize(ba, ba);
        vec3.normalize(ab, ab);
        vec3.normalize(cb, cb);
        vec3.normalize(ta, ta);

        const ac_ab_0 = Math.acos(Math.clamp(vec3.dot(ca, ba), -1, 1));
        const ba_bc_0 = Math.acos(Math.clamp(vec3.dot(ab, cb), -1, 1));
        const ac_at_0 = Math.acos(Math.clamp(vec3.dot(ca, ta), -1, 1));

        const ac_ab_1 = Math.acos(Math.clamp((lcb*lcb-lab*lab-lat*lat) / (-2*lab*lat), -1, 1));
        const ba_bc_1 = Math.acos(Math.clamp((lat*lat-lab*lab-lcb*lcb) / (-2*lab*lcb), -1, 1));

        vec3.sub(ca, c, a);
        vec3.sub(ba, b, a);
        vec3.sub(ta, t, a);

        vec3.cross(axis0, ca, ba);
        vec3.cross(axis1, ca, ta);

        if(helper) {
            vec3.sub(ba, helper, b);
            vec3.transformQuat(ba, [0, 0, -1], b_gr);
        } else {
            vec3.sub(ba, b, a);
        }

        const l = vec3.length(axis0);
        if(l == 0) {
            axis0.set([1, 0, 0]);
        } else {
            vec3.scale(axis0, axis0, 1/l);
        }
        vec3.normalize(axis1, axis1);

        quat.conjugate(a_gr, a_gr);
        quat.setAxisAngle(r0, vec3.transformQuat(temp, axis0, a_gr), (ac_ab_1 - ac_ab_0));
        quat.setAxisAngle(r2, vec3.transformQuat(temp, axis1, a_gr), (ac_at_0));
        quat.mul(a_lr, a_lr, quat.mul(temp, r0, r2));
        quat.normalize(a_lr, a_lr);

        quat.conjugate(b_gr, b_gr);
        quat.setAxisAngle(r1, vec3.transformQuat(temp, axis0, b_gr), (ba_bc_1 - ba_bc_0));
        quat.mul(b_lr, b_lr, r1);
        quat.normalize(b_lr, b_lr);
    }
})();

/**
 * Inverse Kinematics for two-joint chains (e.g. knees or ellbows)
 */
WL.registerComponent('two-joint-ik-solver', {
    /** Root bone, never moves */
    root: {type: WL.Type.Object},
    /** Bone attached to the root */
    middle: {type: WL.Type.Object},
    /** Bone attached to the middle */
    end: {type: WL.Type.Object},
    /** Target the joins should reach for */
    target: {type: WL.Type.Object},
    /** Helper object to use to determine joint rotation axis */
    helper: {type: WL.Type.Object},
}, {
    init: function() {
        this.pos = new Float32Array(3*7);
        this.p = [
            this.pos.subarray(0, 3),
            this.pos.subarray(3, 6),
            this.pos.subarray(6, 9),
            this.pos.subarray(9, 12),
            this.pos.subarray(12, 15),
            this.pos.subarray(15, 18),
            this.pos.subarray(18, 21)];
    },
    update: function() {
        const p = this.p;
        this.root.getTranslationWorld(p[0]);
        this.middle.getTranslationWorld(p[1]);
        this.end.getTranslationWorld(p[2]);
        this.target.getTranslationWorld(p[3]);
        const tla = p[4];
        const tlb = p[5];
        this.root.getTranslationLocal(tla);
        this.middle.getTranslationLocal(tlb);
        if(this.helper) this.helper.getTranslationWorld(p[6]);

        twoJointIK(this.root.transformLocal, this.middle.transformLocal,
            p[0], p[1], p[2], p[3], 0.01,
            this.root.transformWorld.subarray(0, 4),
            this.middle.transformWorld.subarray(0, 4),
            this.helper ? p[6] : null
        );

        this.root.setTranslationLocal(tla);
        this.middle.setTranslationLocal(tlb);

        this.root.setDirty();
        this.middle.setDirty();
    },
});
