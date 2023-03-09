import {Component, Type} from '@wonderlandengine/api';

/**
 * 8thwall camera component.
 *
 * Sets up the 8thwall pipeline and retrieves tracking events to place an
 * object at the location of the tracked AR camera / mobile device.
 *
 * Use this for SLAM tracking based on 8thwall.
 *
 * Make sure to enable 8thwall in "Project Settings" > "AR". See also the
 * [AR Getting Started Guide](/getting-started/quick-start-ar)
 *
 *
 * Currently only supports world-tracking (SLAM) using BACK camera.
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
 * If useCustomUIOverlays is enabled, you are expected handle the following events dispatched by the window object:
 * - "8thwall-request-user-interaction" - used only on iOS safari. Request a user to perform and interaction with the page so that javascript is allowed to allowed to request a motion/camera/mic permissions.
 *  Make sure the window object is dispatching an '8thwall-safe-to-request-permissions' event after interaction has happened.
 * ```
 * <button onclick="window.dispatchEvent(new Event('8thwall-safe-to-request-permissions'))">Allow Sensors</button>
 * ```
 *
 * - "8thwall-permission-fail" - user rejected any of the permissions
 *
 * - "8thwall-error" - runtime 8thwall error occurred
 */
export class ARCamera8thwall extends Component {
    static TypeName = '8thwall-camera';
    static Properties = {
    /** Override the WL html overlays for handling camera/motion permissions and error handling */
    useCustomUIOverlays: { type: Type.Bool, default: false },
};

    /* 8thwall camera pipeline module name */
    name ='wonderland-engine-8thwall-camera';

    started = false;

    view = null; // cache camera

    position = [0, 0, 0]; // cache 8thwall cam position

    rotation = [0, 0, 0, -1]; // cache 8thwall cam rotation

    glTextureRenderer = null; // cache XR8.GlTextureRenderer.pipelineModule

    promptForDeviceMotion() {
        return new Promise(async (resolve, reject) => {

            // Tell anyone who's interested that we want to get some user interaction
            window.dispatchEvent(new Event('8thwall-request-user-interaction'));

            // Wait until someone response that user interaction happened
            window.addEventListener('8thwall-safe-to-request-permissions', async () => {
                try {
                    const motionEvent = await DeviceMotionEvent.requestPermission();
                    resolve(motionEvent);
                } catch(exception) {
                    reject(exception)
                }
            });
        })
    }

    async getPermissions() {
        // iOS "feature". If we want to request the DeviceMotion permission, user has to interact with the page at first (touch it).
        // If there was no interaction done so far, we will render a HTML overlay with would get the user to interact with the screen
        if (DeviceMotionEvent && DeviceMotionEvent.requestPermission) {
            try {
                const result = await DeviceMotionEvent.requestPermission();

                // The user must have rejected the motion event on previous page load. (safari remembers this choice).
                if (result !== 'granted') {
                    throw new Error('MotionEvent');
                }
            } catch(exception) {

                // User had no interaction with the page so far
                if (exception.name === 'NotAllowedError') {
                    const motionEvent = await this.promptForDeviceMotion();
                    if (motionEvent !== 'granted') {
                        throw new Error('MotionEvent');
                    }
                } else {
                    throw new Error('MotionEvent');
                }
            }
        }

        try {
            // make sure we get the camera stream
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })

