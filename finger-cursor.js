/**
 * Enables interaction with cursor-targets through collision overlaps,
 * e.g. on the tip of a finger on a tracked hand.
 *
 * **Requirements:**
 *  - A collision component (usually a sphere with `0.05` radius) on the same object
 */
WL.registerComponent('finger-cursor', {
}, {
    init: function() {
        this.lastTarget = null;
    },
    start: function() {
        this.tip = this.object.getComponent('collision');
    },
    update: function() {
        const overlaps = this.tip.queryOverlaps();

        let overlapFound = null;
        for(let i = 0; i < overlaps.length; ++i) {
            const o = overlaps[i].object;
            const target = o.getComponent('cursor-target');
            if(target) {
                if(!target.equals(this.lastTarget)) {
                    target.onHover(o, this);
                    target.onClick(o, this);
                }
                overlapFound = target;
                break;
            }
        }

        if(!overlapFound) {
            if(this.lastTarget) this.lastTarget.onUnhover(this.lastTarget.object, this);
            this.lastTarget = null;
            return;
        } else {
            this.lastTarget = overlapFound;
        }
    },
});
