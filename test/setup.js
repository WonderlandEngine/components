import {loadRuntime} from '@wonderlandengine/api';

/**
 * Creates a new engine:
 *     - Load emscripten code + wasm
 *     - Wait until the engine is ready to be use
 *
 * For now, engines are stored globally in the page, you **must**
 * thus call this function before and test, in order to clean any
 * previous engine instance running and create a new one.
 */
export async function init({physx = false} = {}) {
    const canvas = document.createElement('canvas');
    canvas.id = 'canvas';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    document.body.append(canvas);

    const engine = await loadRuntime('deploy/WonderlandRuntime', {
        simd: false,
        threads: false,
        loader: true,
        physx,
        loadingScreen: 'deploy/WonderlandRuntime-LoadingScreen.bin',
        canvas: 'canvas',
    });
    window.WL = engine;
}

/**
 * Resets the runtime, i.e.,
 *     - Removes all loaded textures
 *     - Clears the scene
 *     - Clears component cache
 *
 * Should be called before running a test to prevent side effects.
 */
export function reset() {
    if (!WL) return;
    WL._reset();
}
