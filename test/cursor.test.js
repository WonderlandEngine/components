import {expect} from '@esm-bundle/chai';

import {init} from './setup.js';
import {Cursor} from '../dist/cursor.js';
import {CursorTarget} from '../dist/cursor-target.js';
import {CollisionComponent, Shape, ViewComponent} from '@wonderlandengine/api';

before(init);

before(() => {
    WL.registerComponent(Cursor);
    WL.registerComponent(CursorTarget);
});

describe('Cursor', function () {
    it('properties', function () {
        expect(Cursor.Properties).to.have.keys([
            'collisionGroup',
            'cursorRayObject',
            'cursorRayScalingAxis',
            'cursorObject',
            'handedness',
            'rayCastMode',
            'styleCursor',
            'useWebXRHitTest',
        ]);
    });

    it('hover and move', function () {
        WL.scene.reserveObjects(3, 5);

        const cursorObject = WL.scene.addObject();
        cursorObject.name = 'o';
        const cursorTargetObject = WL.scene.addObject();
        cursorTargetObject.name = 'cursorObject';

        const view = cursorObject.addComponent(ViewComponent);
        /* Update the projection matrix */
        view.near = 0.1;
        view.far = 100.0;
        Object.defineProperty(view, 'projectionMatrix', {
            get: () => {
                const f = 100.0;
                const n = 0.1;
                return [
                    1,
                    0,
                    0,
                    0,
                    0,
                    1,
                    0,
                    0,
                    0,
                    0,
                    -f / (f - n),
                    -1,
                    0,
                    0,
                    -(f * n) / (f - n),
                    0,
                ];
            },
        });

        const cursor = cursorObject.addComponent(Cursor, {
            cursorObject: cursorTargetObject,
            collisionGroup: 5,
            handedness: 'none',
        });

        const targetObject = WL.scene.addObject();
        targetObject.name = 'targetObject';
        targetObject.translate([0.0, 0.0, -2.5]);
        const target = targetObject.addComponent(CursorTarget);
        const collision = targetObject.addComponent(CollisionComponent, {
            group: 1 << 5,
            shape: Shape.Sphere,
            extents: [0.5, 0, 0],
        });
        expect(target).to.not.be.null;
        expect(collision).to.not.be.null;

        /* Add second object without cursor-target */
        const targetObject2 = WL.scene.addObject();
        targetObject2.name = 'targetObject2';
        targetObject2.translate([-2.5, 0.0, 0.0]);
        targetObject2.addComponent(CollisionComponent, {
            group: 1 << 5,
            shape: Shape.Sphere,
            extents: [0.5, 0, 0],
        });

        const createEventCallback = (events, name) => {
            return () => events.push(name);
        };

        const targetEvents = [];
        const globalEvents = [];
        const clearEvents = () => {
            targetEvents.length = 0;
            globalEvents.length = 0;
        };

        for (const event of [
            'onHover',
            'onUnhover',
            'onClick',
            'onMove',
            'onDown',
            'onUp',
        ]) {
            target[event].add(createEventCallback(targetEvents, event));
            cursor.globalTarget[event].add(createEventCallback(globalEvents, event));
        }

        const bounds = WL.canvas.getBoundingClientRect();
        const halfW = bounds.width / 2;
        const halfH = bounds.height / 2;
        cursor.onPointerMove({
            isPrimary: true,
            clientX: halfW,
            clientY: halfH,
        });

        cursor.update();
        expect(cursor.hoveringObject?.name).to.be.equal(targetObject.name);
        expect(targetEvents).to.deep.equal(['onHover', 'onMove']);
        expect(globalEvents).to.deep.equal(['onHover', 'onMove']);
        clearEvents();

        /* Move mouse pointer slightly */
        cursor.onPointerMove({
            isPrimary: true,
            clientX: halfW + 1,
            clientY: halfH,
        });
        /* Ensure update doesn't cause a duplicate event */
        cursor.update();

        expect(cursor.hoveringObject?.name).to.be.equal(targetObject.name);
        expect(targetEvents).to.deep.equal(['onMove']);
        expect(globalEvents).to.deep.equal(['onMove']);
        clearEvents();

        /* Rotate slighly, staying on the target, should get move event */
        cursorObject.rotateAxisAngleDegObject([0, 1, 0], 4);
        cursor.update();
        expect(cursor.hoveringObject?.name).to.be.equal(targetObject.name);

        expect(targetEvents).to.deep.equal(['onMove']);
        expect(globalEvents).to.deep.equal(['onMove']);
        clearEvents();

        /* Update without change, no events expected. */
        cursor.update();
        expect(cursor.hoveringObject?.name).to.be.equal(targetObject.name);
        expect(targetEvents).to.deep.equal([]);
        expect(globalEvents).to.deep.equal([]);

        /* Rotate the target, this should emit a move event */
        targetObject.rotateAxisAngleDeg([0, 1, 0], 2);
        cursor.update();
        expect(cursor.hoveringObject?.name).to.be.equal(targetObject.name);

        expect(targetEvents).to.deep.equal(['onMove']);
        expect(globalEvents).to.deep.equal(['onMove']);
        clearEvents();

        /* Rotate the cursor to other object. We should get unhover and global hover */
        cursorObject.rotateAxisAngleDeg([0, 1, 0], 90);
        cursor.update();
        expect(cursor.hoveringObject?.name).to.be.equal(targetObject2.name);

        expect(targetEvents).to.deep.equal(['onUnhover']);
        expect(globalEvents).to.deep.equal(['onUnhover', 'onHover', 'onMove']);
        clearEvents();

        /* Rotate the cursor away. We should get unhover */
        cursorObject.rotateAxisAngleDeg([0, 1, 0], 90);
        cursor.update();
        expect(cursor.hoveringObject).to.be.null;

        expect(targetEvents).to.deep.equal([]);
        expect(globalEvents).to.deep.equal(['onUnhover']);
        clearEvents();
    });
});
