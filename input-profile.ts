import {Component, Object3D, Emitter} from '@wonderlandengine/api';
import {HandTracking} from './hand-tracking.js';
import {vec3, quat} from 'gl-matrix';
import {property} from '@wonderlandengine/api/decorators.js';
import {VrModeActiveSwitch} from './vr-mode-active-switch.js';

const _tempVec = vec3.create();
const _tempQuat = quat.create();
const _tempRotation1 = new Float32Array(4);
const _tempRotation2 = new Float32Array(4);
const minTemp = new Float32Array(3);
const maxTemp = new Float32Array(3);
const hands = ['left', 'right'];

interface VisualResponse {
    target: Object3D;
    min: Object3D;
    max: Object3D;
    id: number;
}

/**
 * Dynamically load and map input profiles for XR controllers
 * @extends {Component}
 */

export class InputProfile extends Component {
    static TypeName = 'input-profile';
    /**
     * A cache to store loaded profiles for reuse.
     * @type {Map<string, any>}
     */
    static Cache: Map<string, any> = new Map();
    private _gamepadObjects: Record<string, Object3D> = {};
    private _controllerModel: Object3D | null = null;
    private _defaultControllerComponents: Component[] | undefined;
    private _handedness!: string;
    private _profileJSON: any = null;
    private _buttons: VisualResponse[] = [];
    private _axes: VisualResponse[] = [];

    /**
     * The XR gamepad associated with the current input source.
     */
    gamepad: Gamepad | undefined;
    /**
     * A Reference to the emitter which triggered on model lodaed event
     * @type {Emitter}
     */
    onModelLoaded: Emitter = new Emitter();

    /** returns url of input profile json file
     *  @type {string}
     */
    url!: string;

    /**
     * A set of components to filter during component retrieval.
     * @type {Set<string>}
     */
    toFilter: Set<string> = new Set(['vr-mode-active-mode-switch']);

    @property.object()
    defaultController!: Object3D;

    @property.enum(hands, 0)
    handednessIndex: number = 0;

    @property.string(
        'https://cdn.jsdelivr.net/npm/@webxr-input-profiles/assets@latest/dist/profiles/'
    )
    path!: string;

    @property.string()
    customProfileFolder!: string;

    @property.bool(false)
    mapToDefaultController!: boolean;

    @property.object()
    trackedHand!: Object3D;

    @property.bool(true)
    addVrModeSwitch!: boolean;

    start() {
        this._controllerModel = null;
        this.toFilter = new Set(['vr-mode-active-mode-switch']);
        this._defaultControllerComponents = this._getComponents(this.defaultController);
        this._handedness = hands[this.handednessIndex];

        this.engine.onXRSessionStart.add(() => {
            this.engine.xr?.session.addEventListener(
                'inputsourceschange',
                this._onInputSourcesChange.bind(this)
            );
        });
    }

    /**
     * Cleans up resources when the component is deactivated.
     */
    onDeactivate() {
        this.engine.xr?.session?.removeEventListener(
            'inputsourceschange',
            this._onInputSourcesChange.bind(this)
        );
    }

    /**
     * Sets newly loaded controllers for the Hand tracking component to proper switching.
     * @extends HandTracking
     * @param {Object3D} controllerObject - The controller object.
     * @hidden
     */

    private _setHandTrackingControllers(controllerObject: Object3D) {
        const handtrackingComponent = this.trackedHand.getComponent(HandTracking);
        if (!handtrackingComponent) return;
        /** @todo: Remove any when hand tracking is typed. */
        (handtrackingComponent as any).controllerToDeactivate = controllerObject;
    }

    /**
     * Retrieves all components from the specified object and its children.
     * @param {Object3D} obj - The object to retrieve components from.
     * @return {Component[]} An array of components.
     * @hidden
     */
    private _getComponents(obj: Object3D) {
        if (obj == null) return;
        const components: Component[] = [];
        const stack = [obj];
        while (stack.length > 0) {
            const currentObj = stack.pop();
            const comps = currentObj
                .getComponents()
                .filter((c: Component) => !this.toFilter.has(c.type));
            components.push(...comps);
            const children = currentObj.children || [];
            // Push children onto the stack in reverse order to maintain the correct order
            for (let i = children.length - 1; i >= 0; --i) {
                stack.push(children[i]);
            }
        }
        return components;
    }

    /**
     * Activates or deactivates components based on the specified boolean value.
     * @param {boolean} active - If true, components are set to active; otherwise, they are set to inactive.
     * @hidden
     */
    private _setComponentsActive(active: boolean) {
        const comps = this._defaultControllerComponents;
        if (comps == undefined) return;
        for (let i = 0; i < comps.length; ++i) {
            comps[i].active = active;
        }
    }

    /**
     * Event handler triggered when XR input sources change.
     * Detects new XR input sources and initiates the loading of input profiles.
     * @param {XRInputSourceChangeEvent} event - The XR input source change event.
     * @hidden
     */
    private _onInputSourcesChange(event: XRInputSourceChangeEvent) {
        if (this._isModelLoaded() && !this.mapToDefaultController) {
            this._setComponentsActive(false);
        }

        event.added.forEach((xrInputSource: XRInputSource) => {
            if (xrInputSource.hand != null) return;
            if (this._handedness != xrInputSource.handedness) return;

            this.gamepad = xrInputSource.gamepad;
            const profile =
                this.customProfileFolder !== ''
                    ? this.customProfileFolder
                    : this.path + xrInputSource.profiles[0];
            this.url = profile + '/profile.json';

            this._profileJSON = InputProfile.Cache.has(this.url)
                ? InputProfile.Cache.get(this.url)
                : null;

            if (this._profileJSON != null) return;
            fetch(this.url)
                .then((res) => res.json())
                .then((out) => {
                    this._profileJSON = out;
                    InputProfile.Cache.set(this.url, this._profileJSON);

                    if (!this._isModelLoaded()) this._loadAndMapGamepad(profile);
                })
                .catch((e) => {
                    console.error('failed to load profile from' + this.url);
                    console.error(e);
                });
        });
    }

