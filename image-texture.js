import {Component, Type} from '@wonderlandengine/api';

/**
 * Downloads an image from URL and applies it as `diffuseTexture` or `flatTexture`
 * to an attached mesh component.
 * Only "Phong Opaque Textured" and "Flat Opaque Textured" materials are supported.
 *
 * **Warning:** This component will soon be changed to be consistent with
 *   [video-texture](#video-texture) and change a material rather than mesh.
 *   To make sure your code keeps working in future versions of the engine,
 *   please use `material` rather than `meshIndex`.
 */
export class ImageTexture extends Component {
    static TypeName = 'image-texture';
    static Properties = {
        /** URL to download the image from */
        url: {type: Type.String, default: ''},
        /** 0-based mesh component index on this object (e.g. 1 for "second mesh").
         * **Deprecated:** Please use `material` instead. */
        meshIndex: {type: Type.Int, default: 0},
        /** Material to apply the video texture to (if `null`, tries to apply to the mesh with `meshIndex`) */
        material: {type: Type.Material},
    };

    init() {
        if (!this.material) {
            console.warn(
                "image-texture: material property not set, please set 'material' instead of deprecated 'meshIndex'."
            );
            this.material = this.object.getComponent('mesh', this.meshIndex).material;
        }
    }
    start() {
        this.engine.textures
            .load(this.url, 'anonymous')
            .then((texture) => {
                if (this.material.shader == 'Flat Opaque Textured') {
                    this.material.flatTexture = texture;
                } else if (mat.shader == 'Phong Opaque Textured') {
                    this.material.diffuseTexture = texture;
                } else {
                    console.error(
                        'Shader',
                        this.material.shader,
                        'not supported by image-texture'
                    );
                }
            })
            .catch(console.err);
    }
}
