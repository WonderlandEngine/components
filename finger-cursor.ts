import {CollisionComponent, Component, Object3D} from '@wonderlandengine/api';
import {CursorTarget} from './cursor-target.js';

/**
 * Enables interaction with cursor-targets through collision overlaps,
 * e.g. on the tip of a finger on a tracked hand.
 *
 * **Requirements:**
 *  - A collision component (usually a sphere with `0.05` radius) on the same object
 *
 * @since 0.8.5
 */
export class FingerCursor extends Component {
    static TypeName = 'finger-cursor';

    lastTarget?: CursorTarget | null = null;
    tip!: CollisionComponent;

    start() {
        const collisionComponent = this.object.getComponent(CollisionComponent);
        if (!collisionComponent) {
            throw new Error(
                `Finger-cursor component on object '${this.object.name}' requires a collision component to work properly.`
            );
        }
        this.tip = collisionComponent;
    }

    update() {
        const overlaps = this.tip.queryOverlaps();

        let overlapFound = null;
        for (let i = 0; i < overlaps.length; ++i) {
            const o = overlaps[i].object;
            const target = o.getComponent(CursorTarget);
            if (target) {
                if (!target.equals(this.lastTarget)) {
                    target.onHover.notify(o, this);
                    target.onClick.notify(o, this);
                }
                overlapFound = target;
                break;
            }
        }

        if (!overlapFound) {
            if (this.lastTarget)
                this.lastTarget.onUnhover.notify(this.lastTarget.object, this);
            this.lastTarget = null;
            return;
        } else {
            this.lastTarget = overlapFound;
        }
    }
}
