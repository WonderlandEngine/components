import {
    Component,
    Type,
    Object3D,
    InputComponent,
    ViewComponent,
    RayHit,
} from '@wonderlandengine/api';
import {vec3, mat4} from 'gl-matrix';
import {CursorTarget} from './cursor-target.js';

/**
 * 3D cursor for desktop/mobile/VR.
 *
 * Implements a ray-casting cursor into the scene. To react to
 * clicking/hover/unhover/cursor down/cursor up/move use a
 * [cursor-target](#cursor-target).
 *
 * For VR, the ray is cast in direction of
 * [this.object.getForward()](/jsapi/object/#getforward). For desktop and mobile, the
 * forward vector is inverse-projected to account for where on screen the user clicked.
 *
 * `.globalTarget` can be used to call callbacks for all objects, even those that
 * do not have a cursor target attached, but match the collision group.
 *
 * See [Animation Example](/showcase/animation).
 */
export class Cursor extends Component {
    static TypeName = 'cursor';
    static Properties = {
        /** Collision group for the ray cast. Only objects in this group will be affected by this cursor. */
        collisionGroup: {type: Type.Int, default: 1},
        /** (optional) Object that visualizes the cursor's ray. */
        cursorRayObject: {type: Type.Object},
        /** Axis along which to scale the `cursorRayObject`. */
        cursorRayScalingAxis: {
            type: Type.Enum,
            values: ['x', 'y', 'z', 'none'],
            default: 'z',
        },
        /** (optional) Object that visualizes the cursor's hit location. */
        cursorObject: {type: Type.Object},
        /** Handedness for VR cursors to accept trigger events only from respective controller. */
        handedness: {
            type: Type.Enum,
            values: ['input component', 'left', 'right', 'none'],
            default: 'input component',
        },
        /** Mode for raycasting, whether to use PhysX or simple collision components */
        rayCastMode: {
            type: Type.Enum,
            values: ['collision', 'physx'],
            default: 'collision',
        },
        /** Whether to set the CSS style of the mouse cursor on desktop */
        styleCursor: {type: Type.Bool, default: true},
    };

    private collisionMask = 0;
    private maxDistance = 100;
    private onDestroyCallbacks: (() => void)[] = [];
    private input: InputComponent | null = null;
    private origin = new Float32Array(3);
    private cursorObjScale = new Float32Array(3);
    private direction = new Float32Array(3);
    private tempVec = new Float32Array(3);
    private projectionMatrix = new Float32Array(16);
    private viewComponent: ViewComponent | null = null;
    private visible = true;
    private isDown = false;
    private lastIsDown = false;
    private arTouchDown = false;

    cursorPos = new Float32Array(3);
    private lastCursorPosOnTarget = new Float32Array(3);
    private hoveringObject: Object3D | null = null;
    private hoveringObjectTarget: CursorTarget | null = null;
    private cursorRayScale = new Float32Array(3);

    globalTarget: CursorTarget | null = null;

    /* TODO: Move to decorators, once available */
    collisionGroup = 1;
    cursorRayObject: Object3D | null = null;
    cursorRayScalingAxis: number = 2;
    cursorObject: Object3D | null = null;
    handedness: number | string = 0;
    rayCastMode: number | string = 0;
    styleCursor: boolean = true;

