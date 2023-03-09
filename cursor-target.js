import {Component} from '@wonderlandengine/api';

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
export class CursorTarget extends Component {
    static TypeName = 'cursor-target';
    static Properties = {};

    init() {
        this.hoverFunctions = [];
        this.unHoverFunctions = [];
        this.clickFunctions = [];
        this.moveFunctions = [];
        this.downFunctions = [];
        this.upFunctions = [];
    }

    onHover(object, cursor) {
        for (let f of this.hoverFunctions) f(object, cursor);
    }

    onUnhover(object, cursor) {
        for (let f of this.unHoverFunctions) f(object, cursor);
    }

    onClick(object, cursor) {
        for (let f of this.clickFunctions) f(object, cursor);
    }

    onMove(object, cursor) {
        for (let f of this.moveFunctions) f(object, cursor);
    }

    onDown(object, cursor) {
        for (let f of this.downFunctions) f(object, cursor);
    }

    onUp(object, cursor) {
        for (let f of this.upFunctions) f(object, cursor);
    }

    addHoverFunction(f) {
        this._validateCallback(f);
        this.hoverFunctions.push(f);
    }

    removeHoverFunction(f) {
        this._validateCallback(f);
        this._removeItemOnce(this.hoverFunctions, f);
    }

    addUnHoverFunction(f) {
        this._validateCallback(f);
        this.unHoverFunctions.push(f);
    }

    removeUnHoverFunction(f) {
        this._validateCallback(f);
        this._removeItemOnce(this.unHoverFunctions, f);
    }

    addClickFunction(f) {
        this._validateCallback(f);
        this.clickFunctions.push(f);
    }

    removeClickFunction(f) {
        this._validateCallback(f);
        this._removeItemOnce(this.clickFunctions, f);
    }

    addMoveFunction(f) {
        this._validateCallback(f);
        this.moveFunctions.push(f);
    }

    removeMoveFunction(f) {
        this._validateCallback(f);
        this._removeItemOnce(this.moveFunctions, f);
    }

    addDownFunction(f) {
        this._validateCallback(f);
        this.downFunctions.push(f);
    }

    removeDownFunction(f) {
        this._validateCallback(f);
        this._removeItemOnce(this.downFunctions, f);
    }

    addUpFunction(f) {
        this._validateCallback(f);
        this.upFunctions.push(f);
    }

    removeUpFunction(f) {
        this._validateCallback(f);
        this._removeItemOnce(this.upFunctions, f);
    }

    _removeItemOnce(arr, value) {
        var index = arr.indexOf(value);
        if (index > -1) arr.splice(index, 1);
        return arr;
    }

    _validateCallback(f) {
        if (typeof f !== 'function') {
            throw new TypeError(
                this.object.name + '.cursor-target: Argument needs to be a function'
            );
        }
    }
}
