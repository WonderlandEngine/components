/**
 * Downloads an image from URL and applies it as `diffuseTexture` or `flatTexture`
 * to an attached mesh component.
 * Only "Phong Opaque Textured" and "Flat Opaque Textured" materials are supported.
 *
 * **Warning:** This component will soon be changed to be consistent with
 *   [video-texture](#video-texture) and change a material rather than mesh.
 *   To keep backwards compatibility, please copy the source of this component
 *   into your project.
 */
WL.registerComponent('image-texture', {
    /** URL to download the image from */
    url: {type: WL.Type.String, default: ""},
    /** 0-based mesh component index on this object (e.g. 1 for "second mesh") */
    meshIndex: {type: WL.Type.Int, default: 0}
}, {
    init: function() {
        let obj = this.object;
        WL.textures.load(this.url, 'anonymous')
            .then(function(texture) {
                const mat = obj.getComponent("mesh", this.meshIndex).material;
                if(mat.shader == "Flat Opaque Textured") {
                    mat.flatTexture = texture;
                } else if(mat.shader == "Phong Opaque Textured") {
                    mat.diffuseTexture = texture;
                } else {
                    console.error("Shader", mat.shader, "not supported by image-texture");
                }
            }).catch(console.err);
    }
});
