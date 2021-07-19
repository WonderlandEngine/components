/**
 * Click/hover/move/button target for [cursor](#cursor).
 *
 * To trigger code when clicking, hovering, unhovering, moving cursor, pressing
 * cursor button or releasing cursor button, use `.addClickFunction(f)`,
 * `.addHoverFunction(f)`, `.addUnHoverFunction(f)`,
 * `.addCursorMoveFunction(f)`, `.addCursorDownFunction(f)` and
 * `.addCursorUpFunction(f)` respectively with any `function f() {}`.
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
 *
 * addCursorMoveFunction(callback);
 * removeCursorMoveFunction(callback);
 *
 * addCursorDownFunction(callback);
 * removeCursorDownFunction(callback);
 *
 * addCursorUpFunction(callback);
 * removeCursorUpFunction(callback);
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
      this.moveFunctions = [];
      this.cursorDownFunctions = [];
      this.cursorUpFunctions = [];
    },
    onHover: function(object, cursor) {
        for(let f of this.hoverFunctions) f(object, cursor);
    },
    onUnhover: function(object, cursor) {
        for(let f of this.unHoverFunctions) f(object, cursor);
    },
    onClick: function(object, cursor) {
        for(let f of this.clickFunctions) f(object, cursor);
    },
    onMove: function(object, cursor) {
        for(let f of this.moveFunctions) f(object, cursor);
    },
    onCursorDown: function(object, cursor) {
        for(let i in this.cursorDownFunctions) {
            this.cursorDownFunctions[i](object, cursor);
        }
    },
    onCursorUp: function(object, cursor) {
        for(let i in this.cursorUpFunctions) {
            this.cursorUpFunctions[i](object, cursor);
        }
    },
    addHoverFunction: function(f) {
        this._validateCallback(f);
        this.hoverFunctions.push(f);
    },
    removeHoverFunction: function(f) {
        this._validateCallback(f);
        this._removeItemOnce(this.hoverFunctions, f);
    },
    addUnHoverFunction: function(f) {
        this._validateCallback(f);
        this.unHoverFunctions.push(f);
    },
    removeUnHoverFunction: function(f) {
        this._validateCallback(f);
        this._removeItemOnce(this.unHoverFunctions, f);
    },
    addClickFunction: function(f) {
        this._validateCallback(f);
        this.clickFunctions.push(f);
    },
    removeClickFunction: function(f) {
        this._validateCallback(f);
        this._removeItemOnce(this.clickFunctions, f);
    },
    addMoveFunction: function(f) {
        this._validateCallback(f);
        this.moveFunctions.push(f);
    },
    removeMoveFunction: function(f) {
        this._validateCallback(f);
        this._removeItemOnce(this.moveFunctions, f);
    },
    addCursorDownFunction: function(f) {
        this._validateCallback(f);
        this.cursorDownFunctions.push(f);
    },
    removeCursorDownFunction: function(f) {
        this._validateCallback(f);
        this._removeItemOnce(this.cursorDownFunctions, f);
    },
    addCursorUpFunction: function(f) {
        this._validateCallback(f);
        this.cursorUpFunctions.push(f);
    },
    removeCursorUpFunction: function(f) {
        this._validateCallback(f);
        this._removeItemOnce(this.cursorUpFunctions, f);
    },

    _removeItemOnce: function(arr, value) {
        var index = arr.indexOf(value);
        if(index > -1) arr.splice(index, 1);
        return arr;
    },
    _validateCallback: function(f) {
        if(typeof f !== "function") {
            throw new TypeError(this.object.name
                + ".cursor-target: Argument needs to be a function");
        }
    },
});

