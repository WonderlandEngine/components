import {Component, Texture, Type} from '@wonderlandengine/api';

/**
 * Downloads a video from URL and applies it as `diffuseTexture` or `flatTexture`
 * on given material.
 *
 * Video textures need to be updated regularly whenever
 * a new frame is available. This component handles the
 * detection of a new frame and updates the texture to
 * reflect the video's current frame.
 * Only "Phong Opaque Textured" and "Flat Opaque Textured" materials are supported.
 *
 * The video can be accessed through `this.video`:
 *
 * ```js
 *   let videoTexture = this.object.getComponent('video-texture');
 *   videoTexture.video.play();
 *   videoTexture.video.pause();
 * ```
 *
 * See [Video Example](/showcase/video).
 */
export class VideoTexture extends Component {
    static TypeName = 'video-texture';
    static Properties = {
        /** URL to download video from */
        url: {type: Type.String},
        /** Material to apply the video texture to */
        material: {type: Type.Material},
        /** Whether to loop the video */
        loop: {type: Type.Bool, default: true},
        /** Whether to automatically start playing the video */
        autoplay: {type: Type.Bool, default: true},
        /** Whether to mute sound */
        muted: {type: Type.Bool, default: true},
    };

    init() {
        if (!this.material) {
            console.error('video-texture: material property not set');
            return;
        }
        this.loaded = false;
        this.frameUpdateRequested = true;
    }

    start() {
        this.video = document.createElement('video');
        this.video.src = this.url;
        this.video.crossOrigin = 'anonymous';
        this.video.playsInline = true;
        this.video.loop = this.loop;
        this.video.muted = this.muted;
        this.video.addEventListener('playing', () => { this.loaded = true; });

        if (this.autoplay) {
            const playAfterUserGesture = () => {
                this.video.play();

                window.removeEventListener('click', playAfterUserGesture);
                window.removeEventListener('touchstart', playAfterUserGesture);
            };
            window.addEventListener('click', playAfterUserGesture);
            window.addEventListener('touchstart', playAfterUserGesture);
        }
    }

    applyTexture() {
        const mat = this.material;
        this.texture = new Texture(this.engine, this.video);
        if (mat.shader == 'Flat Opaque Textured') {
            mat.flatTexture = this.texture;
        } else if (mat.shader == 'Phong Opaque Textured') {
            mat.diffuseTexture = this.texture;
        } else {
            console.error('Shader', mat.shader, 'not supported by video-texture');
        }

        if ('requestVideoFrameCallback' in this.video) {
            this.video.requestVideoFrameCallback(this.updateVideo.bind(this));
        } else {
            this.video.addEventListener(
                'timeupdate',
                function () {
                    this.frameUpdateRequested = true;
                }.bind(this)
            );
        }
    }

    update(dt) {
        if (this.loaded && this.frameUpdateRequested) {
            if (this.texture) {
                this.texture.update();
            } else {
                /* Apply texture on first frame update request */
                this.applyTexture();
            }
            this.frameUpdateRequested = false;
        }
    }

    updateVideo() {
        this.frameUpdateRequested = true;
        this.video.requestVideoFrameCallback(this.updateVideo.bind(this));
    }
}
