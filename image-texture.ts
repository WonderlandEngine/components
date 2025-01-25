import {Component, Material, Property} from '@wonderlandengine/api';
import {setFirstMaterialTexture} from './utils/utils.js';
import {property} from '@wonderlandengine/api/decorators.js';

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
    /** URL to download the image from */
    @property.string()
    url!: string;
    /** Material to apply the video texture to */
    @property.material({required: true})
    material!: Material;
    /** Name of the texture property to set */
    @property.string('auto')
    textureProperty!: string;

    start() {
        this.engine.textures
            .load(this.url, 'anonymous')
            .then((texture) => {
                const mat = this.material;
                if (!setFirstMaterialTexture(mat, texture, this.textureProperty)) {
                    console.error(
                        'Pipeline',
                        mat.pipeline,
                        'not supported by image-texture'
                    );
                }
            })
            .catch(console.error);
    }
}
