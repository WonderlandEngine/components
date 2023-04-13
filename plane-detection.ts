import {
    Collider,
    CollisionComponent,
    Component,
    Emitter,
    Material,
    Mesh,
    MeshAttribute,
    MeshComponent,
    MeshIndexType,
    NumberArray,
    Object3D,
    WonderlandEngine,
} from '@wonderlandengine/api';
import {property} from '@wonderlandengine/api/decorators.js';

import {setXRRigidTransformLocal} from './utils/webxr.js';

import earcut from 'earcut';

const tempVec3 = new Float32Array(3);

function extentsFromContour(out: NumberArray, points: ArrayLike<DOMPoint>) {
    if (points.length == 0) return out;

    let absMaxX = Math.abs(points[0].x);
    let absMaxZ = Math.abs(points[0].z);

    for (let i = 1; i < points.length; ++i) {
        absMaxX = Math.max(absMaxX, Math.abs(points[i].x));
        absMaxZ = Math.max(absMaxZ, Math.abs(points[i].z));
    }

    out[0] = absMaxX;
    out[1] = 0;
    out[2] = absMaxZ;
}

function within(x: number, a: number, b: number) {
    if (a > b) return x < a && x > b;
    return x > a && x < b;
}

/**
 * Check whether given point on plane's bounding box is inside plane's polygon
 *
 * @param p 3D point in plane's local space, Y value is ignored, since it is assumed
 *     that the point was checked against the plane's bounding box.
 * @param plane XRPlane that has `XRPlane.polygon`
 * @returns `true` if the point lies on the plane
 */
export function isPointLocalOnXRPlanePolygon(p: NumberArray, plane: XRPlane) {
    const points = plane.polygon;
    if (points.length < 3) return false;

    /* Count ray intersections: even == inside, odd == outside */
    const pX = p[0];
    const pZ = p[2];

    let intersections = 0;
    for (let n = 0, l = points.length - 1; n < points.length; ++n) {
        const aX = points[l].x;
        const aZ = points[l].z;
        const s = (points[n].z - aZ) / (points[n].x - aX);

        const x = Math.abs((pZ - aZ) / s);
        if (x >= 0.0 && x <= 1.0 && within(x + pX, aX, points[n].x)) ++intersections;
        l = n;
    }

    return (intersections & 1) == 0;
}

/**
 * Check whether given point on plane's bounding box is inside plane's polygon
 *
 * @param p 3D point to test. It is assumed that the point was checked against
 *     the plane's bounding box beforehand.
 * @param plane XRPlane that has `XRPlane.polygon`
 * @returns `true` if the point lies on the plane
 */
export function isPointWorldOnXRPlanePolygon(
    object: Object3D,
    p: NumberArray,
    plane: XRPlane
) {
    if (plane.polygon.length < 3) return false;
    isPointLocalOnXRPlanePolygon(object.transformPointInverseWorld(tempVec3, p), plane);
}

/**
 * Create a plane mesh from a list of contour points
 *
 * @param engine Engine to create the mesh with
 * @param points Contour points
 * @param meshToUpdate Optional mesh to update instead of creating a new one.
 */
function planeMeshFromContour(
    engine: WonderlandEngine,
    points: ArrayLike<DOMPoint>,
    meshToUpdate: Mesh | null = null
) {
    const vertexCount = points.length;
    const vertices = new Float32Array(vertexCount * 2);
    for (let i = 0, d = 0; i < vertexCount; ++i, d += 2) {
        vertices[d] = points[i].x;
        vertices[d + 1] = points[i].z;
    }
    const triangles = earcut(vertices);
    const mesh =
        meshToUpdate ||
        new Mesh(engine, {
            vertexCount,
            /* Assumption here that we will never have more than 256 points
             * in the detected plane meshes! */
            indexType: MeshIndexType.UnsignedByte,
            indexData: triangles,
        });
    if (mesh.vertexCount !== vertexCount) {
        console.warn('vertexCount of meshToUpdate did not match required vertexCount');
        return mesh;
    }
    const positions = mesh.attribute(MeshAttribute.Position);
    const textureCoords = mesh.attribute(MeshAttribute.TextureCoordinate);
    const normals = mesh.attribute(MeshAttribute.Normal);
    tempVec3[1] = 0;
    for (let i = 0, s = 0; i < vertexCount; ++i, s += 2) {
        tempVec3[0] = vertices[s];
        tempVec3[2] = vertices[s + 1];
        positions!.set(i, tempVec3);
    }
    textureCoords?.set(0, vertices);
    if (normals) {
        tempVec3[0] = 0;
        tempVec3[1] = 1;
        tempVec3[2] = 0;
        for (let i = 0; i < vertexCount; ++i) {
            normals.set(i, tempVec3);
        }
    }
    if (meshToUpdate) mesh.update();
    return mesh;
}

