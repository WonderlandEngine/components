/**
 * Sets up the 8thwall pipeline and retrieves tracking events to place an
 * object at the location of the tracked AR camera / mobile device.
 *
 * Use this for SLAM tracking based on 8thwall.
 *
 * Make sure to enable 8thwall in "Project Settings" > "AR". See also the
 * [AR Getting Started Guide](/getting-started/quick-start-ar)
 * 
 * [WIP] 
 * New 8thwall camera component
 * Currently only works with BACK camera.
 *
 * - remove any occurrences of the old 8thwall-camera component in the editor
 * - Add this component to NonVrCamera
 * 
 * IMPORTANT!
 * - until it get's fixed, select 'customIndexHtml' in the project settings
 * - open a generated index.html and crossorigin="anonymous" attribute to the <script> tag where //apps.8thwall.com/xrweb is loaded
 * 
 * 
 * ######### Using UI overlays #############
 * By default, this component renders own UI to give the user feedback about rejected permissions or tracking errors.
 * It can be changed by enabling useCustomUIOverlays flag.
 * 
 * if useCustomUIOverlays is enabled, you are expected handle the following events dispatched by the window object:
 * - "8thwall-request-user-interaction" - used only on iOS safari. Request a user to perform and interaction with the page so that javascript is allowed to allowed to request a motion/camera/mic permissions.
 *  Make sure the window object is dispatching an '8thwall-permissions-allowed' event after interaction has happened. 
 * ```
 * <button onclick="window.dispatchEvent(new Event('8thwall-permissions-allowed'))">Allow Sensors</button>
 * ```
 * 
 * - "8thwall-permission-fail" - user rejected any of the permissions
 * 
 * - "8thwall-error" - runtime 8thwall error occurred
 */


function waitForXR8() {
    return new Promise((resolve, rej) => {
        if (window.XR8) {
            resolve();
        } else {
            window.addEventListener('xrloaded', () => resolve());
        }
    });
}

WL.registerComponent('8thwall-camera', {

    /** Override the WL html overlays for handling camera/motion permissions and error handling */
    useCustomUIOverlays: { type: WL.Type.Bool, default: false },

}, {

    name: 'wonderland-engine-8thwall-camera',

    started: false,

    view: null, // cache camera

    position: [0, 0, 0], // cache 8thwall cam position

    rotation: [0, 0, 0, -1], // cache 8thwall cam rotation

    GlTextureRenderer: null, // cache XR8.GlTextureRenderer.pipelineModule

    promptForDeviceMotion: async function () {
        return new Promise(async (resolve, reject) => {
            
            // Tell anyone who's interested that we want to get some user interaction
            window.dispatchEvent(new Event("8thwall-request-user-interaction"));

            // Wait until someone response that user interaction happened
            window.addEventListener("8thwall-permissions-allowed", async() => {
                try {
                    const motionEvent = await DeviceMotionEvent.requestPermission();
                    resolve(motionEvent);
                } catch (exception) {
                    reject(exception)
                }
            });

            
        })
    },

    getPermissions: async function () {
        // iOS "feature". If we want to request the DeviceMotion permission, user has to interact with the page at first (touch it).
        // If there was no interaction done so far, we will render a HTML overlay with would get the user to interact with the screen

        if (DeviceMotionEvent && DeviceMotionEvent.requestPermission) {
            try {
                const result = await DeviceMotionEvent.requestPermission();

                // The user must have rejected the motion event on previous page load. (safari remembers this choice).
                if (result !== "granted") {
                    throw new Error("MotionEvent");
                }
            } catch (exception) {

                // User had no interaction with the page so far
                if (exception.name === "NotAllowedError") {
                    const motionEvent = await this.promptForDeviceMotion();
                    if (motionEvent !== "granted") {
                        throw new Error("MotionEvent");
                    }
                } else {
                    throw new Error("MotionEvent");
                }
            }
        }

        try {
            // make sure we get the camera stream
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })

            // If we successfully acquired the camera stream - we can stop it and wait until 8thwall requests it again
            stream.getTracks().forEach((track) => {
                track.stop();
            });

        } catch (exception) {
            throw new Error("Camera");
        }
    },


    init: function () {
        this.view = this.object.getComponent("view");
        this.onUpdate = this.onUpdate.bind(this);
        this.onAttach = this.onAttach.bind(this);
        this.onException = this.onException.bind(this);
        this.onCameraStatusChange = this.onCameraStatusChange.bind(this);
    },

    start: async function () {
        console.log("useCustomUIOverlays", this.useCustomUIOverlays);
        if (!this.useCustomUIOverlays) {
            console.log("Initing")
            OverlaysHandler.init();
        }

        try {
            await this.getPermissions();
        } catch (error) {
            // User did not grant the camera or motionEvent permissions
            window.dispatchEvent(new CustomEvent("8thwall-permission-fail", {detail: error}))
            return;
        }

        await waitForXR8();

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

    /**
     * @param {*} params 
     * 
     * private, called by 8thwall
     */
    onAttach: function (params) {
        this.started = true;
        WL.scene.colorClearEnabled = false;

        const gl = Module.ctx;

        const rot = this.object.rotationWorld;
        const pos = this.object.getTranslationWorld([]);
        this.position = Array.from(pos);
        this.rotation = Array.from(rot);

        XR8.XrController.updateCameraProjectionMatrix({
            origin: { x: pos[0], y: pos[1], z: pos[2] },
            facing: { x: rot[0], y: rot[1], z: rot[2], w: rot[3] },
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

    onCameraStatusChange: function (e) {
        if (e && e.status === "failed") {
            this.onException(new Error(`Camera failed with status: ${e.status}`));
        }
    },

    /**
     * @param {*} e 
     * 
     * private, called by 8thwall
     */
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
            //this.object.resetTransform();
            //this.object.rotate(this.rotation);
            //this.object.translateWorld(this.position);

            this.object.rotationWorld = this.rotation;
            this.object.setTranslationWorld(this.position);
        }
    },

    /**
     * @private
     * 8thwall pipeline function
     */
    onException: function (error) {
        console.warn("8thwall exception:", error);
        window.dispatchEvent(new CustomEvent("8thwall-error", {detail: error}));
    },
});

