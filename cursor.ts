import {
    Component,
    Type,
    Object3D,
    InputComponent,
    ViewComponent,
    RayHit,
    ListenerCallback,
} from '@wonderlandengine/api';
import {property} from '@wonderlandengine/api/decorators.js';
import {vec3, mat4} from 'gl-matrix';
import {CursorTarget} from './cursor-target.js';

const TOUCHPAD_PROFILES = [
    'generic-trigger-squeeze-touchpad-thumbstick',
    'generic-trigger-touchpad-thumbstick',
    'generic-trigger-squeeze-touchpad',
    'generic-trigger-touchpad',
    'generic-touchpad',
    'generic-touchscreen',
];

const THUMBSTICK_PROFILES = [
    'generic-trigger-squeeze-touchpad-thumbstick',
    'generic-trigger-touchpad-thumbstick',
    'generic-trigger-squeeze-thumbstick',
    'generic-trigger-thumbstick',
];

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

    private lastCursorPosOnTarget = new Float32Array(3);
    private hoveringObject: Object3D | null = null;
    private hoveringObjectTarget: CursorTarget | null = null;
    private cursorRayScale = new Float32Array(3);
    private _scrollDeltaX = 0;
    private _scrollDeltaY = 0;
    private _sessionListener!: ListenerCallback<[ XRSession, XRSessionMode ]>;
    private _xrInput: XRInputSource | null = null;
    private _xrLastHandedness: XRHandedness | null = null;

    /**
     * Global target is a dummy component that lets you receive
     * global cursor events.
     */
    globalTarget: CursorTarget = new CursorTarget(this.engine!);

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

    /** Should scroll events be emulated with thumbsticks in VR? */
    @property.bool(false)
    emulateXRScroll!: boolean;

    /** Emulated scroll speed in pixels */
    @property.float(100.0)
    emulatedXRScrollSpeed!: number;

    /** Emulated scroll deadzone, in a range from 0.0 to 1.0 */
    @property.float(0.1)
    emulatedXRScrollDeadzone!: number;

    init() {
        this._sessionListener = this.updateXRSession.bind(this);
        this.engine.onXRSessionStart.add(this._sessionListener);
    }

    destroy() {
        this.updateXRSession(null);
        this.engine.onXRSessionStart.remove(this._sessionListener);
    }

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
            const onWheel = this.onWheel.bind(this);
            this.engine.canvas!.addEventListener('wheel', onWheel);

            mat4.invert(this.projectionMatrix, this.viewComponent.projectionMatrix);
            const onViewportResize = this.onViewportResize.bind(this);
            window.addEventListener('resize', onViewportResize);

            this.onDestroyCallbacks.push(() => {
                this.engine.canvas!.removeEventListener('click', onClick);
                this.engine.canvas!.removeEventListener('pointermove', onPointerMove);
                this.engine.canvas!.removeEventListener('pointerdown', onPointerDown);
                this.engine.canvas!.removeEventListener('pointerup', onPointerUp);
                this.engine.canvas!.removeEventListener('wheel', onWheel);
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

    private updateXRSession(session: XRSession | null) {
        if (session === null) {
            this._xrInput = null;
            return;
        }

        session.addEventListener('inputsourceschange', this.handleXRInputChange.bind(this));

        this._xrLastHandedness = this.handedness as XRHandedness;
        for (const source of session.inputSources) {
            if (source.handedness === this.handedness) {
                this._xrInput = source;
            }
        }
    }

    private handleXRInputChange(e: XRInputSourceChangeEvent) {
        let needsRecheck = false;
        if (this._xrInput !== null) {
            if (this._xrLastHandedness !== this.handedness) {
                this._xrInput = null;
                needsRecheck = true;
            } else {
                for (const removed of e.removed) {
                    if (this._xrInput === removed) {
                        this._xrInput = null;
                        needsRecheck = true;
                        break;
                    }
                }
            }
        }

        this._xrLastHandedness = this.handedness as XRHandedness;

        if (this._xrInput === null) {
            for (const added of e.added) {
                if (added.handedness === this.handedness) {
                    this._xrInput = added;
                    needsRecheck = false;
                    return;
                }
            }
        }

        if (!(needsRecheck && this.engine.xr)) {
            return;
        }

        for (const source of this.engine.xr.session.inputSources) {
            if (source.handedness === this.handedness) {
                this._xrInput = source;
                return;
            }
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

    private emulateScrollAxis(axisIn: number): number {
        if (Math.abs(axisIn) >= this.emulatedXRScrollDeadzone) {
            return axisIn;
        } else {
            return 0;
        }
    }

    private emulateScroll(dt: number, source: XRInputSource): boolean {
        const gamepad = source.gamepad;
        if (!gamepad) {
            return false;
        }

        const axes = gamepad.axes;
        let dx = 0, dy = 0, fallback = true;

        // prefer left stick or touchpad, but fall back to primary/right stick.
        // if it's not known which thumbsticks/touchpads are supported, then
        // allow input from any axes
        if (gamepad.mapping === 'xr-standard') {
            // standard xr controller, try to match a generic profile
            let touchpadProfile = false, thumbstickProfile = false;
            for (const profile of source.profiles) {
                if (TOUCHPAD_PROFILES.indexOf(profile) !== -1) {
                    // prefer touchpad
                    dx = this.emulateScrollAxis(axes[0]);
                    dy = this.emulateScrollAxis(axes[1]);
                    fallback = false;
                    touchpadProfile = true;
                    break;
                } else if (THUMBSTICK_PROFILES.indexOf(profile) !== -1) {
                    // has thumbstick; will be ignored if touchpad profile is
                    // also found
                    thumbstickProfile = true;
                }
            }

            // has no touchpad profile but has a thumbstick profile. prefer
            // thumbstick
            if (thumbstickProfile && !touchpadProfile) {
                dx = this.emulateScrollAxis(axes[2]);
                dy = this.emulateScrollAxis(axes[3]);
                fallback = false;
            }
        }

        // non-standard or unsupported xr standard controller, fall back to any
        // axes
        if (fallback) {
            dx = this.emulateScrollAxis(axes[0]) + this.emulateScrollAxis(axes[2]);
            dy = this.emulateScrollAxis(axes[1]) + this.emulateScrollAxis(axes[3]);
        }

        // apply speed and delta time multiplier
        const effectiveSpeed = this.emulatedXRScrollSpeed * dt;
        dx *= effectiveSpeed;
        dy *= effectiveSpeed;

        if (dx !== 0 || dy !== 0) {
            this._scrollDeltaX = dx;
            this._scrollDeltaY = dy;
            return true;
        } else {
            return false;
        }
    }

    update(dt: number) {
        if (this._xrLastHandedness !== this.handedness) {
            this._xrInput = null;
            this._xrLastHandedness = this.handedness as XRHandedness;

            if (this.engine.xr) {
                for (const source of this.engine.xr.session.inputSources) {
                    if (source.handedness === this.handedness) {
                        this._xrInput = source;
                    }
                }
            }
        }

        let doScroll = false;
        if (this.emulateXRScroll && this.engine.xr) {
            if (this.input) {
                if (this.input.xrInputSource) {
                    doScroll = this.emulateScroll(dt, this.input.xrInputSource);
                }
            } else if (this._xrInput) {
                doScroll = this.emulateScroll(dt, this._xrInput);
            }
        }

        this.doUpdate(false, doScroll);
    }

    doUpdate(doClick: boolean, doScroll: boolean) {
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

        this.hoverBehaviour(rayHit, doClick, doScroll);

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

    hoverBehaviour(rayHit: RayHit, doClick: boolean, doScroll: boolean) {
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

            /* Scroll */
            if (doScroll) {
                if (cursorTarget) cursorTarget.onScroll.notify(this.hoveringObject, this);
                this.globalTarget!.onScroll.notify(this.hoveringObject, this);
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
        this.doUpdate(true, false);
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

        this.hoverBehaviour(rayHit, false, false);
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
        this.hoverBehaviour(rayHit, true, false);
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

        this.hoverBehaviour(rayHit, false, false);
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

        this.hoverBehaviour(rayHit, false, false);
    }

    /** 'wheel' event listener */
    onWheel(e: WheelEvent) {
        const bounds = this.engine.canvas!.getBoundingClientRect();
        const rayHit = this.updateMousePos(e.clientX, e.clientY, bounds.width, bounds.height);

        let deltaX = e.deltaX;
        let deltaY = e.deltaY;

        // XXX on firefox, if deltaX/deltaY is checked before deltaMode, then
        // the deltaMode SHOULD be in pixels. chromium-based browsers always use
        // pixels
        if (e.deltaMode === 1) {
            // in lines despite checking deltaX/deltaY first. guess that a line
            // is 16px tall
            deltaX *= 16;
            deltaY *= 16;
        } else if (e.deltaMode === 2) {
            // in pages despite checking deltaX/deltaY first. guess that a line
            // is 128px tall
            deltaX *= 128;
            deltaY *= 128;
        }

        this._scrollDeltaX = deltaX;
        this._scrollDeltaY = deltaY;

        this.hoverBehaviour(rayHit, false, true);
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

    /**
     * How much has been scrolled horizontally in pixels since the last frame
     */
    get scrollDeltaX() {
        return this._scrollDeltaX;
    }

    /**
     * How much has been scrolled vertically in pixels since the last frame
     */
    get scrollDeltaY() {
        return this._scrollDeltaY;
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
