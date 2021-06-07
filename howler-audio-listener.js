import 'howler';
/**
 * (Spatial) audio listener based on [Howler.js](https://howlerjs.com/).
 *
 * Retrieves the location and orientation of the object and passes it
 * to [Howler.pos()](https://github.com/goldfire/howler.js#posx-y-z-id)
 * and [Howler.orientation()](https://github.com/goldfire/howler.js#orientationx-y-z-id).
 */
WL.registerComponent("howler-audio-listener", {
  /** Whether audio should be spatialized/positional. */
  spatial: {type: WL.Type.Bool, default: true},
}, {
  init: function() {
    this.origin = [0, 0, 0];
    this.fwd = [0, 0, 0];
    this.up = [0, 0, 0];
  },
  update: function() {
    if(this.spatial) {
      this.object.getTranslationWorld(this.origin);
      this.object.getForward(this.fwd);
      this.object.getUp(this.up);

      Howler.pos(this.origin[0], this.origin[1], this.origin[2]);
      Howler.orientation(this.fwd[0], this.fwd[1], this.fwd[2],
        this.up[0], this.up[1], this.up[2]);
    }
  },
});
