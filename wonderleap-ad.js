import {vec3,quat2} from 'gl-matrix';
/**
 * [Wonderleap](https://wonderleap.co/) Ad Space
 *
 * To serve ads using this component, contact Wonderleap for
 * an Ad User and Ad ID via their website.
 *
 * See [Wonderleap Ad Example](/showcase/wonderleap-ad).
 */
WL.registerComponent('wonderleap-ad', {
    /** Ad user id */
    auId: {type: WL.Type.String, default: 'ce6f68fc-4809-4409-8f57-c631283ce5a3'},
    /** Ad id */
    adId: {type: WL.Type.String}
}, {
    init: function() {
        // TODO: Better let the ad create the correct mesh:
        // this.mesh = this.object.addComponent('mesh');
        // this.mesh.mesh = ...;
        //
        // Missing features:
        //  - [ ] Create Material from shader
        //  - [ ] Reference plane mesh (could create one instead)
        this.mesh = this.object.getComponent('mesh', 0);

        this.collision = this.object.addComponent('collision');
        this.collision.collider = WL.Collider.Box;
        this.collision.group = 0x2;

        this.cursorTarget = this.object.addComponent('cursor-target');

        this.timeSinceLastVizCheck = 0;
        this.visibleDuration = 0;

        /* 10 Seconds min vizibility threshold */
        this.durationThreshold = 10.0;
    },
    start: function() {
        Wonderleap.fetchAd(this.auId).then(function(ad) {
            this.ad = ad;
            WL.textures.load(ad.asset, '')
                .then(function(texture) {
                    const image = WL._images[texture._imageIndex];
                    /* Make ad always 1 meter height, adjust width according to ad aspect ratio */
                    this.collision.extents = [image.width/image.height, 1.0, 0.1];
                    this.object.scale([image.width/image.height, 1.0, 1.0]);
                    if(this.mesh.material.shader == 'Phong Textured') {
                        this.mesh.material.diffuseTexture = texture;
                    } else {
                        this.mesh.material.flatTexture = texture;
                    }
                }.bind(this))
                .catch(console.err);
        }.bind(this));

        this.cursorTarget.addClickFunction(this.click.bind(this));
    },
    update: function(dt) {
        this.timeSinceLastVizCheck += dt;

        /* visibility check */
        if(this.timeSinceLastVizCheck > 0.5) {
            const isVisible = this.isVisible();

            if(isVisible) {
                this.visibleDuration += this.timeSinceLastVizCheck;
            }
            this.timeSinceLastVizCheck = 0;

            if((!isVisible && this.visibleDuration > 0) ||
                this.visibleDuration > this.durationThreshold)
            {
                Wonderleap.sendMetric('gaze', this.visibleDuration, this.ad.adId, this.ad.auId);
                this.visibleDuration = 0;
            }
        }
    },

    isVisible: function() {
        /* Ensure there is a view and it's active */
        const view = WL.scene.activeViews[0];
        if(!view || !view.active) {
            console.warn("wonderleap-ad: camera object does not have an active view");
            return false;
        }

        const transform = view.object.transformWorld;
        const rayOrigin = [0, 0, 0];
        quat2.getTranslation(rayOrigin, transform);
        const rayDir = [0, 0, -1];
        vec3.transformQuat(rayDir, rayDir, transform);

        let hits = WL.scene.rayCast(rayOrigin, rayDir, 0x2);
        for(let i = 0; i < hits.hitCount; ++i) {
            const obj = hits.objects[i];
            if(obj.objectId == this.object.objectId) {
                return true;
            }
        }

        return false;
    },

    click: function() {
        /* Exit VR, in case active, then open link, otherwise open directly */
        const s = Module['webxr_session'];
        if(s) {
            /* Try calling click again once the session ended,
             * this time, the session will be null */
            s.end().then(this.click.bind(this));
            return;
        }

        Wonderleap.sendMetric('click', 0, this.ad.adId, this.ad.auId);
        if(this.ad.url) {
            window.open(this.ad.url, '_blank');
        }
    }
});
