import {Howl} from 'howler';
/**
 * (Spatial) audio source based on [Howler.js](https://howlerjs.com/).
 *
 * Creates a Howler audio source, plays an audio file on it and updates
 * its position.
 *
 * Optimizes the position update to only update if the difference to last
 * position is larger than half a centimeter. To force updates (e.g. if
 * the sound source is _very_ close to the listener),
 * use `.updatePosition()`.
 */
WL.registerComponent("howler-audio-source", {
  /** Volume */
  volume: {type: WL.Type.Float, default: 1.0},
  /** Whether audio should be spatialized/positional */
  spatial: {type: WL.Type.Bool, default: true},
  /** Whether to loop the sound */
  loop: {type: WL.Type.Bool, default: false},
  /** Whether to start playing automatically */
  autoplay: {type: WL.Type.Bool, default: false},
  /** URL to a sound file to play */
  src: {type: WL.Type.String, default: ""}
}, {
  start: function() {
    this.audio = new Howl({
      src: [this.src],
      loop: this.loop,
      volume: this.volume,
      autoplay: this.autoplay
    });

    this.lastPlayedAudioId = null;
    this.origin = new Float32Array(3);
    this.lastOrigin = new Float32Array(3);

    if(this.spatial && this.autoplay) {
      this.updatePosition();
      this.play();
    }

    /* Stop sound after switching scenes */
    const callback = () => {
        this.stop();
        const idx = WL.onSceneLoaded.indexOf(callback);
        if(idx >= 0) WL.onSceneLoaded.splice(idx, 1);
    };
    WL.onSceneLoaded.push(callback);
  },

  update: function() {
    if(!this.spatial || !this.lastPlayedAudioId) return;

    this.object.getTranslationWorld(this.origin);
    /* Only call pos() if the position moved more than half a centimeter
     * otherwise this gets very performance heavy.
     * Smaller movement should only be perceivable if close to the
     * ear anyway. */
    if(Math.abs(this.lastOrigin[0] - this.origin[0]) > 0.005 ||
       Math.abs(this.lastOrigin[1] - this.origin[1]) > 0.005 ||
       Math.abs(this.lastOrigin[2] - this.origin[2]) > 0.005)
    {
      this.updatePosition();
    }
  },

  updatePosition: function() {
      this.audio.pos(this.origin[0], this.origin[1], this.origin[2],
        this.lastPlayedAudioId);
      this.lastOrigin.set(this.origin);
  },

  play: function() {
    if(this.lastPlayedAudioId) this.audio.stop(this.lastPlayedAudioId);
    this.lastPlayedAudioId = this.audio.play();
    if(this.spatial) this.updatePosition();
  },

  stop: function() {
    if(!this.lastPlayedAudioId) return;
    this.audio.stop(this.lastPlayedAudioId);
    this.lastPlayedAudioId = null;
  }
});
