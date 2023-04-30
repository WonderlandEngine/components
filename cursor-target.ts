import {Component, Object3D, Emitter} from '@wonderlandengine/api';
import {Cursor, EventTypes} from './cursor.js';

/**
 * Click/hover/move/button target for [cursor](#cursor).
 *
 * To trigger code when clicking, hovering, unhovering, moving cursor, pressing
 * cursor button, releasing cursor button or scrolling, use `.onClick.add(f)`,
 * `.onHover.add(f)`, `.onUnHover.add(f)`, `.onMove.add(f)`, `.onDown.add(f)`,
 * `.onUp.add(f)` and `.onScroll.add(f)` respectively with any
 * `function f() {}`.
 *
 * To call members on a different component, you can set up a cursor target like
 * so:
 *
 * ```js
 * start: function() {
 *   let target = this.object.addComponent('cursor-target');
 *   target.onClick.add(this.onClick.bind(this));
 * },
 * onClick: function() {
 *   console.log(this.object.name, "was clicked!");
 * }
 * ```
 * **Functions:**
 *
 * ```js
 * const target = this.object.getComponent(CursorTarget);
 * const callback = function(object, cursorComponent) {};
 *
 * target.onHover.add(callback);
 * target.onHover.remove(callback);
 *
 * target.onUnHover.add(callback);
 * target.onUnHover.remove(callback);
 *
 * target.onClick.add(callback);
 * target.onClick.remove(callback);
 *
 * target.onMove.add(callback);
 * target.onMove.remove(callback);
 *
 * target.onDown.add(callback);
 * target.onDown.remove(callback);
 *
 * target.onUp.add(callback);
 * target.onUp.remove(callback);
 *
 * target.onScroll.add(callback);
 * target.onScroll.remove(callback);
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

    /** Emitter for events when the target is hovered */
    onHover = new Emitter<[Object3D, Cursor, EventTypes?]>();
    /** Emitter for events when the target is unhovered */
    onUnhover = new Emitter<[Object3D, Cursor, EventTypes?]>();
    /** Emitter for events when the target is clicked */
    onClick = new Emitter<[Object3D, Cursor, EventTypes?]>();
    /** Emitter for events when the cursor moves on the target */
    onMove = new Emitter<[Object3D, Cursor, EventTypes?]>();
    /** Emitter for events when the user pressed the select button on the target */
    onDown = new Emitter<[Object3D, Cursor, EventTypes?]>();
    /** Emitter for events when the user unpressed the select button on the target */
    onUp = new Emitter<[Object3D, Cursor, EventTypes?]>();
    /** Emitter for events when the user scrolls on the target */
    onScroll = new Emitter<[Object3D, Cursor, EventTypes?]>();

    /**
     * @deprecated Use the emitter instead.
     *
     * @example
     *    this.onHover.add(f);
     */
    addHoverFunction(f: (object?: Object3D, cursor?: Cursor) => void) {
        this.onHover.add(f);
    }

    /**
     * @deprecated Use the emitter instead.
     *
     * @example
     *    this.onHover.remove(f);
     */
    removeHoverFunction(f: (object?: Object3D, cursor?: Cursor) => void) {
        this.onHover.remove(f);
    }

    /**
     * @deprecated Use the emitter instead.
     *
     * @example
     *    this.onUnhover.add(f);
     */
    addUnHoverFunction(f: (object?: Object3D, cursor?: Cursor) => void) {
        this.onUnhover.add(f);
    }

    /**
     * @deprecated Use the emitter instead.
     *
     * @example
     *    this.onUnhover.remove(f);
     */
    removeUnHoverFunction(f: (object?: Object3D, cursor?: Cursor) => void) {
        this.onUnhover.remove(f);
    }

    /**
     * @deprecated Use the emitter instead.
     *
     * @example
     *    this.onClick.add(f);
     */
    addClickFunction(f: (object?: Object3D, cursor?: Cursor) => void) {
        this.onClick.add(f);
    }

    /**
     * @deprecated Use the emitter instead.
     *
     * @example
     *    component.onClick.remove(f);
     */
    removeClickFunction(f: (object?: Object3D, cursor?: Cursor) => void) {
        this.onClick.remove(f);
    }

    /**
     * @deprecated Use the emitter instead.
     *
     * @example
     *    component.onMove.add(f);
     */
    addMoveFunction(f: (object?: Object3D, cursor?: Cursor) => void) {
        this.onMove.add(f);
    }

    /**
     * @deprecated Use the emitter instead.
     *
     * @example
     *    component.onMove.remove(f);
     */
    removeMoveFunction(f: (object?: Object3D, cursor?: Cursor) => void) {
        this.onMove.remove(f);
    }

    /**
     * @deprecated Use the emitter instead.
     *
     * @example
     *    component.onDown.add(f);
     */
    addDownFunction(f: (object?: Object3D, cursor?: Cursor) => void) {
        this.onDown.add(f);
    }

    /**
     * @deprecated Use the emitter instead.
     *
     * @example
     *    component.onDown.remove(f);
     */
    removeDownFunction(f: (object?: Object3D, cursor?: Cursor) => void) {
        this.onDown.remove(f);
    }

    /**
     * @deprecated Use the emitter instead.
     *
     * @example
     *    component.onUp.add(f);
     */
    addUpFunction(f: (object?: Object3D, cursor?: Cursor) => void) {
        this.onUp.add(f);
    }

    /**
     * @deprecated Use the emitter instead.
     *
     * @example
     *    component.onUp.remove(f);
     */
    removeUpFunction(f: (object?: Object3D, cursor?: Cursor) => void) {
        this.onUp.remove(f);
    }
}
