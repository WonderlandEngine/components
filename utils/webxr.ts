import {Object3D} from '@wonderlandengine/api';

const tempVec = new Float32Array(3);
const tempQuat = new Float32Array(4);

export function setXRRigidTransformLocal(o: Object3D, transform: XRRigidTransform) {
    const r = transform.orientation;
    tempQuat[0] = r.x;
    tempQuat[1] = r.y;
    tempQuat[2] = r.z;
    tempQuat[3] = r.w;

    const t = transform.position;
    tempVec[0] = t.x;
    tempVec[1] = t.y;
    tempVec[2] = t.z;

    o.resetPositionRotation();
    o.setRotationLocal(tempQuat);
    o.translateLocal(tempVec);
}