const OverlaysHandler = {
    init: function () {

        this.handleRequestUserInteraction = this.handleRequestUserInteraction.bind(this);
        this.handlePermissionFail = this.handlePermissionFail.bind(this);
        this.handleError = this.handleError.bind(this);

        window.addEventListener("8thwall-request-user-interaction", this.handleRequestUserInteraction);
        window.addEventListener("8thwall-permission-fail", this.handlePermissionFail);
        window.addEventListener("8thwall-error", this.handleError);
    },

    handleRequestUserInteraction: function () {
        const overlay = this.showOverlay(requestPermissionOverlay);
        window.addEventListener("8thwall-permissions-allowed", () => {
            overlay.remove();
        });

    },

    handlePermissionFail: function (_reason) {
        this.showOverlay(failedPermissionOverlay);
    },

    handleError: function (_error) {
        this.showOverlay(runtimeErrorOverlay);
    },

    showOverlay: function (htmlContent) {
        const overlay = document.createElement("div");
        overlay.innerHTML = htmlContent;
        document.body.appendChild(overlay);
        return overlay;
    }
}

const requestPermissionOverlay = `
<style>
  #request-permission-overlay {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    z-index: 999;
    color: #fff;
    background-color: rgba(0, 0, 0, 0.5);
    text-align: center;
    font-family: sans-serif;
  }

  .request-permission-overlay_title {
    margin: 30px;
    font-size: 32px;
  }

  .request-permission-overlay_button {
    background-color: #e80086;
    font-size: 22px;
    padding: 10px 30px;
    color: #fff;
    border-radius: 15px;
    border: none;
  }
</style>

<div id="request-permission-overlay">
  <div class="request-permission-overlay_title">This app requires to use your camera and motion sensors</div>

  <button class="request-permission-overlay_button" onclick="window.dispatchEvent(new Event('8thwall-permissions-allowed'))">OK</button>
</div>`;

const failedPermissionOverlay = `
<style>
  #failed-permission-overlay {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    z-index: 999;
    color: #fff;
    background-color: rgba(0, 0, 0, 0.5);
    text-align: center;
    font-family: sans-serif;
  }

  .failed-permission-overlay_title {
    margin: 30px;
    font-size: 32px;
  }

  .failed-permission-overlay_button {
    background-color: #e80086;
    font-size: 22px;
    padding: 10px 30px;
    color: #fff;
    border-radius: 15px;
    border: none;
  }
</style>

<div id="failed-permission-overlay">
  <div class="failed-permission-overlay_title">Failed to grant permissions. Reset the the permissions and refresh the page.</div>

  <button class="failed-permission-overlay_button" onclick="window.location.reload()">Refresh the page</button>
</div>`;

const runtimeErrorOverlay = `
<style>
  #wall-error-overlay {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    z-index: 999;
    color: #fff;
    background-color: rgba(0, 0, 0, 0.5);
    text-align: center;
    font-family: sans-serif;
  }

  .wall-error-overlay_title {
    margin: 30px;
    font-size: 32px;
  }

  .wall-error-overlay_button {
    background-color: #e80086;
    font-size: 22px;
    padding: 10px 30px;
    color: #fff;
    border-radius: 15px;
    border: none;
  }
</style>

<div id="wall-error-overlay">
  <div class="wall-error-overlay_title">Error has occurred. Please reload the page</div>

  <button class="wall-error-overlay_button" onclick="window.location.reload()">Reload</button>
</div>`;
