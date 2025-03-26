import {Component, Object3D} from '@wonderlandengine/api';
import {property} from '@wonderlandengine/api/decorators.js';

const SCOPE_OPTIONS = ['this object', 'children only', 'this object & children'];
const ACTION_OPTIONS = ['activate', 'deactivate', 'toggle', 'keep'];

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
    @property.enum(ACTION_OPTIONS)
    ifInXR: number = 0;

    /** Action to perform when XR session ends */
    @property.enum(ACTION_OPTIONS)
    ifNotInXR: number = 1;

    /** Scope of elements to affect */
    @property.enum(SCOPE_OPTIONS)
    scope: number = 2;

    private components: Component[] = [];

    start() {
        this.components = [];
        this.collectComponents();

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
        const mode = this.scope;

        // Handle current object
        if (mode === 0 || mode === 2) {
            this.object
                .getComponents()
                .filter((c) => c.type !== XrActiveSwitch.TypeName)
                .forEach((c) => this.components.push(c));
        }

        // Handle children
        if (mode === 1 || mode === 2) {
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

    private applyAction(action: number) {
        for (const comp of this.components) {
            if (action === 0) {
                comp.active = true;
            } else if (action === 1) {
                comp.active = false;
            } else if (action === 2) {
                comp.active = !comp.active;
            }
        }
    }

    private onSessionStart = () => {
        this.applyAction(this.ifInXR);
    };

    private onSessionEnd = () => {
        this.applyAction(this.ifNotInXR);
    };
}
