import {vec3, mat4} from 'gl-matrix';
/**
 * 3D cursor for desktop/mobile/VR.
 *
 * Implements a ray-casting cursor into the scene. To react to clicking/hover/unhover
 * use a [cursor-target](#cursor-target).
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
WL.registerComponent('cursor', {
    /** Collision group for the ray cast. Only objects in this group will be affected by this cursor. */
    collisionGroup: {type: WL.Type.Int, default: 1},
    /** (optional) Object that visualizes the cursor's ray. */
    cursorRayObject: {type: WL.Type.Object, default: null},
    /** Axis along which to scale the `cursorRayObject`. */
    cursorRayScalingAxis: {type: WL.Type.Enum, values: ['x', 'y', 'z', 'none'], default: 'z'},
    /** (optional) Object that visualizes the cursor's hit location. */
    cursorObject: {type: WL.Type.Object, default: null},
    /** Handedness for VR cursors to accept trigger events only from respective controller. */
    handedness: {type: WL.Type.Enum, values: ['input component', 'left', 'right', 'none'], default: 'input component'},
    /** Mode for raycasting, whether to use PhysX or simple collision components */
    rayCastMode: {type: WL.Type.Enum, values: ['collision', 'physx'], default: 'collision'},
    /** (optional) Should cursor style be changed when hovering? */
    styleCursor: {type: WL.Type.Bool, default: true},
  }, {
    init: function() {
        /* VR session cache, in case in VR */
        this.session = null;
        this.collisionMask = (1 << this.collisionGroup);
        this.maxDistance = 100;
    },
    start: function() {
        if(this.handedness == 0) {
            const inputComp = this.object.getComponent('input');
            if(!inputComp) {
                console.warn('cursor component on object', this.object.name,
                    'was configured with handedness "input component", ' +
                    'but object has no input component.');
            } else {
                this.handedness = inputComp.handedness;
                this.input = inputComp;
            }
        } else {
            this.handedness = ['left', 'right'][this.handedness - 1];
        }

        this.globalTarget = this.object.addComponent('cursor-target');

        this.origin = new Float32Array(3);
        this.cursorObjScale = new Float32Array(3);
        this.direction = [0, 0, 0];
        this.tempQuat = new Float32Array(4);
        this.viewComponent = this.object.getComponent("view");
        /* If this object also has a view component, we will enable inverse-projected mouse clicks,
         * otherwise just use the objects transformation */
        if(this.viewComponent != null) {
            WL.canvas.addEventListener("click", this.onClick.bind(this));
            WL.canvas.addEventListener("mousemove", this.onMouseMove.bind(this));

            this.projectionMatrix = new Float32Array(16);
            mat4.invert(this.projectionMatrix, this.viewComponent.projectionMatrix);
            WL.canvas.addEventListener("resize", this.onViewportResize.bind(this));
        }
        this.isHovering = false;
        this.visible = true;

        this.cursorPos = new Float32Array(3);
        this.hoveringObject = null;

        WL.onXRSessionStart.push(this.setupVREvents.bind(this));

        if(this.cursorRayObject) {
            this.cursorRayScale = new Float32Array(3);
            this.cursorRayScale.set(this.cursorRayObject.scalingLocal);

            /* Set ray to a good default distance of the cursor of 1m */
            this.object.getTranslationWorld(this.origin);
            this.object.getForward(this.direction);
            this._setCursorRayTransform([
                this.origin[0] + this.direction[0],
                this.origin[1] + this.direction[1],
                this.origin[2] + this.direction[2]]);
        }
    },
    onViewportResize: function() {
        if(!this.viewComponent) return;
        /* Projection matrix will change if the viewport is resized, which will affect the
         * projection matrix because of the aspect ratio. */
        mat4.invert(this.projectionMatrix, this.viewComponent.projectionMatrix);
    },
    /** 'click' event listener */
    onClick: function(e) {
        let bounds = e.target.getBoundingClientRect();
        let rayHit = this.updateMousePos(e.clientX, e.clientY, bounds.width, bounds.height);
        if(rayHit.hitCount > 0) {
            let o = rayHit.objects[0];
            this._clickOn(o);
        }
    },
    /** Click on given object, which executes the cursor-target onClick callbacks */
    _clickOn: function(o) {
        let cursorTarget = o.getComponent("cursor-target", 0);
        if(cursorTarget) cursorTarget.onClick(o, this);
        this.globalTarget.onClick(o, this);
    },

    _setCursorRayTransform: function(hitPosition) {
        if(!this.cursorRayObject) return;
        let dist = vec3.dist(this.origin, hitPosition);
        this.cursorRayObject.setTranslationLocal([0.0, 0.0, -dist / 2]);
        if(this.cursorRayScalingAxis != 4) {
            this.cursorRayObject.resetScaling();
            this.cursorRayScale[this.cursorRayScalingAxis] = dist/2;
            this.cursorRayObject.scale(this.cursorRayScale);
        }
    },

    _setCursorVisibility: function(visible) {
        if(this.visible == visible) return;
        this.visible = visible;
        if(!this.cursorObject) return;

        if(visible) {
            this.cursorObject.resetScaling();
            this.cursorObject.scale(this.cursorObjScale);
        } else {
            this.cursorObjScale.set(this.cursorObject.scalingLocal);
            this.cursorObject.scale([0, 0, 0]);
        }

    },

    update: function() {
        /* If in VR, set the cursor ray based on object transform */
        if(this.session) {
            /* Since Google Cardboard tap is registered as arTouchDown without a gamepad, we need to check for gamepad presence */
            if(this.arTouchDown && this.input && WL.xrSession.inputSources[0].handedness === 'none' && WL.xrSession.inputSources[0].gamepad) {
                const p = WL.xrSession.inputSources[0].gamepad.axes;
                /* Screenspace Y is inverted */
                this.direction = [p[0], -p[1], -1.0];
                this.updateDirection();
            } else {
                this.object.getTranslationWorld(this.origin);
                this.object.getForward(this.direction);
            }
            let rayHit = this.rayHit = (this.rayCastMode == 0) ?
                WL.scene.rayCast(this.origin, this.direction, this.collisionMask) :
                WL.physics.rayCast(this.origin, this.direction, this.collisionMask, this.maxDistance);

            if(rayHit.hitCount > 0) {
                this.cursorPos.set(rayHit.locations[0]);
            } else {
                this.cursorPos.fill(0);
            }

            this.hoverBehaviour(rayHit);
        }

        if(this.cursorObject) {
            if(this.hoveringObject && (this.cursorPos[0] != 0 || this.cursorPos[1] != 0 || this.cursorPos[2] != 0)) {
                this._setCursorVisibility(true);
                this.cursorObject.setTranslationWorld(this.cursorPos);
                this._setCursorRayTransform(this.cursorPos);
            } else {
                this._setCursorVisibility(false);
            }
        }
    },

    hoverBehaviour: function(rayHit) {
        if(rayHit.hitCount > 0) {
            if(!this.hoveringObject || !this.hoveringObject.equals(rayHit.objects[0])) {
                /* Unhover previous, if exists */
                if(this.hoveringObject) {
                    const cursorTarget = this.hoveringObject.getComponent("cursor-target");
                    if(cursorTarget) cursorTarget.onUnhover(this.hoveringObject, this);
                    this.globalTarget.onUnhover(this.hoveringObject, this);
                }

                /* Hover new object */
                this.hoveringObject = rayHit.objects[0];
                if(this.styleCursor) WL.canvas.style.cursor = "pointer";
                let cursorTarget = this.hoveringObject.getComponent("cursor-target");
                if(cursorTarget) {
                    this.hoveringObjectTarget = cursorTarget;
                    cursorTarget.onHover(this.hoveringObject, this);
                }
                this.globalTarget.onHover(this.hoveringObject, this);
            }

            if(this.hoveringObjectTarget) {
                this.hoveringObjectTarget.onMove(this.hoveringObject, this);
            }
        } else if(this.hoveringObject && rayHit.hitCount == 0) {
            const cursorTarget = this.hoveringObject.getComponent("cursor-target");
            if(cursorTarget) cursorTarget.onUnhover(this.hoveringObject, this);
            this.globalTarget.onUnhover(this.hoveringObject, this);
            this.hoveringObject = null;
            this.hoveringObjectTarget = null;
            if(this.styleCursor) WL.canvas.style.cursor = "default";
        }
    },

    /**
     * Setup event listeners on session object
     * @param s WebXR session
     *
     * Sets up 'select' and 'end' events and caches the session to avoid
     * Module object access.
     */
    setupVREvents: function(s) {
        /* If in VR, one-time bind the listener */
        this.session = s;
        s.addEventListener('end', function(e) {
            /* Reset cache once the session ends to rebind select etc, in case
             * it starts again */
            this.session = null;
        }.bind(this));

        s.addEventListener('select', function(e) {
            if(e.inputSource.handedness != this.handedness) return;
            if(this.hoveringObject) {
                this._clickOn(this.hoveringObject);
            }
        }.bind(this));

        s.addEventListener('selectstart', this.onTouchStart.bind(this));
        s.addEventListener('selectend', this.onTouchEnd.bind(this));
    },
    onTouchStart: function(e) {
        this.arTouchDown = true;
        /* After AR session was entered, the projection matrix changed */
        this.onViewportResize();
    },
    onTouchEnd: function(e) {
        this.arTouchDown = false;
    },

    /** 'mousemove' event listener */
    onMouseMove: function (e) {
        let bounds = e.target.getBoundingClientRect();
        let rayHit = this.updateMousePos(e.clientX, e.clientY, bounds.width, bounds.height);

        this.hoverBehaviour(rayHit);
    },

    /**
     * Update mouse position in non-VR mode and raycast for new position
     * @returns @ref WL.RayHit for new position.
     */
    updateMousePos: function(clientX, clientY, w, h) {
        /* Get direction in normalized device coordinate space from mouse position */
        let left = clientX/w;
        let top = clientY/h;
        this.direction = [left*2 - 1, -top*2 + 1, -1.0];
        return this.updateDirection();
    },

    updateDirection: function() {
        this.object.getTranslationWorld(this.origin);

        /* Reverse-project the direction into view space */
        vec3.transformMat4(this.direction, this.direction,
            this.projectionMatrix);
        vec3.normalize(this.direction, this.direction);
        vec3.transformQuat(this.direction, this.direction, this.object.transformWorld);
        let rayHit = this.rayHit = (this.rayCastMode == 0) ?
            WL.scene.rayCast(this.origin, this.direction, this.collisionMask) :
            WL.physics.rayCast(this.origin, this.direction, this.collisionMask, this.maxDistance);

        if(rayHit.hitCount > 0) {
            this.cursorPos.set(rayHit.locations[0]);
        } else {
            this.cursorPos.fill(0);
        }

        return rayHit;
    },

    onDeactivate: function() {
        this._setCursorVisibility(false);
        if(this.hoveringObject) {
            const target = this.hoveringObject.getComponent('cursor-target');
            if(target) target.onUnhover(this.hoveringObject, this);
            this.globalTarget.onUnhover(this.hoveringObject, this);
        }
        if(this.cursorRayObject) this.cursorRayObject.scale([0, 0, 0]);
    },

    onActivate: function() {
        this._setCursorVisibility(true);
    }
});