    start() {
        this.collisionMask = 1 << this.collisionGroup;

        if (this.handedness == 0) {
            const inputComp = this.object.getComponent('input');
            if (!inputComp) {
                console.warn(
                    'cursor component on object',
                    this.object.name,
                    'was configured with handedness "input component", ' +
                        'but object has no input component.'
                );
            } else {
                this.handedness = inputComp.handedness || 'none';
                this.input = inputComp;
            }
        } else {
            this.handedness = ['left', 'right', 'none'][(this.handedness as number) - 1];
        }

        this.globalTarget = this.object.addComponent(CursorTarget);
        this.viewComponent = this.object.getComponent('view');
        /* If this object also has a view component, we will enable inverse-projected mouse clicks,
         * otherwise just use the objects transformation */
        if (this.viewComponent != null) {
            const onClick = this.onClick.bind(this);
            this.engine.canvas!.addEventListener('click', onClick);
            const onPointerMove = this.onPointerMove.bind(this);
            this.engine.canvas!.addEventListener('pointermove', onPointerMove);
            const onPointerDown = this.onPointerDown.bind(this);
            this.engine.canvas!.addEventListener('pointerdown', onPointerDown);
            const onPointerUp = this.onPointerUp.bind(this);
            this.engine.canvas!.addEventListener('pointerup', onPointerUp);

            mat4.invert(this.projectionMatrix, this.viewComponent.projectionMatrix);
            const onViewportResize = this.onViewportResize.bind(this);
            window.addEventListener('resize', onViewportResize);

            this.onDestroyCallbacks.push(() => {
                this.engine.canvas!.removeEventListener('click', onClick);
                this.engine.canvas!.removeEventListener('pointermove', onPointerMove);
                this.engine.canvas!.removeEventListener('pointerdown', onPointerDown);
                this.engine.canvas!.removeEventListener('pointerup', onPointerUp);
                window.removeEventListener('resize', onViewportResize);
            });
        }

        const onXRSessionStart = this.setupVREvents.bind(this);
        this.engine.onXRSessionStart.add(onXRSessionStart);
        this.onDestroyCallbacks.push(() => {
            this.engine.onXRSessionStart.remove(onXRSessionStart);
        });

        if (this.cursorRayObject) {
            this.cursorRayScale.set(this.cursorRayObject.scalingLocal);

            /* Set ray to a good default distance of the cursor of 1m */
            this.object.getTranslationWorld(this.origin);
            this.object.getForward(this.direction);
            this._setCursorRayTransform(
                vec3.add(this.tempVec, this.origin, this.direction)
            );
        }
    }

    onViewportResize() {
        if (!this.viewComponent) return;
        /* Projection matrix will change if the viewport is resized, which will affect the
         * projection matrix because of the aspect ratio. */
        mat4.invert(this.projectionMatrix, this.viewComponent.projectionMatrix);
    }

    _setCursorRayTransform(hitPosition: vec3) {
        if (!this.cursorRayObject) return;
        const dist = vec3.dist(this.origin, hitPosition);
        this.cursorRayObject.setTranslationLocal([0.0, 0.0, -dist / 2]);
        if (this.cursorRayScalingAxis != 4) {
            this.cursorRayObject.resetScaling();
            this.cursorRayScale[this.cursorRayScalingAxis] = dist / 2;
            this.cursorRayObject.scale(this.cursorRayScale);
        }
    }

    _setCursorVisibility(visible: boolean) {
        if (this.visible == visible) return;
        this.visible = visible;
        if (!this.cursorObject) return;

        if (visible) {
            this.cursorObject.resetScaling();
            this.cursorObject.scale(this.cursorObjScale);
        } else {
            this.cursorObjScale.set(this.cursorObject.scalingLocal);
            this.cursorObject.scale([0, 0, 0]);
        }
    }

    update() {
        this.doUpdate(false);
    }

    doUpdate(doClick: boolean) {
        /* If in VR, set the cursor ray based on object transform */
        if (this.engine.xrSession) {
            /* Since Google Cardboard tap is registered as arTouchDown without a gamepad, we need to check for gamepad presence */
            if (
                this.arTouchDown &&
                this.input &&
                this.engine.xrSession.inputSources[0].handedness === 'none' &&
                this.engine.xrSession.inputSources[0].gamepad
            ) {
                const p = this.engine.xrSession.inputSources[0].gamepad.axes;
                /* Screenspace Y is inverted */
                this.direction[0] = p[0];
                this.direction[1] = -p[1];
                this.direction[2] = -1.0;
                this.updateDirection();
            } else {
                this.object.getTranslationWorld(this.origin);
                this.object.getForward(this.direction);
            }
        }

        const rayHit =
            this.rayCastMode == 0
                ? this.engine.scene.rayCast(this.origin, this.direction, this.collisionMask)
                : this.engine.physics!.rayCast(
                      this.origin,
                      this.direction,
                      this.collisionMask,
                      this.maxDistance
                  );

        if (rayHit.hitCount > 0) {
            this.cursorPos.set(rayHit.locations[0]);
        } else {
            this.cursorPos.fill(0);
        }

        this.hoverBehaviour(rayHit, doClick);

        if (this.cursorObject) {
            if (
                this.hoveringObject &&
                (this.cursorPos[0] != 0 || this.cursorPos[1] != 0 || this.cursorPos[2] != 0)
            ) {
                this._setCursorVisibility(true);
                this.cursorObject.setTranslationWorld(this.cursorPos);
                this._setCursorRayTransform(this.cursorPos);
            } else {
                this._setCursorVisibility(false);
            }
        }
    }

