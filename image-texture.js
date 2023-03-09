import {Component, Type} from '@wonderlandengine/api';

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
        url: {type: Type.String},
        /** Material to apply the video texture to */
        material: {type: Type.Material},
    };

    start() {
        if (!this.material) {
            throw Error('image-texture: material property not set');
        }

        this.engine.textures
            .load(this.url, 'anonymous')
            .then((texture) => {
                const mat = this.material
                const shader = mat.shader;
                if (shader === 'Flat Opaque Textured') {
                    mat.flatTexture = texture;
                } else if (shader === 'Phong Opaque Textured' || shader === 'Foliage') {
                    mat.diffuseTexture = texture;
                } else if (shader === 'Background') {
                    mat.texture = texture;
                } else if (shader === 'Physical Opaque Textured') {
                    mat.albedoTexture = texture;
                } else {
                    console.error('Shader', shader, 'not supported by image-texture');
                }
            })
            .catch(console.err);
    }
}
