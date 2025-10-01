import {Component, Object3D} from '@wonderlandengine/api';
import {property} from '@wonderlandengine/api/decorators.js';

/**
 * Scopes for selecting which components to affect.
 */
export enum Scope {
    ThisObject,
    Children,
    ThisObjectAndChildren,
}

// Mutable array of names for the enum UI
export const ScopeNames: string[] = [
    'this object',
    'children only',
    'this object & children',
];

/**
 * Actions to perform when entering/exiting XR.
 */
export enum Action {
    None,
    Activate,
    Deactivate,
    Toggle,
}

// Mutable array of names for the enum UI
export const ActionNames: string[] = ['none', 'activate', 'deactivate', 'toggle'];

/**
 * XR Active Switch Component for controlling component activation states
 * based on XR session status.
 *
 * This component allows toggling, activating, deactivating, or keeping the
 * current state of components when entering or exiting XR sessions.
 *
 * The scope of affected components can be limited to the current object,
 * its children, or both.
 *
 * Use this component to manage visibility, interactivity, or other properties
 * that depend on XR session states.
 *
 */
export class XrActiveSwitch extends Component {
    static TypeName = 'xr-active-switch';

    /** Action to perform when XR session starts */
    @property.enum(ActionNames)
    ifInXR!: Action;

    /** Action to perform when XR session ends */
    @property.enum(ActionNames)
    ifNotInXR!: Action;

    /** Scope of elements to affect */
    @property.enum(ScopeNames)
    scope!: Scope;

    private components: Component[] = [];

    start() {
        // Initial state setup
        this.applyAction(this.engine.xr?.session ? this.ifInXR : this.ifNotInXR);

        // Bind event handlers
        this.engine.onXRSessionStart.add(this.onSessionStart);
        this.engine.onXRSessionEnd.add(this.onSessionEnd);
    }

    onActivate() {
        this.engine.onXRSessionStart.add(this.onSessionStart);
        this.engine.onXRSessionEnd.add(this.onSessionEnd);
    }

    onDeactivate() {
        this.engine.onXRSessionStart.remove(this.onSessionStart);
        this.engine.onXRSessionEnd.remove(this.onSessionEnd);
    }

    private collectComponents() {
        this.components = [];
        const mode = this.scope;

        if (mode === Scope.ThisObject || mode === Scope.ThisObjectAndChildren) {
            this.object
                .getComponents()
                .filter((c) => c.type !== XrActiveSwitch.TypeName)
                .forEach((c) => this.components.push(c));
        }

        if (mode === Scope.Children || mode === Scope.ThisObjectAndChildren) {
            this.processChildren(this.object);
        }
    }

    private processChildren(obj: Object3D) {
        for (const child of obj.children) {
            child
                .getComponents()
                .filter((c) => c.type !== XrActiveSwitch.TypeName)
                .forEach((c) => this.components.push(c));
            this.processChildren(child); // Recurse through all descendants
        }
    }

    private applyAction(action: Action) {
        this.collectComponents();
        for (const comp of this.components) {
            switch (action) {
                case Action.Activate:
                    comp.active = true;
                    break;
                case Action.Deactivate:
                    comp.active = false;
                    break;
                case Action.Toggle:
                    comp.active = !comp.active;
                    break;
                case Action.None:
                default:
                    break;
            }
        }
    }

    private onSessionStart = () => this.applyAction(this.ifInXR);
    private onSessionEnd = () => this.applyAction(this.ifNotInXR);
}
