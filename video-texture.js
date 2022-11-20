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
WL.registerComponent('video-texture', {
    /** URL to download video from */
    url: {type: WL.Type.String, default: ""},
    /** Material to apply the video texture to */
    material: {type: WL.Type.Material},
    /** Whether to loop the video */
    loop: {type: WL.Type.Bool, default: true},
    /** Whether to automatically start playing the video */
    autoplay: {type: WL.Type.Bool, default: true},
    /** Whether to mute sound */
    muted: {type: WL.Type.Bool, default: true},
}, {
    init: function() {
        if(!this.material) {
            console.error("video-texture: material property not set");
            return;
        }
        this.loaded = false;
        this.frameUpdateRequested = true;
    },

    start: function() {
        this.video = document.createElement('video');
        this.video.src = this.url;
        this.video.crossOrigin = 'anonymous';
        this.video.loop = this.loop;
        this.video.muted = this.muted;
        this.video.addEventListener('playing', function() { this.loaded = true; }.bind(this));

        if(this.autoplay) {
            const playAfterUserGesture = () => {
                this.video.play();

                window.removeEventListener('click', playAfterUserGesture);
                window.removeEventListener('touchstart', playAfterUserGesture);
            };
            window.addEventListener('click', playAfterUserGesture);
            window.addEventListener('touchstart', playAfterUserGesture);
        }
    },

    click: function () {
    },

    applyTexture: function() {
        const mat = this.material;
        this.texture = new WL.Texture(this.video);
        if(mat.shader == "Flat Opaque Textured") {
            mat.flatTexture = this.texture;
        } else if(mat.shader == "Phong Opaque Textured") {
            mat.diffuseTexture = this.texture;
        } else {
            console.error("Shader", mat.shader, "not supported by video-texture");
        }

        if('requestVideoFrameCallback' in this.video) {
            this.video.requestVideoFrameCallback(this.updateVideo.bind(this));
        } else {
            this.video.addEventListener('timeupdate', function() { this.frameUpdateRequested = true; }.bind(this));
        }
    },

    update: function(dt) {
        if(this.loaded && this.frameUpdateRequested) {
            if(this.texture) {
                this.texture.update();
            } else {
                /* Apply texture on first frame update request */
                this.applyTexture();
            }
            this.frameUpdateRequested = false;
        }
    },

    updateVideo: function() {
        this.frameUpdateRequested = true;
        this.video.requestVideoFrameCallback(this.updateVideo.bind(this));
    }
});
