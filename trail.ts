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

    private _currentPointIndex = 0;
    private _timeTillNext = 0;
    private _points: Array<vec3> = [];
    private _trailContainer: Object3D | null = null;
    private _meshComp: MeshComponent | null = null;
    private _mesh: Mesh | null = null;
    private _indexData: Uint32Array | null = null;

    start() {
        this._points = new Array(this.segments + 1);
        for (let i = 0; i < this._points.length; ++i) {
            this._points[i] = vec3.create();
        }

        /* The points array is circular, so keep track of its head */
        this._timeTillNext = this.interval;

        this._trailContainer = this.engine.scene.addObject();

        this._meshComp = this._trailContainer.addComponent('mesh')!;
        this._meshComp.material = this.material;

        /* Each point will have two vertices; one on either side */
        const vertexCount = 2 * this._points.length;
        /* Each segment consists of two triangles */
        this._indexData = new Uint32Array(6 * this.segments);
        for (let i = 0, v = 0; i < vertexCount - 2; i += 2, v += 6) {
            this._indexData
                .subarray(v, v + 6)
                .set([i + 1, i + 0, i + 2, i + 2, i + 3, i + 1]);
        }

        this._mesh = new Mesh(this.engine, {
            vertexCount: vertexCount,
            indexData: this._indexData,
            indexType: MeshIndexType.UnsignedInt,
        });
        this._meshComp.mesh = this._mesh;
    }

    updateVertices() {
        if (!this._mesh) return;

        const positions = this._mesh.attribute(MeshAttribute.Position)!;
        const texCoords = this._mesh.attribute(MeshAttribute.TextureCoordinate);
        const normals = this._mesh.attribute(MeshAttribute.Normal);

        vec3.set(direction, 0, 0, 0);
        for (let i = 0; i < this._points.length; ++i) {
            const curr =
                this._points[(this._currentPointIndex + i + 1) % this._points.length];
            const next =
                this._points[(this._currentPointIndex + i + 2) % this._points.length];

            /* The last point has no next, so re-use the direction of the previous segment */
            if (i !== this._points.length - 1) {
                vec3.sub(direction, next, curr);
            }
            vec3.cross(offset, UP, direction);
            vec3.normalize(offset, offset);
            const timeFraction = 1.0 - this._timeTillNext / this.interval;
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
        this._mesh.update();
    }

    resetTrail() {
        this.object.getPositionWorld(this._points[0]);
        for (let i = 1; i < this._points.length; ++i) {
            vec3.copy(this._points[i], this._points[0]);
        }
        this._currentPointIndex = 0;

        this._timeTillNext = this.interval;
    }

    update(dt: number) {
        this._timeTillNext -= dt;
        if (dt > this.resetThreshold) {
            this.resetTrail();
        }

        if (this._timeTillNext < 0) {
            this._currentPointIndex = (this._currentPointIndex + 1) % this._points.length;
            this._timeTillNext = (this._timeTillNext % this.interval) + this.interval;
        }
        this.object.getPositionWorld(this._points[this._currentPointIndex]);

        this.updateVertices();
    }

    onActivate() {
        this.resetTrail();
        if (this._meshComp) this._meshComp.active = true;
    }

    onDeactivate() {
        if (this._meshComp) this._meshComp.active = false;
    }

    onDestroy() {
        if (this._trailContainer) this._trailContainer.destroy();
        if (this._mesh) this._mesh.destroy();
    }
}
