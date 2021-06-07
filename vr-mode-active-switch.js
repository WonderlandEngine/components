/**
 * Allows switching all other components on an object to active/inactive
 * depending on whether a VR/AR session is active.
 *
 * Useful for hiding controllers until the user enters VR for example.
 */
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
        const comps = obj.getComponents().filter(c => c.type != "vr-mode-active-switch");
        this.components = this.components.concat(comps);

        if(this.affectChildren) {
            let children = obj.children;
            for(let i = 0; i < children.length; ++i) {
                this.getComponents(children[i]);
            }
        }
    },

    setComponentsActive: function(active) {
        const comps = this.components;
        for (let i = 0; i < comps.length; ++i) {
            comps[i].active = active;
        }
    },

    onXRSessionStart: function() {
        if(!this.active) return;
        this.setComponentsActive(this.activateComponents == 0);
    },

    onXRSessionEnd: function() {
        if(!this.active) return;
        this.setComponentsActive(this.activateComponents != 0);
    },
}
);
