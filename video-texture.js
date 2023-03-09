import {Component, Texture, Type} from '@wonderlandengine/api';

/**
 * Downloads a video from URL and applies it as `diffuseTexture` or `flatTexture`
 * on given material.
 *
 * Video textures need to be updated regularly whenever
 * a new frame is available. This component handles the
 * detection of a new frame and updates the texture to
 * reflect the video's current frame.
 *
 * Materials from the following shaders are supported:
 *  - "Phong Opaque Textured"
 *  - "Flat Opaque Textured"
 *  - "Background"
 *  - "Physical Opaque Textured"
 *  - "Foliage"
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
            throw Error('video-texture: material property not set');
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
        const shader = mat.shader;
        const texture = (this.texture = new Texture(this.engine, this.video));

        if (shader === 'Flat Opaque Textured') {
            mat.flatTexture = texture;
        } else if (shader === 'Phong Opaque Textured' || shader === 'Foliage') {
            mat.diffuseTexture = texture;
        } else if (shader === 'Background') {
            mat.texture = texture;
        } else if (shader === 'Physical Opaque Textured') {
            mat.albedoTexture = texture;
        } else {
            console.error('Shader', shader, 'not supported by video-texture');
        }

        if ('requestVideoFrameCallback' in this.video) {
            this.video.requestVideoFrameCallback(this.updateVideo.bind(this));
        } else {
            this.video.addEventListener(
                'timeupdate',
                () => { this.frameUpdateRequested = true; }
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