export class PlaneDetection extends Component {
    static TypeName = 'plane-detection';

    /**
     * Material to assign to created plane meshes or `null` if meshes should not be created.
     */
    @property.material()
    planeMaterial: Material | null = null;

    /**
     * Collision mask to assign to newly created collision components or a negative value if
     * collision components should not be created.
     */
    @property.int()
    collisionMask = -1;

    planes: Map<XRPlane, DOMHighResTimeStamp> = new Map();
    planeObjects: Map<XRPlane, Object3D> = new Map();

    /** Called when a plane starts tracking */
    onPlaneFound = new Emitter<[XRPlane, Object3D]>();

    /** Called when a plane stops tracking */
    onPlaneLost = new Emitter<[XRPlane, Object3D]>();

    update() {
        if (!this.engine.xr?.frame) return;
        // @ts-ignore
        if (this.engine.xr.frame.detectedPlanes === undefined) {
            console.error('plane-detection: WebXR feature not available.');
            this.active = false;
            return;
        }

        // @ts-ignore
        const detectedPlanes: Set<XRPlane> = this.engine.xr.frame.detectedPlanes;
        for (const [plane, _] of this.planes) {
            if (!detectedPlanes.has(plane)) {
                this.#planeLost(plane);
            }
        }
        detectedPlanes.forEach((plane: XRPlane) => {
            if (this.planes.has(plane)) {
                if (plane.lastChangedTime > this.planes.get(plane)!) {
                    this.#planeUpdate(plane);
                }
            } else {
                this.#planeFound(plane);
            }
            this.#planeUpdatePose(plane);
        });
    }

    #planeLost(plane: XRPlane) {
        this.planes.delete(plane);
        const o = this.planeObjects.get(plane)!;
        this.onPlaneLost.notify(plane, o);
        /* User might destroy the object */
        if (o.objectId > 0) o.destroy();
    }

    #planeFound(plane: XRPlane) {
        this.planes.set(plane, plane.lastChangedTime);
        const o = this.engine.scene.addObject(this.object);
        this.planeObjects.set(plane, o);

        if (this.planeMaterial) {
            o.addComponent(MeshComponent, {
                mesh: planeMeshFromContour(this.engine, plane.polygon),
                material: this.planeMaterial,
            });
        }

        if (this.collisionMask >= 0) {
            extentsFromContour(tempVec3, plane.polygon);
            tempVec3[1] = 0.025;
            o.addComponent(CollisionComponent, {
                group: this.collisionMask,
                collider: Collider.Box,
                extents: tempVec3,
            });
        }

        this.onPlaneFound.notify(plane, o);
    }

    #planeUpdate(plane: XRPlane) {
        this.planes.set(plane, plane.lastChangedTime);
        const planeMesh = this.planeObjects.get(plane)!.getComponent(MeshComponent);
        if (!planeMesh) return;
        planeMeshFromContour(this.engine, plane.polygon, planeMesh.mesh);
    }

    #planeUpdatePose(plane: XRPlane) {
        const o = this.planeObjects.get(plane)!;
        const pose = this.engine.xr!.frame.getPose(
            plane.planeSpace,
            this.engine.xr!.currentReferenceSpace
        );
        if (!pose) {
            o.active = false;
            return;
        }
        setXRRigidTransformLocal(o, pose.transform);
    }
}
