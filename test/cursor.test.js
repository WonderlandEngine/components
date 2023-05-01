import {expect} from '@esm-bundle/chai';

import {init} from './setup.js';
import {Cursor} from '../dist/cursor.js';
import {CursorTarget} from '../dist/cursor-target.js';
import {CollisionComponent, Shape} from '@wonderlandengine/api';

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

        const o = WL.scene.addObject();
        o.name = 'o';
        const cursorObject = WL.scene.addObject();
        cursorObject.name = 'cursorObject';

        const cursor = o.addComponent(Cursor, {
            cursorObject,
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

        cursor.update();
        expect(cursor.hoveringObject?.name).to.be.equal(targetObject.name);

        expect(targetEvents).to.deep.equal(['onHover', 'onMove']);
        expect(globalEvents).to.deep.equal(['onHover', 'onMove']);
        clearEvents();

        /* Rotate slighly, staying on the target, should get move event */
        o.rotateAxisAngleDeg([0, 1, 0], 2);
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
        o.rotateAxisAngleDeg([0, 1, 0], 90);
        cursor.update();
        expect(cursor.hoveringObject?.name).to.be.equal(targetObject2.name);

        expect(targetEvents).to.deep.equal(['onUnhover']);
        expect(globalEvents).to.deep.equal(['onUnhover', 'onHover', 'onMove']);
        clearEvents();

        /* Rotate the cursor away. We should get unhover */
        o.rotateAxisAngleDeg([0, 1, 0], 90);
        cursor.update();
        expect(cursor.hoveringObject).to.be.null;

        expect(targetEvents).to.deep.equal([]);
        expect(globalEvents).to.deep.equal(['onUnhover']);
        clearEvents();
    });
});
