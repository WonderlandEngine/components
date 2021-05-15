/**
 * Click/hover target for [cursor](#cursor).
 *
 * To trigger code when clicking or hovering, use `.addHoverFunction(f)`,
 * `.addUnHoverFunction(f)` and `.addClickFunction(f)` with any `function f() {}`.
 *
 * To call members on a different component, you can set up a cursor target like
 * so:
 *
 * ```js
 * start: function() {
 *   let target = this.object.addComponent('cursor-target');
 *   target.addClickFunction(this.onClick.bind(this));
 * },
 * onClick: function() {
 *   console.log(this.object.name, "was clicked!");
 * }
 * ```
 * **Functions:**
 *
 * ```js
 * callback = function(object, cursorComponent) {};
 *
 * addHoverFunction(callback);
 * removeHoverFunction(callback);
 *
 * addUnHoverFunction(callback);
 * removeUnHoverFunction(callback);
 *
 * addClickFunction(callback);
 * removeClickFunction(callback);
 * ```
 *
 * **Requirements:**
 * - a `collision` component to be attached to the same object.
 *
 * See [Animation Example](/showcase/animation).
 */
WL.registerComponent("cursor-target", {
  }, {
    init: function () {
      this.hoverFunctions = [];
      this.unHoverFunctions = [];
      this.clickFunctions = [];
    },
    onHover: function(object, cursor) {
        for(let i in this.hoverFunctions) {
            this.hoverFunctions[i](object, cursor);
        }
    },
    onUnhover: function(object, cursor) {
        for(let i in this.unHoverFunctions) {
            this.unHoverFunctions[i](object, cursor);
        }
    },
    onClick: function(object, cursor) {
        for(let i in this.clickFunctions) {
            this.clickFunctions[i](object, cursor);
        }
    },
    addHoverFunction: function(f) {
        if(typeof f !== "function") {
            throw new TypeError(this.object.name
                + ".cursor-target: Argument needs to be a function");
        }
        this.hoverFunctions.push(f);
    },
    removeHoverFunction: function(f) {
        if(typeof f !== "function") {
            throw new TypeError(this.object.name
                + ".cursor-target: Argument needs to be a function");
        }
        this._removeItemOnce(this.hoverFunctions, f);
    },
    addUnHoverFunction: function(f) {
        if(typeof f !== "function") {
            throw new TypeError(this.object.name
                + ".cursor-target: Argument needs to be a function");
        }
        this.unHoverFunctions.push(f);
    },
    removeUnHoverFunction: function(f) {
        if(typeof f !== "function") {
            throw new TypeError(this.object.name
                + ".cursor-target: Argument needs to be a function");
        }
        this._removeItemOnce(this.unHoverFunctions, f);
    },
    addClickFunction: function(f) {
        if(typeof f !== "function") {
            throw new TypeError(this.object.name
                + ".cursor-target: Argument needs to be a function");
        }
        this.clickFunctions.push(f);
    },
    removeClickFunction: function(f) {
        if(typeof f !== "function") {
            throw new TypeError(this.object.name
                + ".cursor-target: Argument needs to be a function");
        }
        this._removeItemOnce(this.clickFunctions, f);
    },

    _removeItemOnce: function(arr, value) {
        var index = arr.indexOf(value);
        if(index > -1) arr.splice(index, 1);
        return arr;
    }
});

