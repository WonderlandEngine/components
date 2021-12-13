/**
 * Click/hover/move/button target for [cursor](#cursor).
 *
 * To trigger code when clicking, hovering, unhovering, moving cursor, pressing
 * cursor button or releasing cursor button, use `.addClickFunction(f)`,
 * `.addHoverFunction(f)`, `.addUnHoverFunction(f)`,
 * `.addMoveFunction(f)`, `.addDownFunction(f)` and
 * `.addUpFunction(f)` respectively with any `function f() {}`.
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
 * addDoubleClickFunction(callback);
 * removeDoubleClickFunction(callback);
 *
 * addTripleClickFunction(callback);
 * removeTripleClickFunction(callback);
 *
 * addMoveFunction(callback);
 * removeMoveFunction(callback);
 *
 * addDownFunction(callback);
 * removeDownFunction(callback);
 *
 * addUpFunction(callback);
 * removeUpFunction(callback);
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
        this.doubleClickFunctions = [];
        this.tripleClickFunctions = [];
        this.moveFunctions = [];
        this.downFunctions = [];
        this.upFunctions = [];
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
    onDoubleClick: function (object, cursor) {
        for (let f of this.doubleClickFunctions) f(object, cursor);
    },
    onTripleClick: function (object, cursor) {
        for (let f of this.tripleClickFunctions) f(object, cursor);
    },
    onMove: function(object, cursor) {
        for(let f of this.moveFunctions) f(object, cursor);
    },
    onDown: function(object, cursor) {
        for(let f of this.downFunctions) f(object, cursor);
    },
    onUp: function(object, cursor) {
        for(let f of this.upFunctions) f(object, cursor);
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
    addDoubleClickFunction: function (f) {
        this._validateCallback(f);
        this.doubleClickFunctions.push(f);
    },
    removeDoubleClickFunction: function (f) {
        this._validateCallback(f);
        this._removeItemOnce(this.doubleClickFunctions, f);
    },
    addTripleClickFunction: function (f) {
        this._validateCallback(f);
        this.tripleClickFunctions.push(f);
    },
    removeTripleClickFunction: function (f) {
        this._validateCallback(f);
        this._removeItemOnce(this.tripleClickFunctions, f);
    },
    addMoveFunction: function(f) {
        this._validateCallback(f);
        this.moveFunctions.push(f);
    },
    removeMoveFunction: function(f) {
        this._validateCallback(f);
        this._removeItemOnce(this.moveFunctions, f);
    },
    addDownFunction: function(f) {
        this._validateCallback(f);
        this.downFunctions.push(f);
    },
    removeDownFunction: function(f) {
        this._validateCallback(f);
        this._removeItemOnce(this.downFunctions, f);
    },
    addUpFunction: function(f) {
        this._validateCallback(f);
        this.upFunctions.push(f);
    },
    removeUpFunction: function(f) {
        this._validateCallback(f);
        this._removeItemOnce(this.upFunctions, f);
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

