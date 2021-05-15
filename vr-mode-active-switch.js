/**
 * Allows switching all other components on an object to active/inactive
 * depending on whether a VR/AR session is active.
 *
 * Useful for hiding controllers until the user enters VR for example.
 *
 * **Warning**: This component currently can lead to unexpected behaviour.*/
WL.registerComponent("vr-mode-active-switch", {
    /** When components should be active: In VR or when not in VR */
    activateComponents: {type: WL.Type.Enum, values: ["in VR", "in non-VR"], default: "in VR"},
    /** Whether child object's components should be affected */
    affectChildren: {type: WL.Type.Bool, default: true},
}, {
    start: function() {
        this.components = [];
        this.getComponents(this.object);

        /* Initial activation/deactivation */
        this.onXRSessionEnd();

        WL.onXRSessionStart.push(this.onXRSessionStart.bind(this));
        WL.onXRSessionEnd.push(this.onXRSessionEnd.bind(this));
    },

    getComponents: function(obj) {
        this.components = this.components.concat(obj.getComponents());

        if(this.affectChildren) {
            let children = obj.children;
            for(let i = 0; i < children.length; ++i) {
                this.getComponents(children[i]);
            }
        }
    },

    setComponentsActive: function(active) {
        for (let i = 0; i < this.components.length; ++i) {
            this.components[i].active = active;
        }
    },

    onXRSessionStart: function() {
        this.setComponentsActive(this.activateComponents == 0);
    },

    onXRSessionEnd: function() {
        this.setComponentsActive(this.activateComponents != 0);
    },
}
);
