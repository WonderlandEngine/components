import {vec3} from 'gl-matrix';
/**
 * Controls the camera through mouse movement.
 *
 * Efficiently implemented to affect object orientation only
 * when the mouse moves.
 */
WL.registerComponent('mouse-look', {
    /** Mouse look sensitivity */
    sensitity: {type: WL.Type.Float, default: 0.25},
    /** Require a mouse button to be pressed to control view.
     * Otherwise view will allways follow mouse movement */
    requireMouseDown: {type: WL.Type.Bool, default: true},
    /** If "moveOnClick" is enabled, mouse button which should
     * be held down to control view */
    mouseButtonIndex: {type: WL.Type.Int, default: 0},
    /** Enables pointer lock on "mousedown" event on WL.canvas */
    pointerLockOnClick: {type: WL.Type.Bool, default: false},
}, {
    init: function() {
        this.currentRotationY = 0;
        this.currentRotationX = 0;
        this.origin = new Float32Array(3);
        this.parentOrigin = new Float32Array(3);
        document.addEventListener('mousemove', function(e) {
            if(this.active && (this.mouseDown || !this.requireMouseDown)) {
                this.rotationY = -this.sensitity*e.movementX/100;
                this.rotationX = -this.sensitity*e.movementY/100;

                this.currentRotationX += this.rotationX;
                this.currentRotationY += this.rotationY;

                /* 1.507 = PI/2 = 90° */
                this.currentRotationX = Math.min(1.507, this.currentRotationX);
                this.currentRotationX = Math.max(-1.507, this.currentRotationX);

                this.object.getTranslationWorld(this.origin);
                this.object.parent.getTranslationWorld(this.parentOrigin);
                vec3.sub(this.origin, this.origin, this.parentOrigin);

                this.object.resetTranslationRotation();
                this.object.rotateAxisAngleRad([1, 0, 0], this.currentRotationX);
                this.object.rotateAxisAngleRad([0, 1, 0], this.currentRotationY);
                this.object.translate(this.origin);
            }
        }.bind(this));
        
        if(this.pointerLockOnClick) {
            WL.canvas.addEventListener("mousedown", () => {
                WL.canvas.requestPointerLock =
                    WL.canvas.requestPointerLock ||
                    WL.canvas.mozRequestPointerLock ||
                    WL.canvas.webkitRequestPointerLock;
                WL.canvas.requestPointerLock();
            });
        }

        if(this.requireMouseDown) {
            if(this.mouseButtonIndex == 2) {
                WL.canvas.addEventListener("contextmenu", function(e) {
                    e.preventDefault();
                }, false);
            }
            WL.canvas.addEventListener('mousedown', function(e) {
                if(e.button == this.mouseButtonIndex) {
                    this.mouseDown = true;
                    document.body.style.cursor = "grabbing";
                    if(e.button == 1) {
                        e.preventDefault();
                        /* Prevent scrolling */
                        return false;
                    }
                }
            }.bind(this));
            WL.canvas.addEventListener('mouseup', function(e) {
                if(e.button == this.mouseButtonIndex) {
                    this.mouseDown = false;
                    document.body.style.cursor = "initial";
                }
            }.bind(this));
        }
    },
    start: function() {
        this.rotationX = 0;
        this.rotationY = 0;
    }
});
