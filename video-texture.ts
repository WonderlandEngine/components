import {Component, Texture, Property, Material} from '@wonderlandengine/api';
import {setFirstMaterialTexture} from './utils/utils.js';
import {property} from '@wonderlandengine/api/decorators.js';

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

    /** URL to download video from */
    @property.string()
    url!: string;
    /** Material to apply the video texture to */
    @property.material({required: true})
    material!: Material;
    /** Whether to loop the video */
    @property.bool(true)
    loop!: boolean;
    /** Whether to automatically start playing the video */
    @property.bool(true)
    autoplay!: boolean;
    /** Whether to mute sound */
    @property.bool(true)
    muted!: boolean;
    /** Name of the texture property to set */
    @property.string('auto')
    textureProperty!: string;

    loaded = false;
    frameUpdateRequested = true;

    video?: HTMLVideoElement;
    texture?: Texture;

    start() {
        this.video = document.createElement('video');
        this.video.src = this.url;
        this.video.crossOrigin = 'anonymous';
        this.video.playsInline = true;
        this.video.loop = this.loop;
        this.video.muted = this.muted;
        this.video.addEventListener('playing', () => {
            this.loaded = true;
        });

        if (this.autoplay) {
            /* Muted videos are allowed to play immediately. Videos with sound
             * need to await a user gesture. */
            if (this.muted) {
                this.video?.play();
            } else {
                window.addEventListener('click', this.playAfterUserGesture);
                window.addEventListener('touchstart', this.playAfterUserGesture);
            }
        }
    }

    onDestroy() {
        this.video?.remove();
        this.texture?.destroy();

        if (this.autoplay && !this.muted) {
            /* In case not removed yet, we remove the autoplay gestures here.
             * If already removed, these have no effect. */
            window.removeEventListener('click', this.playAfterUserGesture);
            window.removeEventListener('touchstart', this.playAfterUserGesture);
        }
    }

    applyTexture() {
        const mat = this.material;
        const pipeline = mat.pipeline;
        const texture = (this.texture = this.engine.textures.create(this.video!));

        if (!setFirstMaterialTexture(mat, texture, this.textureProperty)) {
            console.error('Pipeline', pipeline, 'not supported by video-texture');
        }

        if ('requestVideoFrameCallback' in this.video!) {
            this.video.requestVideoFrameCallback(this.updateVideo.bind(this));
        } else {
            this.video!.addEventListener('timeupdate', () => {
                this.frameUpdateRequested = true;
            });
        }
    }

    update(dt: number) {
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
        this.video!.requestVideoFrameCallback(this.updateVideo.bind(this));
    }

    playAfterUserGesture = () => {
        this.video?.play();

        window.removeEventListener('click', this.playAfterUserGesture);
        window.removeEventListener('touchstart', this.playAfterUserGesture);
    };
}