    hoverBehaviour(rayHit: RayHit, doClick: boolean) {
        if (rayHit.hitCount > 0) {
            if (!this.hoveringObject || !this.hoveringObject.equals(rayHit.objects[0])) {
                /* Unhover previous, if exists */
                if (this.hoveringObject) {
                    const cursorTarget = this.hoveringObject.getComponent(CursorTarget);
                    if (cursorTarget)
                        cursorTarget.onUnhover.notify(this.hoveringObject, this);
                    this.globalTarget!.onUnhover.notify(this.hoveringObject, this);
                }

                /* Hover new object */
                this.hoveringObject = rayHit.objects[0] as Object3D;
                if (this.styleCursor) this.engine.canvas!.style.cursor = 'pointer';

                let cursorTarget = this.hoveringObject.getComponent(CursorTarget);
                if (cursorTarget) {
                    this.hoveringObjectTarget = cursorTarget;
                    cursorTarget.onHover.notify(this.hoveringObject, this);
                }
                this.globalTarget!.onHover.notify(this.hoveringObject, this);
            }

            if (this.hoveringObjectTarget) {
                this.hoveringObject.toLocalSpaceTransform(this.tempVec, this.cursorPos);
                if (
                    this.lastCursorPosOnTarget[0] != this.tempVec[0] ||
                    this.lastCursorPosOnTarget[1] != this.tempVec[1] ||
                    this.lastCursorPosOnTarget[2] != this.tempVec[2]
                ) {
                    this.hoveringObjectTarget.onMove.notify(this.hoveringObject, this);
                    this.lastCursorPosOnTarget.set(this.tempVec);
                }
            }

            /* Cursor up/down */
            const cursorTarget = this.hoveringObject.getComponent(CursorTarget);
            if (this.isDown !== this.lastIsDown) {
                if (this.isDown) {
                    /* Down */
                    if (cursorTarget) cursorTarget.onDown.notify(this.hoveringObject, this);
                    this.globalTarget!.onDown.notify(this.hoveringObject, this);
                } else {
                    /* Up */
                    if (cursorTarget) cursorTarget.onUp.notify(this.hoveringObject, this);
                    this.globalTarget!.onUp.notify(this.hoveringObject, this);
                }
            }

            /* Click */
            if (doClick) {
                if (cursorTarget) cursorTarget.onClick.notify(this.hoveringObject, this);
                this.globalTarget!.onClick.notify(this.hoveringObject, this);
            }
        } else if (this.hoveringObject && rayHit.hitCount == 0) {
            const cursorTarget = this.hoveringObject.getComponent(CursorTarget);
            if (cursorTarget) cursorTarget.onUnhover.notify(this.hoveringObject, this);
            this.globalTarget!.onUnhover.notify(this.hoveringObject, this);
            this.hoveringObject = null;
            this.hoveringObjectTarget = null;
            if (this.styleCursor) this.engine.canvas!.style.cursor = 'default';
        }

        this.lastIsDown = this.isDown;
    }

    /**
     * Setup event listeners on session object
     * @param s WebXR session
     *
     * Sets up 'select' and 'end' events and caches the session to avoid
     * Module object access.
     */
    setupVREvents(s: XRSession) {
        /* If in VR, one-time bind the listener */
        const onSelect = this.onSelect.bind(this);
        s.addEventListener('select', onSelect);
        const onSelectStart = this.onSelectStart.bind(this);
        s.addEventListener('selectstart', onSelectStart);
        const onSelectEnd = this.onSelectEnd.bind(this);
        s.addEventListener('selectend', onSelectEnd);

        this.onDestroyCallbacks.push(() => {
            if (!this.engine.xrSession) return;
            s.removeEventListener('select', onSelect);
            s.removeEventListener('selectstart', onSelectStart);
            s.removeEventListener('selectend', onSelectEnd);
        });

        /* After AR session was entered, the projection matrix changed */
        this.onViewportResize();
    }

