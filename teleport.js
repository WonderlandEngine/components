import {vec3, quat2} from 'gl-matrix';
import {Component, Type} from '@wonderlandengine/api';
/**
 * Teleport VR locomotion.
 *
 * See [Teleport Example](/showcase/teleport).
 */
export class TeleportComponent extends Component {
    static TypeName = 'teleport';
    static Properties = {
        /** Object that will be placed as indiciation forwhere the player will teleport to. */
        teleportIndicatorMeshObject: {type: Type.Object},
        /** Root of the player, the object that will be positioned on teleportation. */
        camRoot: {type: Type.Object},
        /** Non-vr camera for use outside of VR */
        cam: {type: Type.Object},
        /** Left eye for use in VR*/
        eyeLeft: {type: Type.Object},
        /** Right eye for use in VR*/
        eyeRight: {type: Type.Object},
        /** Handedness for VR cursors to accept trigger events only from respective controller. */
        handedness: {
            type: Type.Enum,
            values: ['input component', 'left', 'right', 'none'],
            default: 'input component',
        },
        /** Collision group of valid "floor" objects that can be teleported on */
        floorGroup: {type: Type.Int, default: 1},
        /** How far the thumbstick needs to be pushed to have the teleport target indicator show up */
        thumbstickActivationThreshhold: {type: Type.Float, default: -0.7},
        /** How far the thumbstick needs to be released to execute the teleport */
        thumbstickDeactivationThreshhold: {type: Type.Float, default: 0.3},
        /** Offset to apply to the indicator object, e.g. to avoid it from Z-fighting with the floor */
        indicatorYOffset: {type: Type.Float, default: 0.01},

        /** Mode for raycasting, whether to use PhysX or simple collision components */
        rayCastMode: {
            type: Type.Enum,
            values: ['collision', 'physx'],
            default: 'collision',
        },
        /** Max distance for PhysX raycast */
        maxDistance: {type: Type.Float, default: 100.0},
    };

    init() {
        this._prevThumbstickAxis = new Float32Array(2);
        this._tempVec = new Float32Array(3);
        this._tempVec0 = new Float32Array(3);
        this._currentIndicatorRotation = 0;

        this.input = this.object.getComponent('input');
        if (!this.input) {
            console.error(
                this.object.name,
                'generic-teleport-component.js: input component is required on the object'
            );
            return;
        }
        if (!this.teleportIndicatorMeshObject) {
            console.error(
                this.object.name,
                'generic-teleport-component.js: Teleport indicator mesh is missing'
            );
            return;
        }
        if (!this.camRoot) {
            console.error(
                this.object.name,
                'generic-teleport-component.js: camRoot not set'
            );
            return;
        }
        this.isIndicating = false;

        this.indicatorHidden = true;
        this.hitSpot = new Float32Array(3);
        this._hasHit = false;

        this._extraRotation = 0;
        this._currentStickAxes = new Float32Array(2);
    }

    start() {
        if (this.cam) {
            this.isMouseIndicating = false;
            canvas.addEventListener('mousedown', this.onMouseDown.bind(this));
            canvas.addEventListener('mouseup', this.onMouseUp.bind(this));
        }

        if (this.handedness == 0) {
            const inputComp = this.object.getComponent('input');
            if (!inputComp) {
                console.warn(
                    'teleport component on object',
                    this.object.name,
                    'was configured with handedness "input component", ' +
                        'but object has no input component.'
                );
            } else {
                this.handedness = inputComp.handedness;
                this.input = inputComp;
            }
        } else {
            this.handedness = ['left', 'right'][this.handedness - 1];
        }

        this.onSessionStartCallback = this.setupVREvents.bind(this);
        this.teleportIndicatorMeshObject.active = false;
    }

    onActivate() {
        this.engine.onXRSessionStart.add(this.onSessionStartCallback);
    }

    onDeactivate() {
        this.engine.onXRSessionStart.remove(this.onSessionStartCallback);
    }

    /* Get current camera Y rotation */
    _getCamRotation() {
        this.eyeLeft.getForward(this._tempVec);
        this._tempVec[1] = 0;
        vec3.normalize(this._tempVec, this._tempVec);
        return Math.atan2(this._tempVec[0], this._tempVec[2]);
    }

