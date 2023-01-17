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
 * By default, this component does not render any UI to give the user any feedback about rejected permissions or tracking errors.
 * It can be changed by enabling useCustomHTML flag.
 * 
 * If useCustomHTML is enabled, this component will load the following URLs which should be stored in the 'static' folder: 
 * 'customPermissionDialogURL' - url to that .html file which will override the default 8thwall popup asking iOS Safari to perform a user interaction before javascript is allowed to request a motion/camera/mic permissions.
 * Make sure the window object is dispatching an '8thwall-permissions-allowed' event after interaction has happened. 
 * ```
 * <button onclick="window.dispatchEvent(new Event('8thwall-permissions-allowed'))">Allow Sensors</button>
 * ```
 * 
 * 'customFailedPermissionsDialog' - url to the .html file which render the overlay if user rejects any of the required permissions.
 * Usually this overlay asks the user to reset the permissions (with possibly showing how to do that) and ask the user to refresh the page
 * 
 * 'customGenericErrorOverlay' - URL to the .html file which displays a message that an error occurred. 
 */


 function waitForXR8(scriptURL) {
    return new Promise((resolve, rej) => {
        if (window.XR8) {
            resolve();
        } else {
            window.addEventListener('xrloaded', () => resolve());
        }
    });
}

WL.registerComponent('8thwall-camera-v2', {

    camera: { type: WL.Type.Enum, values: ['back', 'front'], default: 'back' },

    /** Use default 8thwall overlays for requesting motion/camera permissions and handling errors */
    useCustomHTML: { type: WL.Type.Bool, default: false },

    /** URL to custom camera/motion permission dialog. Used only for iOS since iOS requres user interaction before asking requesting those permissions */
    customPermissionDialogURL: { type: WL.Type.String, default: '' },

    /** URL to custom iOS error overlay that permissions were not granted */
    // customiOSFailedPermissionsDialog: { type: WL.Type.String, default: '' },

    /** URL to custom error overlay that permissions were not granted */
    customFailedPermissionsDialog: { type: WL.Type.String, default: '' },

    /** URL to generic 8thwall error message. Nothing will be rendered if not set */
    customGenericErrorOverlay: { type: WL.Type.String, default: '' },
}, {

    name: 'wonderland-engine-8thwall-camera',

    started: false,

    view: null, // cache camera

    position: [0, 0, 0], // cache 8thwall cam position

    rotation: [0, 0, 0, -1], // cache 8thwall cam rotation

    GlTextureRenderer: null, // cache XR8.GlTextureRenderer.pipelineModule

    showOverlay: async function (url) {
        const htmlContent = await fetch(url).then(response => response.text());
        const overlay = document.createElement("div");
        overlay.innerHTML = htmlContent;
        document.body.appendChild(overlay);
        return overlay;
    },

    promptForDeviceMotion: async function () {
        return new Promise(async (resolve, reject) => {
            const overlay = await this.showOverlay(this.customPermissionDialogURL);
            const permissionsAllowed = async () => {
                try {
                    const motionEvent = await DeviceMotionEvent.requestPermission();
                    resolve(motionEvent);
                } catch (exception) {
                    reject(exception)
                }
                finally {
                    overlay.remove();
                    window.removeEventListener("8thwall-permissions-allowed", permissionsAllowed);
                }
            }
            window.addEventListener("8thwall-permissions-allowed", permissionsAllowed);
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
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
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

        if (this.useCustomHTML) {
            try {
                await this.getPermissions();
            } catch (_error) {
                // User did not grant the camera or motionEvent permissions
                this.showOverlay(this.customFailedPermissionsDialog);
                return;
            }
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
            this.onException(new Error("Failed to request camera"));
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
     * 
     * 
     * // TODO: cache the error somewhere so that the rendered overlay can access it.
     */
    onException: function (error) {
        console.warn("8thwall exception:", error);
        if (this.useCustomHTML) {
            this.showOverlay(this.customGenericErrorOverlay);
        }
    },
});