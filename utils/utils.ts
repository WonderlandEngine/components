import {Material, Texture} from '@wonderlandengine/api';

/**
 * Set the diffuse/flat texture of known pipelines.
 *
 * @param mat Material to set the texture on
 * @param texture Texture to set
 * @param customTextureProperty Texture property to set or `'auto'` to automatically
 *      detect the right texture property based on known pipeline.
 * @returns `true` if the property was set, `false` otherwise.
 */
export function setFirstMaterialTexture(
    mat: Material,
    texture: Texture,
    customTextureProperty: string
) {
    if (customTextureProperty !== 'auto') {
        // @ts-ignore
        mat[customTextureProperty] = texture;
        return true;
    }

    const shader = mat.shader;
    if (shader === 'Flat Opaque Textured') {
        // @ts-ignore
        mat.flatTexture = texture;
        return true;
    } else if (
        shader === 'Phong Opaque Textured' ||
        shader === 'Foliage' ||
        shader === 'Phong Normalmapped' ||
        shader === 'Phong Lightmapped'
    ) {
        // @ts-ignore
        mat.diffuseTexture = texture;
        return true;
    } else if (shader === 'Particle') {
        // @ts-ignore
        mat.mainTexture = texture;
        return true;
    } else if (shader === 'DistanceFieldVector') {
        // @ts-ignore
        mat.vectorTexture = texture;
        return true;
    } else if (shader === 'Background' || shader === 'Sky') {
        // @ts-ignore
        mat.texture = texture;
        return true;
    } else if (shader === 'Physical Opaque Textured') {
        // @ts-ignore
        mat.albedoTexture = texture;
        return true;
    }
    return false;
}
