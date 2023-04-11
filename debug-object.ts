import {Component, Object3D} from '@wonderlandengine/api';
import {property} from '@wonderlandengine/api/decorators.js';
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

    /** A second object to print the name of */
    @property.object()
    obj: Object3D | null = null;

    start() {
        let origin = new Float32Array(3);
        quat2.getTranslation(origin, this.object.transformWorld);
        console.log('Debug object:', this.object.name);
        console.log('Other object:', this.obj?.name);
        console.log('\ttranslation', origin);
        console.log('\ttransformWorld', this.object.transformWorld);
        console.log('\ttransformLocal', this.object.transformLocal);
    }
}