    /** 'select' event listener */
    onSelect(e: XRInputSourceEvent) {
        if (e.inputSource.handedness != this.handedness) return;
        this.doUpdate(true);
    }

    /** 'selectstart' event listener */
    onSelectStart(e: XRInputSourceEvent) {
        this.arTouchDown = true;
        if (e.inputSource.handedness == this.handedness) this.isDown = true;
    }

    /** 'selectend' event listener */
    onSelectEnd(e: XRInputSourceEvent) {
        this.arTouchDown = false;
        if (e.inputSource.handedness == this.handedness) this.isDown = false;
    }

    /** 'pointermove' event listener */
    onPointerMove(e: PointerEvent) {
        /* Don't care about secondary pointers */
        if (!e.isPrimary) return;
        const bounds = this.engine.canvas!.getBoundingClientRect();
        const rayHit = this.updateMousePos(
            e.clientX,
            e.clientY,
            bounds.width,
            bounds.height
        );

        this.hoverBehaviour(rayHit, false);
    }

    /** 'click' event listener */
    onClick(e: MouseEvent) {
        const bounds = this.engine.canvas!.getBoundingClientRect();
        const rayHit = this.updateMousePos(
            e.clientX,
            e.clientY,
            bounds.width,
            bounds.height
        );
        this.hoverBehaviour(rayHit, true);
    }

    /** 'pointerdown' event listener */
    onPointerDown(e: PointerEvent) {
        /* Don't care about secondary pointers or non-left clicks */
        if (!e.isPrimary || e.button !== 0) return;
        const bounds = this.engine.canvas!.getBoundingClientRect();
        const rayHit = this.updateMousePos(
            e.clientX,
            e.clientY,
            bounds.width,
            bounds.height
        );
        this.isDown = true;

        this.hoverBehaviour(rayHit, false);
    }

    /** 'pointerup' event listener */
    onPointerUp(e: PointerEvent) {
        /* Don't care about secondary pointers or non-left clicks */
        if (!e.isPrimary || e.button !== 0) return;
        const bounds = this.engine.canvas!.getBoundingClientRect();
        const rayHit = this.updateMousePos(
            e.clientX,
            e.clientY,
            bounds.width,
            bounds.height
        );
        this.isDown = false;

        this.hoverBehaviour(rayHit, false);
    }

    /**
     * Update mouse position in non-VR mode and raycast for new position
     * @returns @ref WL.RayHit for new position.
     */
    updateMousePos(clientX: number, clientY: number, w: number, h: number) {
        /* Get direction in normalized device coordinate space from mouse position */
        const left = clientX / w;
        const top = clientY / h;
        this.direction[0] = left * 2 - 1;
        this.direction[1] = -top * 2 + 1;
        this.direction[2] = -1.0;
        return this.updateDirection();
    }

    updateDirection() {
        this.object.getTranslationWorld(this.origin);

        /* Reverse-project the direction into view space */
        vec3.transformMat4(this.direction, this.direction, this.projectionMatrix);
        vec3.normalize(this.direction, this.direction);
        vec3.transformQuat(this.direction, this.direction, this.object.transformWorld);
        const rayHit =
            this.rayCastMode == 0
                ? this.engine.scene.rayCast(this.origin, this.direction, this.collisionMask)
                : this.engine.physics!.rayCast(
                      this.origin,
                      this.direction,
                      this.collisionMask,
                      this.maxDistance
                  );

        if (rayHit.hitCount > 0) {
            this.cursorPos.set(rayHit.locations[0]);
        } else {
            this.cursorPos.fill(0);
        }

        return rayHit;
    }

    onDeactivate() {
        this._setCursorVisibility(false);
        if (this.hoveringObject) {
            const target = this.hoveringObject.getComponent(CursorTarget);
            if (target) target.onUnhover.notify(this.hoveringObject, this);
            this.globalTarget!.onUnhover.notify(this.hoveringObject, this);
        }
        if (this.cursorRayObject) this.cursorRayObject.scale([0, 0, 0]);
    }

    onActivate() {
        this._setCursorVisibility(true);
    }

    onDestroy() {
        for (const f of this.onDestroyCallbacks) f();
    }
}
