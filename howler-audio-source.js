import {Howl} from 'howler';
/**
 * (Spatial) audio source based on [Howler.js](https://howlerjs.com/).
 *
 * Creates a Howler audio source, plays an audio file on it and updates
 * its position.
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
    this.origin = [0, 0, 0];
    if(this.spatial && this.autoplay) {
      this.object.getTranslationWorld(this.origin);
      this.audio.pos(this.origin[0], this.origin[1], this.origin[2]);
      this.play();
    }
  },

  update: function() {
    if(!this.spatial || !this.lastPlayedAudioId) return;
    this.object.getTranslationWorld(this.origin);
    this.audio.pos(this.origin[0], this.origin[1], this.origin[2], this.lastPlayedAudioId);
  },

  play: function() {
    if(this.lastPlayedAudioId) {
      this.audio.stop(this.lastPlayedAudioId);
    }
    this.lastPlayedAudioId = this.audio.play();
    if(this.spatial) {
      this.object.getTranslationWorld(this.origin);
      this.audio.pos(this.origin[0], this.origin[1], this.origin[2], this.lastPlayedAudioId);
    }
  },

  stop: function() {
    if(this.lastPlayedAudioId) {
      this.audio.stop(this.lastPlayedAudioId);
      this.lastPlayedAudioId = null;
    }
  }
});
