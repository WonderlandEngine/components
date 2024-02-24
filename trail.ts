import {
    Component,
    Mesh,
    MeshIndexType,
    MeshAttribute,
    Material,
    Object3D,
    MeshComponent,
} from '@wonderlandengine/api';
import {property} from '@wonderlandengine/api/decorators.js';
import {vec3} from 'gl-matrix';

const direction = vec3.create();
const offset = vec3.create();
const normal = vec3.create();

const UP = vec3.fromValues(0, 1, 0);

/**
 * Dynamic mesh-based trail
 *
 * This component keeps track of the world position of the object it's added to.
 * At a fixed interval the world position is stored as start and end points of the trail segments.
 *
 * The trail tapers off along its length. UV texture coordinates are setup such that the
 * U-axis covers the width of the trail and the V-axis covers the length of the trail.
 * This allows the trail's appearance to be defined using a texture.
 */
export class Trail extends Component {
    static TypeName = 'trail';

    /** The material to apply to the trail mesh */
    @property.material()
    material: Material | null = null;

    /** The number of segments in the trail mesh */
    @property.int(50)
    segments = 50;

    /** The time interval before recording a new point */
    @property.float(50)
    interval = 0.1;

    /** The width of the trail (in world space) */
    @property.float(1.0)
    width = 1.0;

    /** Whether or not the trail should taper off */
    @property.bool(true)
    taper = true;

    /**
     * The maximum delta time in seconds, above which the trail resets.
     * This prevents the trail from jumping around when updates happen
     * infrequently (e.g. when the tab doesn't have focus).
     */
    @property.float(1.0)
    resetThreshold = 0.5;

    private currentPointIndex = 0;
    private timeTillNext = 0;
    private points: Array<vec3> = [];
    private trailContainer: Object3D | null = null;
    private meshComp: MeshComponent | null = null;
    private mesh: Mesh | null = null;
    private indexData: Uint32Array | null = null;

    start() {
        this.points = new Array(this.segments + 1);
        for (let i = 0; i < this.points.length; ++i) {
            this.points[i] = vec3.create();
        }

        /* The points array is circular, so keep track of its head */
        this.timeTillNext = this.interval;

        this.trailContainer = this.engine.scene.addObject();

        this.meshComp = this.trailContainer.addComponent('mesh')!;
        this.meshComp.material = this.material;

        /* Each point will have two vertices; one on either side */
        const vertexCount = 2 * this.points.length;
        /* Each segment consists of two triangles */
        this.indexData = new Uint32Array(6 * this.segments);
        for (let i = 0, v = 0; i < vertexCount - 2; i += 2, v += 6) {
            this.indexData
                .subarray(v, v + 6)
                .set([i + 1, i + 0, i + 2, i + 2, i + 3, i + 1]);
        }

        this.mesh = new Mesh(this.engine, {
            vertexCount: vertexCount,
            indexData: this.indexData,
            indexType: MeshIndexType.UnsignedInt,
        });
        this.meshComp.mesh = this.mesh;
    }

    updateVertices() {
        if (!this.mesh) return;

        const positions = this.mesh.attribute(MeshAttribute.Position)!;
        const texCoords = this.mesh.attribute(MeshAttribute.TextureCoordinate);
        const normals = this.mesh.attribute(MeshAttribute.Normal);

        vec3.set(direction, 0, 0, 0);
        for (let i = 0; i < this.points.length; ++i) {
            const curr = this.points[(this.currentPointIndex + i + 1) % this.points.length];
            const next = this.points[(this.currentPointIndex + i + 2) % this.points.length];

            /* The last point has no next, so re-use the direction of the previous segment */
            if (i !== this.points.length - 1) {
                vec3.sub(direction, next, curr);
            }
            vec3.cross(offset, UP, direction);
            vec3.normalize(offset, offset);
            const timeFraction = 1.0 - this.timeTillNext / this.interval;
            const fraction = (i - timeFraction) / this.segments;
            vec3.scale(offset, offset, ((this.taper ? fraction : 1.0) * this.width) / 2.0);

            positions.set(i * 2, [
                curr[0] - offset[0],
                curr[1] - offset[1],
                curr[2] - offset[2],
            ]);
            positions.set(i * 2 + 1, [
                curr[0] + offset[0],
                curr[1] + offset[1],
                curr[2] + offset[2],
            ]);

            if (normals) {
                vec3.cross(normal, direction, offset);
                vec3.normalize(normal, normal);
                normals.set(i * 2, normal);
                normals.set(i * 2 + 1, normal);
            }
            if (texCoords) {
                texCoords.set(i * 2, [0, fraction]);
                texCoords.set(i * 2 + 1, [1, fraction]);
            }
        }

        /* Notify WLE that the mesh has changed */
        this.mesh.update();
    }

    resetTrail() {
        this.object.getPositionWorld(this.points[0]);
        for (let i = 1; i < this.points.length; ++i) {
            vec3.copy(this.points[i], this.points[0]);
        }
        this.currentPointIndex = 0;

        this.timeTillNext = this.interval;
    }

    update(dt: number) {
        this.timeTillNext -= dt;
        if (dt > this.resetThreshold) {
            this.resetTrail();
        }

        if (this.timeTillNext < 0) {
            this.currentPointIndex = (this.currentPointIndex + 1) % this.points.length;
            this.timeTillNext = (this.timeTillNext % this.interval) + this.interval;
        }
        this.object.getPositionWorld(this.points[this.currentPointIndex]);

        this.updateVertices();
    }

    onActivate() {
        this.resetTrail();
        if (this.meshComp) this.meshComp.active = true;
    }

    onDeactivate() {
        if (this.meshComp) this.meshComp.active = false;
    }

    onDestroy() {
        if (this.trailContainer) this.trailContainer.destroy();
        if (this.meshComp) this.meshComp.destroy();
        if (this.mesh) this.mesh.destroy();
    }
}
