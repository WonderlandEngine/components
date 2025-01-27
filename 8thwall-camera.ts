import {Component, Type} from '@wonderlandengine/api';
import {property} from '@wonderlandengine/api/decorators.js';

/**
 * 8thwall camera component.
 * @deprecated Use the components in https://github.com/WonderlandEngine/wonderland-ar-tracking instead.
 */
export class ARCamera8thwall extends Component {
    static TypeName = '8thwall-camera';
    @property.bool(true)
    deprecated!: boolean;
}
