import {Component, Type} from '@wonderlandengine/api';
import {quat2} from 'gl-matrix';

/**
 * Prints some limited debug information about the object.
 *
 * Information consists of: This object's name, an object parameter's name,
 * the object's world translation, world transform and local transform.
 *
 * Mainly used by engine developers for debug purposes or as example code.
 */
export class DebugObject extends Component {
    static TypeName = 'debug-object';
    static Properties = {
        /** A second object to print the name of */
        obj: {type: Type.Object},
    };

    start() {}

    init() {
        let origin = [0, 0, 0];
        quat2.getTranslation(origin, this.object.transformWorld);
        console.log('Debug Object:', this.object.name);
        console.log('Other object:', this.obj.name);
        console.log('\ttranslation', origin);
        console.log('\ttransformWorld', this.object.transformWorld);
        console.log('\ttransformLocal', this.object.transformLocal);
    }

    update() {}
}