    update() {
        let inputLength = 0;
        if (this.gamepad && this.gamepad.axes) {
            this._currentStickAxes[0] = this.gamepad.axes[2];
            this._currentStickAxes[1] = this.gamepad.axes[3];
            inputLength =
                Math.abs(this._currentStickAxes[0]) + Math.abs(this._currentStickAxes[1]);
        }

        if (
            !this.isIndicating &&
            this._prevThumbstickAxis[1] >= this.thumbstickActivationThreshhold &&
            this._currentStickAxes[1] < this.thumbstickActivationThreshhold
        ) {
            this.isIndicating = true;
        } else if (
            this.isIndicating &&
            inputLength < this.thumbstickDeactivationThreshhold
        ) {
            this.isIndicating = false;
            this.teleportIndicatorMeshObject.active = false;

            if (this._hasHit) {
                this._teleportPlayer(this.hitSpot, this._extraRotation);
            }
        }

        if (this.isIndicating && this.teleportIndicatorMeshObject && this.input) {
            const origin = this._tempVec0;
            quat2.getTranslation(origin, this.object.transformWorld);

            const direction = this.object.getForward(this._tempVec);
            let rayHit = (this.rayHit =
                this.rayCastMode == 0
                    ? this.engine.scene.rayCast(origin, direction, 1 << this.floorGroup)
                    : this.engine.physics.rayCast(
                          origin,
                          direction,
                          1 << this.floorGroup,
                          this.maxDistance
                      ));
            if (rayHit.hitCount > 0) {
                this.indicatorHidden = false;

                this._extraRotation =
                    Math.PI +
                    Math.atan2(this._currentStickAxes[0], this._currentStickAxes[1]);
                this._currentIndicatorRotation =
                    this._getCamRotation() + (this._extraRotation - Math.PI);
                this.teleportIndicatorMeshObject.resetTranslationRotation();
                this.teleportIndicatorMeshObject.rotateAxisAngleRad(
                    [0, 1, 0],
                    this._currentIndicatorRotation
                );

                this.teleportIndicatorMeshObject.translate(rayHit.locations[0]);
                this.teleportIndicatorMeshObject.translate([
                    0.0,
                    this.indicatorYOffset,
                    0.0,
                ]);
                this.teleportIndicatorMeshObject.active = true;

                this.hitSpot.set(rayHit.locations[0]);
                this._hasHit = true;
            } else {
                if (!this.indicatorHidden) {
                    this.teleportIndicatorMeshObject.active = false;
                    this.indicatorHidden = true;
                }
                this._hasHit = false;
            }
        } else if (this.teleportIndicatorMeshObject && this.isMouseIndicating) {
            this.onMousePressed();
        }

        this._prevThumbstickAxis.set(this._currentStickAxes);
    }

    setupVREvents(s) {
        /* If in VR, one-time bind the listener */
        this.session = s;
        s.addEventListener(
            'end',
            function () {
                /* Reset cache once the session ends to rebind select etc, in case
                 * it starts again */
                this.gamepad = null;
                this.session = null;
            }.bind(this)
        );

        if (s.inputSources && s.inputSources.length) {
            for (let i = 0; i < s.inputSources.length; i++) {
                let inputSource = s.inputSources[i];

                if (inputSource.handedness == this.handedness) {
                    this.gamepad = inputSource.gamepad;
                }
            }
        }

        s.addEventListener(
            'inputsourceschange',
            function (e) {
                if (e.added && e.added.length) {
                    for (let i = 0; i < e.added.length; i++) {
                        let inputSource = e.added[i];
                        if (inputSource.handedness == this.handedness) {
                            this.gamepad = inputSource.gamepad;
                        }
                    }
                }
            }.bind(this)
        );
    }
    onMouseDown() {
        this.isMouseIndicating = true;
    }
    onMouseUp() {
        this.isMouseIndicating = false;
        this.teleportIndicatorMeshObject.active = false;
        if (this._hasHit) {
            this._teleportPlayer(this.hitSpot, 0.0);
        }
    }
    onMousePressed() {
        let origin = [0, 0, 0];
        quat2.getTranslation(origin, this.cam.transformWorld);

        const direction = this.cam.getForward(this._tempVec);
        let rayHit = (this.rayHit =
            this.rayCastMode == 0
                ? this.engine.scene.rayCast(origin, direction, 1 << this.floorGroup)
                : this.engine.physics.rayCast(
                      origin,
                      direction,
                      1 << this.floorGroup,
                      this.maxDistance
                  ));
        if (rayHit.hitCount > 0) {
            this.indicatorHidden = false;

            direction[1] = 0;
            vec3.normalize(direction, direction);

            this._currentIndicatorRotation =
                -Math.sign(direction[2]) * Math.acos(direction[0]) - Math.PI * 0.5;

            this.teleportIndicatorMeshObject.resetTranslationRotation();
            this.teleportIndicatorMeshObject.rotateAxisAngleRad(
                [0, 1, 0],
                this._currentIndicatorRotation
            );
            this.teleportIndicatorMeshObject.translate(rayHit.locations[0]);
            this.teleportIndicatorMeshObject.active = true;

            this.hitSpot = rayHit.locations[0];
            this._hasHit = true;
        } else {
            if (!this.indicatorHidden) {
                this.teleportIndicatorMeshObject.active = false;
                this.indicatorHidden = true;
            }
            this._hasHit = false;
        }
    }

    _teleportPlayer(newPosition, rotationToAdd) {
        this.camRoot.rotateAxisAngleRad([0, 1, 0], rotationToAdd);

        const p = this._tempVec;
        const p1 = this._tempVec0;

        if (this.session) {
            this.eyeLeft.getTranslationWorld(p);
            this.eyeRight.getTranslationWorld(p1);

            vec3.add(p, p, p1);
            vec3.scale(p, p, 0.5);
        } else {
            this.cam.getTranslationWorld(p);
        }

        this.camRoot.getTranslationWorld(p1);
        vec3.sub(p, p1, p);
        p[0] += newPosition[0];
        p[1] = newPosition[1];
        p[2] += newPosition[2];

        this.camRoot.setTranslationWorld(p);
    }
}