    /**
     * Checks if the 3D controller model is already loaded.
     * @return {boolean} True if the model is loaded; otherwise, false.
     * @hidden
     */
    private _isModelLoaded() {
        return this._controllerModel !== null;
    }

    /**
     * Loads the 3D controller model and maps the visaulResponses to gamepad.
     * @param {string} profile - The path to the input profile.
     * @hidden
     */
    private async _loadAndMapGamepad(profile: string) {
        const assetPath = profile + '/' + this._handedness + '.glb';
        this._controllerModel = this.defaultController;
        if (!this.mapToDefaultController) {
            /** load 3d model in the runtime with profile url */
            try {
                this._controllerModel = (await this.engine.scene.append(
                    assetPath
                )) as Object3D;
            } catch (e) {
                console.error('failed to load 3d model');
                console.error(e);
                this._setComponentsActive(true);
                console.log(
                    'Couldnot load i-p controllers, continuing with ' +
                        this._handedness +
                        ' default controller'
                );
                console.error(e);
            }
            this._controllerModel.parent = this.object;
            this._controllerModel.setPositionLocal([0, 0, 0]);
            this._setComponentsActive(false);

            if (this.addVrModeSwitch)
                this._controllerModel.addComponent(VrModeActiveSwitch);
            this.onModelLoaded.notify();
        }
        this._cacheGamepadObjectsFromProfile(this._profileJSON, this._controllerModel);
        this._setHandTrackingControllers(this.defaultController);
        this.update = () => this._mapGamepadInput();
    }

    /**
     * Caches gamepad objects (buttons, axes) from the loaded input profile.
     * @param {Object} profile - The loaded input profile.
     * @param {Object3D} obj - The 3D controller model.
     * @hidden
     */
    private _cacheGamepadObjectsFromProfile(profile: any, obj: Object3D) {
        const components = profile.layouts[this._handedness].components;
        if (!components) return;

        this._buttons = [];
        this._axes = [];

        for (const i in components) {
            const visualResponses = components[i].visualResponses;

            for (const j in visualResponses) {
                // update buttons with new interface of current visual response
                const visualResponse = visualResponses[j];
                const valueNode = visualResponse.valueNodeName;
                const minNode = visualResponse.minNodeName;
                const maxNode = visualResponse.maxNodeName;

                this._gamepadObjects[valueNode] = this._getObjectByName(obj, valueNode);
                this._gamepadObjects[minNode] = this._getObjectByName(obj, minNode);
                this._gamepadObjects[maxNode] = this._getObjectByName(obj, maxNode);

                let indice = visualResponses[j].componentProperty;
                const response: VisualResponse = {
                    target: this._gamepadObjects[valueNode],
                    min: this._gamepadObjects[minNode],
                    max: this._gamepadObjects[maxNode],
                    id: components[i].gamepadIndices[indice], // Assign a unique ID
                };
                switch (indice) {
                    case 'button':
                        this._buttons.push(response);
                        break;
                    case 'xAxis':
                        this._axes.push(response);
                        break;
                    case 'yAxis':
                        this._axes.push(response);
                        break;
                }
            }
        }
    }

    /**
     * Retrieves a game object from the specified object based on its name.
     * @param {Object3D} obj - The object to search for the specified name.
     * @param {string} name - The name of the object to retrieve.
     * @return {Object3D|undefined} The retrieved game object, or undefined if not found.
     * @hidden
     */
    private _getObjectByName(obj: Object3D, name: string) {
        if (!obj || !name) return;
        const found = obj.findByNameRecursive(name);
        if (found[0]) return found[0];
    }

    /**
     * Assigns a transformed position and rotation to the target based on minimum and maximum values and a normalized input value.
     * @param {Object3D} target - The target object to be transformed.
     * @param {Object3D} min - The minimum object providing transformation limits.
     * @param {Object3D} max - The maximum object providing transformation limits.
     * @param {number} value - The normalized input value.
     * @hidden
     */
    private _assignTransform(
        target: Object3D,
        min: Object3D,
        max: Object3D,
        value: number
    ) {
        vec3.lerp(
            _tempVec,
            min.getPositionWorld(minTemp),
            max.getPositionWorld(maxTemp),
            value
        );
        target.setPositionWorld(_tempVec);
        quat.lerp(
            _tempQuat,
            min.getRotationWorld(_tempRotation1),
            max.getRotationWorld(_tempRotation2),
            value
        );
        quat.normalize(_tempQuat, _tempQuat);
        target.setRotationWorld(_tempQuat);
    }

    /**
     * Maps input values (buttons, axes) to the 3D controller model.
     * @hidden
     */

    private _mapGamepadInput() {
        for (const button of this._buttons) {
            const buttonValue = this.gamepad!.buttons[button.id].value;
            this._assignTransform(button.target, button.min, button.max, buttonValue);
        }
        for (const axis of this._axes) {
            const axisValue = this.gamepad!.axes[axis.id];
            const normalizedAxisValue = (axisValue + 1) / 2;
            this._assignTransform(axis.target, axis.min, axis.max, normalizedAxisValue);
        }
    }
}
