import {Component, Emitter, Object3D} from '@wonderlandengine/api';
import {property} from '@wonderlandengine/api/decorators.js';
import {setXRRigidTransformLocal} from './utils/webxr.js';

var tempVec3 = new Float32Array(3);
var tempQuat = new Float32Array(4);

interface XRHitTestResult {
    createAnchor?: () => Promise<XRAnchor>;
}

interface XRSession {
    restorePersistentAnchor?: (uuid: string) => Promise<XRAnchor>;
}

interface XRAnchor {
    anchorSpace: XRSpace;
    requestPersistentHandle?: () => Promise<string>;
}

/**
 * Sets the location of the object to the location of an XRAnchor
 *
 * Create anchors using the `Anchor.create()` static function.
 *
 * Example for use with cursor:
 * ```js
 * cursorTarget.onClick.add((object, cursor, originalEvent) => {
 *     /* Only events in XR will have a frame attached *\/
 *     if(!originalEvent.frame) return;
 *     Anchor.create(anchorObject, {uuid: id, persist: true}, originalEvent.frame);
 * });
 * ```
 */
export class Anchor extends Component {
    static TypeName = 'anchor';
    /* Static management of all anchors */
    static #anchors: Anchor[] = [];

    @property.bool(false)
    persist: boolean = false;
    /** Unique identifier to load a persistent anchor from, or empty/null if unknown */
    @property.string()
    uuid: string | null = null;

    /** The xrAnchor, if created */
    xrAnchor: XRAnchor | null = null;

    /** Emits events when the anchor is created either by being restored or newly created */
    onCreate = new Emitter<[Anchor]>();

    /** Whether the anchor is currently being tracked */
    visible: boolean = false;

    /** Emits an event when this anchor starts tracking */
    onTrackingFound = new Emitter<[Anchor]>();
    /** Emits an event when this anchor stops tracking */
    onTrackingLost = new Emitter<[Anchor]>();

    /** XRFrame to use for creating the anchor */
    xrFrame: XRFrame | null = null;

    /** XRHitTestResult to use for creating the anchor */
    xrHitResult: XRHitTestResult | null = null;

    /** Retrieve all anchors of the current scene */
    static getAllAnchors() {
        return Anchor.#anchors;
    }

    static #addAnchor(anchor: Anchor) {
        Anchor.#anchors.push(anchor);
    }

    static #removeAnchor(anchor: Anchor) {
        const index = Anchor.#anchors.indexOf(anchor);
        if (index < 0) return;
        Anchor.#anchors.splice(index, 1);
    }

    /**
     * Create a new anchor
     *
     * @param o Object to attach the component to
     * @param params Parameters for the anchor component
     * @param frame XRFrame to use for anchor cration, if null, will use the current frame if available
     * @param hitResult Optional hit-test result to create the anchor with
     * @returns Promise for the newly created anchor component
     */
    static create(o: Object3D, params: any, frame?: XRFrame, hitResult?: XRHitTestResult) {
        const a = o.addComponent(Anchor, {...params, active: false});
        if (a === null) return null;
        a.xrHitResult = hitResult ?? null;
        a.xrFrame = frame ?? null;
        a.onCreate.once(() => ((a.xrFrame = null), (a.xrHitResult = null)));
        a.active = true;
        return a.onCreate.promise();
    }

    #getFrame() {
        return this.xrFrame || this.engine.xr!.frame;
    }

    async #createAnchor() {
        if (!this.#getFrame().createAnchor) {
            throw new Error(
                "Cannot create anchor - anchors not supported, did you enable the 'anchors' WebXR feature?"
            );
        }
        if (this.xrHitResult) {
            if (this.xrHitResult.createAnchor === undefined) {
                throw new Error(
                    'Requested anchor on XRHitTestResult, but WebXR hit-test feature is not available.'
                );
            }
            return this.xrHitResult.createAnchor!();
        } else {
            this.object.getTranslationWorld(tempVec3);
            tempQuat.set(this.object.rotationWorld);
            const rotation = tempQuat;
            const anchorPose = new XRRigidTransform(
                {x: tempVec3[0], y: tempVec3[1], z: tempVec3[2]},
                {x: rotation[0], y: rotation[1], z: rotation[2], w: rotation[3]}
            );
            return this.#getFrame()?.createAnchor!(
                anchorPose,
                this.engine.xr!.currentReferenceSpace
            );
        }
    }

    #onAddAnchor(anchor: XRAnchor | undefined) {
        if (!anchor) return;

        if (this.persist) {
            if ((anchor as XRAnchor).requestPersistentHandle !== undefined) {
                (anchor as XRAnchor).requestPersistentHandle!().then((uuid: string) => {
                    this.uuid = uuid;
                    this.#onCreate(anchor);
                    Anchor.#addAnchor(this);
                });
                return;
            } else {
                console.warn(
                    'anchor: Persistent anchors are not supported by your client. Ignoring persist property.'
                );
            }
        }
        this.#onCreate(anchor);
    }

    #onRestoreAnchor(anchor: XRAnchor) {
        this.#onCreate(anchor);
    }

    #onCreate(anchor: XRAnchor) {
        this.xrAnchor = anchor;
        this.onCreate.notify(this);
    }

    start() {
        if (this.uuid && this.engine.xr) {
            this.persist = true;
            if (
                (this.engine.xr.session as XRSession).restorePersistentAnchor === undefined
            ) {
                console.warn(
                    'anchor: Persistent anchors are not supported by your client. Ignoring persist property.'
                );
            }
            (this.engine.xr.session as XRSession).restorePersistentAnchor!(this.uuid).then(
                this.#onRestoreAnchor.bind(this)
            );
        } else if (this.#getFrame()) {
            this.#createAnchor().then(this.#onAddAnchor.bind(this));
        } else {
            throw new Error(
                'Anchors can only be created during the XR frame in an active XR session'
            );
        }
    }

    update() {
        if (!this.xrAnchor || !this.engine.xr) return;

        /* We need to use the actual frame from the draw callback here */
        const pose = this.engine.xr.frame.getPose(
            (this.xrAnchor as XRAnchor).anchorSpace,
            this.engine.xr!.currentReferenceSpace
        );
        const visible = !!pose;
        if (visible != this.visible) {
            this.visible = visible;
            (visible ? this.onTrackingFound : this.onTrackingLost).notify(this);
        }
        if (pose) {
            setXRRigidTransformLocal(this.object, pose.transform);
        }
    }

    onDestroy() {
        Anchor.#removeAnchor(this);
    }
}
