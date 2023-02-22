import {Component, Type} from '@wonderlandengine/api';

/**
 * Allows switching all other components on an object to active/inactive
 * depending on whether a VR/AR session is active.
 *
 * Useful for hiding controllers until the user enters VR for example.
 */
export class VrModeActiveSwitch extends Component {
    static TypeName = 'vr-mode-active-switch';
    static Properties = {
        /** When components should be active: In VR or when not in VR */
        activateComponents: {
            type: Type.Enum,
            values: ['in VR', 'in non-VR'],
            default: 'in VR',
        },
        /** Whether child object's components should be affected */
        affectChildren: {type: Type.Bool, default: true},
    };

    start() {
        this.components = [];
        this.getComponents(this.object);

        /* Initial activation/deactivation */
        this.onXRSessionEnd();

        this.engine.onXRSessionStart.push(this.onXRSessionStart.bind(this));
        this.engine.onXRSessionEnd.push(this.onXRSessionEnd.bind(this));
    }

    getComponents(obj) {
        const comps = obj.getComponents().filter((c) => c.type != 'vr-mode-active-switch');
        this.components = this.components.concat(comps);

        if (this.affectChildren) {
            let children = obj.children;
            for (let i = 0; i < children.length; ++i) {
                this.getComponents(children[i]);
            }
        }
    }

    setComponentsActive(active) {
        const comps = this.components;
        for (let i = 0; i < comps.length; ++i) {
            comps[i].active = active;
        }
    }

    onXRSessionStart() {
        if (!this.active) return;
        this.setComponentsActive(this.activateComponents == 0);
    }

    onXRSessionEnd() {
        if (!this.active) return;
        this.setComponentsActive(this.activateComponents != 0);
    }
}
