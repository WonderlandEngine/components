/**
 * Sets up the 8thwall pipeline and retrieves tracking events to place an
 * object at the location of the tracked AR camera / mobile device.
 *
 * Use this for SLAM tracking based on 8thwall.
 *
 * Make sure to enable 8thwall in "Project Settings" > "AR". See also the
 * [AR Getting Started Guide](/getting-started/quick-start-ar). */
WL.registerComponent('8thwall-camera', {
    /** Choose front/back camera */
    camera: {type: WL.Type.Enum, values: ['auto', 'back', 'front'], default: 'auto'},
}, {
    name: 'wonderland-engine',

    init: function() {
        this.position = [0, 0, 0, 0];
        this.rotation = [0, 0, 0, 0];
        this.started = false;

        const vals = ['auto', 'back', 'front'];
        this.camera = vals[this.camera];
        if(this.camera == 'auto') {
            this.camera = 'back';
        }

        this.onStart = this.onStart.bind(this);
        this.onUpdate = this.onUpdate.bind(this);

        XR8.addCameraPipelineModules([
            /* Draw the camera feed */
            XR8.GlTextureRenderer.pipelineModule(),
            XR8.XrController.pipelineModule(),
            this,
        ]);

        if(this.camera == 'back') {
            XR8.run({canvas: Module['canvas'], ownRunLoop: false});

        } else if(this.camera == 'back') {
            XR8.XrController.configure({disableWorldTracking: true});
            XR8.run({canvas: Module['canvas'], ownRunLoop: false, cameraConfig: {
                direction: XR8.XrConfig.camera().FRONT
            }});
        } else {
            console.error("[8thwall-camera] Invalid camera setting:", this.camera);
        }
    },

    update: function() {
        if(this.started) {
            if(WL.scene.onPostRender.length == 0) {
                WL.scene.onPreRender.push(function() {
                    XR8.runPreRender(Date.now());
                    _wl_reset_context();
                });
                WL.scene.onPostRender.push(function() {
                    XR8.runPostRender(Date.now());
                    //_wl_reset_context();
                });
            }

            if(this.rotation[0] == 0 && this.rotation[1] == 0 &&
                this.rotation[2] == 0 && this.rotation[3] == 0) {
                return;
            }

            /* Apply the transform retrieved from 8thwall */
            this.object.resetTransform();
            this.object.rotate(this.rotation);
            this.object.translate(this.position);
        }
    },

    /* XR8 CameraPipelineModule functions
     * See: https://www.8thwall.com/docs/web/#camerapipelinemodule */
    onUpdate: function(data) {
        if (!data.processCpuResult.reality) return;
        let r = data.processCpuResult.reality.rotation;
        this.rotation[0] = r.x;
        this.rotation[1] = r.y;
        this.rotation[2] = r.z;
        this.rotation[3] = r.w;
        let p = data.processCpuResult.reality.position;
        this.position[0] = p.x;
        this.position[1] = p.y;
        this.position[2] = p.z;
    },

    onStart: function() {
        this.started = true;
    }
});
