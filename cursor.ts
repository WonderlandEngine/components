import {
    Component,
    Object3D,
    InputComponent,
    ViewComponent,
    Emitter,
    WonderlandEngine,
    RayHit,
} from '@wonderlandengine/api';
import {property} from '@wonderlandengine/api/decorators.js';
import {vec3, mat4} from 'gl-matrix';
import {CursorTarget} from './cursor-target.js';

const tempVec = new Float32Array(3);

/** Global target for {@link Cursor} */
class CursorTargetEmitters<T> {
    /** Emitter for events when the target is hovered */
    onHover = new Emitter<[T, Cursor]>();
    /** Emitter for events when the target is unhovered */
    onUnhover = new Emitter<[T, Cursor]>();
    /** Emitter for events when the target is clicked */
    onClick = new Emitter<[T, Cursor]>();
    /** Emitter for events when the cursor moves on the target */
    onMove = new Emitter<[T, Cursor]>();
    /** Emitter for events when the user pressed the select button on the target */
    onDown = new Emitter<[T, Cursor]>();
    /** Emitter for events when the user unpressed the select button on the target */
    onUp = new Emitter<[T, Cursor]>();
}

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

    private collisionMask = 0;
    private maxDistance = 100;
    private onDeactivateCallbacks: (() => void)[] = [];
    private input: InputComponent | null = null;
    private origin = new Float32Array(3);
    private cursorObjScale = new Float32Array(3);
    private direction = new Float32Array(3);
    private projectionMatrix = new Float32Array(16);
    private viewComponent: ViewComponent | null = null;
    private visible = true;
    private isDown = false;
    private lastIsDown = false;
    private arTouchDown = false;

    private lastCursorPosOnTarget = new Float32Array(3);
    private hoveringObject: Object3D | null = null;
    private hoveringObjectTarget: CursorTarget | null = null;
    private cursorRayScale = new Float32Array(3);

    /**
     * Global target lets you receive global cursor events on any object.
     */
    globalTarget = new CursorTargetEmitters<Object3D>();

    /** World position of the cursor */
    cursorPos = new Float32Array(3);

    /** Collision group for the ray cast. Only objects in this group will be affected by this cursor. */
    @property.int(1)
    collisionGroup = 1;

    /** (optional) Object that visualizes the cursor's ray. */
    @property.object()
    cursorRayObject: Object3D | null = null;

    /** Axis along which to scale the `cursorRayObject`. */
    @property.enum(['x', 'y', 'z', 'none'], 'z')
    cursorRayScalingAxis: number = 2;

    /** (optional) Object that visualizes the cursor's hit location. */
    @property.object()
    cursorObject: Object3D | null = null;

    /** Handedness for VR cursors to accept trigger events only from respective controller. */
    @property.enum(['input component', 'left', 'right', 'none'], 'input component')
    handedness: number | string = 0;

    /** Mode for raycasting, whether to use PhysX or simple collision components */
    @property.enum(['collision', 'physx'], 'collision')
    rayCastMode: number | string = 0;

    /** Whether to set the CSS style of the mouse cursor on desktop */
    @property.bool(true)
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

        this.viewComponent = this.object.getComponent(ViewComponent);
    }

    onActivate() {
        this._setCursorVisibility(true);

        /* If this object also has a view component, we will enable inverse-projected mouse clicks,
         * otherwise just use the objects transformation */
        if (this.viewComponent != null) {
            const canvas = this.engine.canvas!;

            const onClick = this.onClick.bind(this);
            const onPointerMove = this.onPointerMove.bind(this);
            const onPointerDown = this.onPointerDown.bind(this);
            const onPointerUp = this.onPointerUp.bind(this);

            canvas.addEventListener('click', onClick);
            canvas.addEventListener('pointermove', onPointerMove);
            canvas.addEventListener('pointerdown', onPointerDown);
            canvas.addEventListener('pointerup', onPointerUp);

            mat4.invert(this.projectionMatrix, this.viewComponent.projectionMatrix);
            const onViewportResize = this.onViewportResize.bind(this);
            // FIXME: We might need to use ResizeObserver here?
            window.addEventListener('resize', onViewportResize);

            this.onDeactivateCallbacks.push(() => {
                canvas.removeEventListener('click', onClick);
                canvas.removeEventListener('pointermove', onPointerMove);
                canvas.removeEventListener('pointerdown', onPointerDown);
                canvas.removeEventListener('pointerup', onPointerUp);
                window.removeEventListener('resize', onViewportResize);
            });
        }

        const onXRSessionStart = this.setupVREvents.bind(this);
        this.engine.onXRSessionStart.add(onXRSessionStart);
        this.onDeactivateCallbacks.push(() => {
            this.engine.onXRSessionStart.remove(onXRSessionStart);
        });
        if (this.engine.xr) {
            this.setupVREvents(this.engine.xr.session);
        }

        /* Set initial origin and direction */
        this.object.getTranslationWorld(this.origin);
        this.object.getForward(this.direction);

        if (this.cursorRayObject) {
            this.cursorRayScale.set(this.cursorRayObject.scalingLocal);

            /* Set ray to a good default distance of the cursor of 1m */
            this._setCursorRayTransform(vec3.add(tempVec, this.origin, this.direction));
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
        /* If in VR, set the cursor ray based on object transform */
        /* Since Google Cardboard tap is registered as arTouchDown without a gamepad, we need to check for gamepad presence */
        if (
            this.engine.xr &&
            this.arTouchDown &&
            this.input &&
            this.engine.xr.session.inputSources[0].handedness === 'none' &&
            this.engine.xr.session.inputSources[0].gamepad
        ) {
            const p = this.engine.xr.session.inputSources[0].gamepad.axes;
            /* Screenspace Y is inverted */
            this.direction[0] = p[0];
            this.direction[1] = -p[1];
            this.direction[2] = -1.0;
            this.updateDirection();
        } else {
            this.object.getTranslationWorld(this.origin);
            this.object.getForwardWorld(this.direction);
        }

        this.rayCast(false);

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

    /* Returns the hovered cursor target, if available */
    private notify(
        event: 'onHover' | 'onUnhover' | 'onClick' | 'onUp' | 'onDown' | 'onMove'
    ) {
        const target = this.hoveringObject;
        if (target) {
            const cursorTarget = this.hoveringObjectTarget;
            if (cursorTarget) cursorTarget[event].notify(target, this);
            this.globalTarget![event].notify(target, this);
        }
    }

    private hoverBehaviour(rayHit: RayHit, doClick: boolean) {
        /* Old API version does not return null for objects[0] if no hit */
        const hit = rayHit.hitCount > 0 ? rayHit.objects[0] : null;
        if (hit) {
            if (!this.hoveringObject || !this.hoveringObject.equals(hit)) {
                /* Unhover previous, if exists */
                if (this.hoveringObject) {
                    this.notify('onUnhover');
                }

                /* Hover new object */
                this.hoveringObject = hit;
                this.hoveringObjectTarget = this.hoveringObject.getComponent(CursorTarget);

                if (this.styleCursor) this.engine.canvas!.style.cursor = 'pointer';
                this.notify('onHover');
            }
        } else if (this.hoveringObject) {
            /* Previously hovering object, now hovering nothing */
            this.notify('onUnhover');
            this.hoveringObject = null;
            this.hoveringObjectTarget = null;
            if (this.styleCursor) this.engine.canvas!.style.cursor = 'default';
        }

        if (this.hoveringObject) {
            /* onDown/onUp */
            if (this.isDown !== this.lastIsDown) {
                this.notify(this.isDown ? 'onDown' : 'onUp');
            }

            /* onClick */
            if (doClick) this.notify('onClick');
        }

        /* onMove */
        if (hit) {
            if (this.hoveringObject) {
                this.hoveringObject.toLocalSpaceTransform(tempVec, this.cursorPos);
            } else {
                tempVec.set(this.cursorPos);
            }

            if (
                this.lastCursorPosOnTarget[0] != tempVec[0] ||
                this.lastCursorPosOnTarget[1] != tempVec[1] ||
                this.lastCursorPosOnTarget[2] != tempVec[2]
            ) {
                this.notify('onMove');
                this.lastCursorPosOnTarget.set(tempVec);
            }
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

        this.onDeactivateCallbacks.push(() => {
            if (!this.engine.xrSession) return;
            s.removeEventListener('select', onSelect);
            s.removeEventListener('selectstart', onSelectStart);
            s.removeEventListener('selectend', onSelectEnd);
        });

        /* After AR session was entered, the projection matrix changed */
        this.onViewportResize();
    }

    onDeactivate() {
        this._setCursorVisibility(false);
        if (this.hoveringObject) this.notify('onUnhover');
        if (this.cursorRayObject) this.cursorRayObject.scale([0, 0, 0]);

        /* Ensure all event listeners are removed */
        for (const f of this.onDeactivateCallbacks) f();
        this.onDeactivateCallbacks.length = 0;
    }
    /** 'select' event listener */
    onSelect(e: XRInputSourceEvent) {
        if (e.inputSource.handedness != this.handedness) return;
        this.rayCast(true);
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
        this.updateMousePos(e);

        this.rayCast();
    }

    /** 'click' event listener */
    onClick(e: MouseEvent) {
        this.updateMousePos(e);
        this.rayCast(true);
    }

    /** 'pointerdown' event listener */
    onPointerDown(e: PointerEvent) {
        /* Don't care about secondary pointers or non-left clicks */
        if (!e.isPrimary || e.button !== 0) return;
        this.updateMousePos(e);
        this.isDown = true;

        this.rayCast();
    }

    /** 'pointerup' event listener */
    onPointerUp(e: PointerEvent) {
        /* Don't care about secondary pointers or non-left clicks */
        if (!e.isPrimary || e.button !== 0) return;
        this.updateMousePos(e);
        this.isDown = false;

        this.rayCast();
    }

    /**
     * Update mouse position in non-VR mode and raycast for new position
     * @returns @ref WL.RayHit for new position.
     */
    private updateMousePos(e: PointerEvent | MouseEvent) {
        const bounds = this.engine.canvas!.getBoundingClientRect();
        /* Get direction in normalized device coordinate space from mouse position */
        const left = e.clientX / bounds.width;
        const top = e.clientY / bounds.height;
        this.direction[0] = left * 2 - 1;
        this.direction[1] = -top * 2 + 1;
        this.direction[2] = -1.0;
        this.updateDirection();
    }

    private updateDirection() {
        this.object.getTranslationWorld(this.origin);

        /* Reverse-project the direction into view space */
        vec3.transformMat4(this.direction, this.direction, this.projectionMatrix);
        vec3.normalize(this.direction, this.direction);
        vec3.transformQuat(this.direction, this.direction, this.object.transformWorld);
    }

    private rayCast(doClick = false) {
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

        return rayHit;
    }
}
