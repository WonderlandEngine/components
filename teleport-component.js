import {vec3,quat2} from 'gl-matrix';
/**
 * Basic implementation of teleport VR locomotion.
 *
 * **Note:** Make sure to set the floorGroup to a non-0 value!
 *
 * See [Teleport Example](/showcase/teleport).
 */
WL.registerComponent("teleport-component", {
    /** Object that will be placed as indiciation for where the player will teleport to. */
    teleportIndicatorMeshObject: {type: WL.Type.Object, default: null},
    /** Root of the player, the object that will be positioned on teleportation. */
    camRoot: {type: WL.Type.Object, default: null},
    /** Collision group of valid "floor" objects that can be teleported on */
    floorGroup: {type: WL.Type.Int, default: 1}
}, {
    init: function() {
        if(this.teleportIndicatorMeshObject) {
            let origin = [0, 0, 0];
            quat2.getTranslation(origin, this.object.transformWorld);

            this.isIndicating = false;

            WL.canvas.addEventListener('mousedown', this.onMouseDown.bind(this));
            WL.canvas.addEventListener('mouseup', this.onMouseUp.bind(this));
            this.indicatorHidden = true;
            this.hitSpot = undefined;
        } else {
            console.error(this.object.name, '- Teleport Component: Teleport indicator mesh is missing.');
        }
    },
    update: function() {
        if(this.isIndicating && this.teleportIndicatorMeshObject)
        {
            let origin = [0, 0, 0];
            quat2.getTranslation(origin, this.object.transformWorld);

            let quat = this.object.transformWorld;

            let forwardDirection = [0, 0, 0];
            vec3.transformQuat(forwardDirection, [0, 0, -1], quat);
            let rayHit = WL.scene.rayCast(origin, forwardDirection, 1 << this.floorGroup);
            if(rayHit.hitCount > 0) {
                if(this.indicatorHidden) {
                    this.indicatorHidden = false;
                }

                this.teleportIndicatorMeshObject.resetTransform();
                this.teleportIndicatorMeshObject.translate(rayHit.locations[0]);

                this.hitSpot = rayHit.locations[0];
            } else {
                if(!this.indicatorHidden) {
                    this.teleportIndicatorMeshObject.translate([1000, 1000, 1000]);
                    this.indicatorHidden = true;
                }
                this.hitSpot = undefined;
            }
        }
    },
    onMouseDown: function(){
        this.isIndicating = true;
    },
    onMouseUp: function(){
        this.isIndicating = false;
        this.teleportIndicatorMeshObject.translate([1000, 1000, 1000]);

        if(this.hitSpot && this.camRoot) {
            this.camRoot.resetTransform();
            this.camRoot.translate(this.hitSpot);
        } else if(!this.camRoot) {
            console.error(this.object.name, '- Teleport Component: Cam Root reference is missing.');
        }
    }
});