            // If we successfully acquired the camera stream - we can stop it and wait until 8thwall requests it again
            stream.getTracks().forEach((track) => { track.stop() });
        } catch(exception) {
            throw new Error('Camera');
        }
    }



    init() {
        this.view = this.object.getComponent('view');
        this.onUpdate = this.onUpdate.bind(this);
        this.onAttach = this.onAttach.bind(this);
        this.onException = this.onException.bind(this);
        this.onCameraStatusChange = this.onCameraStatusChange.bind(this);
    }


    async start() {
        this.view = this.object.getComponent('view');
        if (!this.useCustomUIOverlays) {
            OverlaysHandler.init();
        }

        try {
            await this.getPermissions();
        } catch(error) {
            // User did not grant the camera or motionEvent permissions
            window.dispatchEvent(new CustomEvent('8thwall-permission-fail', { detail: error }))
            return;
        }
        await this.waitForXR8();

        XR8.XrController.configure({
            disableWorldTracking: false
        });

        this.glTextureRenderer = XR8.GlTextureRenderer.pipelineModule();
        XR8.addCameraPipelineModules([
            this.glTextureRenderer, // Draws the camera feed.
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
    }


    /**
     * @private
     * 8thwall pipeline function
     */
    onAttach(params) {
        this.started = true;
        this.engine.scene.colorClearEnabled = false;

        const gl = Module.ctx;

        const rot = this.object.rotationWorld;
        const pos = this.object.getTranslationWorld([]);
        this.position = Array.from(pos);
        this.rotation = Array.from(rot);

        XR8.XrController.updateCameraProjectionMatrix({
            origin: { x: pos[0], y: pos[1], z: pos[2] },
            facing: { x: rot[0], y: rot[1], z: rot[2], w: rot[3] },
            cam: { pixelRectWidth: Module.canvas.width, pixelRectHeight: Module.canvas.height, nearClipPlane: this.view.near, farClipPlane: this.view.far }
        })

        this.engine.scene.onPreRender.push(() => {
            gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);
            XR8.runPreRender(Date.now());
            XR8.runRender(); // <--- tell 8thwall to do it's thing (alternatively call this.glTextureRenderer.onRender() if you only care about camera feed )
        });

        this.engine.scene.onPostRender.push(() => {
            XR8.runPostRender(Date.now())
        });
    }


    /**
     * @private
     * 8thwall pipeline function
     */
    onCameraStatusChange(e) {
        if (e && e.status === 'failed') {
            this.onException(new Error(`Camera failed with status: ${e.status}`));
        }
    }


    /**
    * @private
    * 8thwall pipeline function
    */
    onUpdate(e) {
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
            const projectionMatrix = this.view.projectionMatrix;
            for (let i = 0; i < 16; i++) {
                /* Some processCpuResult.reality.intrinsics are set to Infinity,
                 * which brakes our projectionMatrix. So we just filter those elements out. */
                if (Number.isFinite(intrinsics[i])) {
                    projectionMatrix[i] = intrinsics[i];
                }
            }
        }

        if (position && rotation) {
            this.object.rotationWorld = this.rotation;
            this.object.setTranslationWorld(this.position);
        }
    }


    /**
     * @private
     * 8thwall pipeline function
     */
    onException(error) {
        console.error('8thwall exception:', error);
        window.dispatchEvent(new CustomEvent('8thwall-error', { detail: error }));
    }


    waitForXR8() {
        return new Promise((resolve, _rej) => {
            if (window.XR8) {
                resolve();
            } else {
                window.addEventListener('xrloaded', () => resolve());
            }
        });
    }

}

const OverlaysHandler = {
    init: function () {

        this.handleRequestUserInteraction = this.handleRequestUserInteraction.bind(this);
        this.handlePermissionFail = this.handlePermissionFail.bind(this);
        this.handleError = this.handleError.bind(this);

        window.addEventListener('8thwall-request-user-interaction', this.handleRequestUserInteraction);
        window.addEventListener('8thwall-permission-fail', this.handlePermissionFail);
        window.addEventListener('8thwall-error', this.handleError);
    },

    handleRequestUserInteraction: function () {
        const overlay = this.showOverlay(requestPermissionOverlay);
        window.addEventListener('8thwall-safe-to-request-permissions', () => {
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
        const overlay = document.createElement('div');
        overlay.innerHTML = htmlContent;
        document.body.appendChild(overlay);
        return overlay;
    },
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

  <button class="request-permission-overlay_button" onclick="window.dispatchEvent(new Event('8thwall-safe-to-request-permissions'))">OK</button>
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
