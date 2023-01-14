/**
 * [WIP] 
 * New 8thwall camera component
 * Currently only works with BACK camera.
 * Suffers greatly from Out-of-memory on safari iOS. If it starts crashing - you have to actually close and reopend safari
 * 
 * How to use:
 * - Create an empty project in the WL editor
 * - Make sure the AR is disabled in the project settings (this avoids clashing with the old 8thwall component)
 * - Add a ViewComponent to the scene
 * - Add this Component to the View
 */

/**
 * Sets up the 8thwall pipeline and retrieves tracking events to place an
 * object at the location of the tracked AR camera / mobile device.
 *
 * Use this for SLAM tracking based on 8thwall.
 *
 * <strike>Make sure to enable 8thwall in "Project Settings" > "AR". See also the
 * [AR Getting Started Guide](/getting-started/quick-start-ar)</strike>.
 * */



// TODO: leave this to be generated in the index.html by the editor
const KEY = "sU7eX52Oe2ZL8qUKBWD5naUlu1ZrnuRrtM1pQ7ukMz8rkOEG8mb63YlYTuiOrsQZTiXKRe";
function loadXR8(scriptURL) {
    return new Promise((res, rej) => {
        const s = document.createElement('script');

        window.addEventListener('xrloaded', () => res(s));
        s.onerror = rej;
        s.setAttribute("crossorigin", "anonymous");
        s.src = scriptURL;
        document.body.appendChild(s);
    });
}

WL.registerComponent('8thwall-camera', {}, {
    name: 'wonderland-engine-8thwall-camera',

    started: false,

    view: null, // cache camera

    position: [0, 0, 0], // cache 8thwall cam position

    rotation: [0, 0, 0, -1], // cache 8thwall cam rotation

    GlTextureRenderer: null, // cache XR8.GlTextureRenderer.pipelineModule

    init: function () {
        this.view = this.object.getComponent("view");

        this.onUpdate = this.onUpdate.bind(this);
        this.onAttach = this.onAttach.bind(this);
    },

    start: async function () {

        WL.scene.colorClearEnabled = false;

        // TODO: retrieve the API key from the editor
        await loadXR8("//apps.8thwall.com/xrweb?appKey=" + KEY);

        XR8.XrController.configure({
            // enableLighting: true,
            disableWorldTracking: false
        });

        this.GlTextureRenderer = XR8.GlTextureRenderer.pipelineModule();
        XR8.addCameraPipelineModules([
            this.GlTextureRenderer, // Draws the camera feed.
            XR8.XrController.pipelineModule(), // Enables SLAM tracking.
            this
        ]);

        const config = {
            cameraConfig: {
                direction: XR8.XrConfig.camera().BACK,
            },
            canvas: Module.canvas,
            allowedDevices: XR8.XrConfig.device().ANY,
            ownRunLoop: false,
        }

        XR8.run(config);
    },

    onAttach: function (params) {
        this.started = true;

        // TODO: is there a better way to retrieve the context? Maybe from WL directly?
        const gl = WL.canvas.getContext("webgl2");

        const rot = this.object.rotationWorld;
        const pos = this.object.getTranslationWorld([]);
        this.position = Array.from(pos);
        this.rotation = Array.from(rot);

        XR8.XrController.updateCameraProjectionMatrix({
            origin: { x: pos[0], y: pos[1], z: pos[2] },
            facing: { x: rot[0], y: rot[1], z: rot[2], w: rot[3] },

            // TODO: should we include this? Does not have any effect, threejs pipeline does not use it. But Babylon does 
            // cam: { pixelRectWidth: Module.canvas.width, pixelRectHeight: Module.canvas.height, nearClipPlane: 0.01, farClipPlane: 100 }
        })

        WL.scene.onPreRender.push(() => {
            gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null); // <--- Should not be needed after next nightly is released (current 20230110)
            XR8.runPreRender(Date.now());

            XR8.runRender(); // <--- tell 8thwall to do it's thing (alternatively call this.GlTextureRenderer.onRender() if you only care about camera feed )
        });

        WL.scene.onPostRender.push(() => {
            XR8.runPostRender(Date.now())
        });
    },


    onUpdate: function (e) {
        if (!e.processCpuResult.reality)
            return;

        const { rotation, position, intrinsics } = e.processCpuResult.reality;

        this.rotation[0] = rotation.x;
        this.rotation[1] = rotation.y;
        this.rotation[2] = rotation.z;
        this.rotation[3] = rotation.w;

        this.position[0] = position.x;
        this.position[1] = position.y;
        this.position[2] = position.z;

        if (intrinsics) {
            for (let i = 0; i < 16; i++) {
                if (Number.isFinite(intrinsics[i])) { // some processCpuResult.reality.intrinsics are set to Infinity, which WL brakes our projectionMatrix. So we just filter those elements out
                    this.view.projectionMatrix[i] = intrinsics[i];
                }
            }
        }

        if (position && rotation) {
            this.object.resetTransform();
            this.object.rotate(this.rotation);
            this.object.translate(this.position);
        }
    },
});