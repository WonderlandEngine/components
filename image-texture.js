import {Component, Property} from '@wonderlandengine/api';
import {setFirstMaterialTexture} from './utils/utils.js';

/**
 * Downloads an image from URL and applies it as `diffuseTexture` or `flatTexture`
 * to an attached mesh component.
 *
 * Materials from the following shaders are supported:
 *  - "Phong Opaque Textured"
 *  - "Flat Opaque Textured"
 *  - "Background"
 *  - "Physical Opaque Textured"
 *  - "Foliage"
 */
export class ImageTexture extends Component {
    static TypeName = 'image-texture';
    static Properties = {
        /** URL to download the image from */
        url: Property.string(),
        /** Material to apply the video texture to */
        material: Property.material(),
        /** Name of the texture property to set */
        textureProperty: Property.string('auto'),
    };

    start() {
        if (!this.material) {
            throw Error('image-texture: material property not set');
        }

        this.engine.textures
            .load(this.url, 'anonymous')
            .then((texture) => {
                const mat = this.material;
                if (!setFirstMaterialTexture(mat, texture, this.textureProperty)) {
                    console.error('Shader', mat.shader, 'not supported by image-texture');
                }
            })
            .catch(console.err);
    }
}
