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
 * Dynamically load and map input profiles for XR controllers.
 */
export class InputProfile extends Component {
    static TypeName = 'input-profile';
    /**
     * A cache to store loaded profiles for reuse.
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
     * A reference to the emitter which triggered on model lodaed event.
     */
    onModelLoaded: Emitter = new Emitter();

    /**
     * Returns url of input profile json file
     */
    url!: string;

    /**
     * A set of components to filter during component retrieval.
     */
    toFilter: Set<string> = new Set(['vr-mode-active-mode-switch']);

    /**
     * The index representing the handedness of the controller (0 for left, 1 for right).
     */
    @property.enum(hands, 0)
    handedness: number = 0;

    /**
     * The base path where XR input profiles are stored.
     */
    @property.string(
        'https://cdn.jsdelivr.net/npm/@webxr-input-profiles/assets@latest/dist/profiles/'
    )
    defaultBasePath!: string;

    /**
     * An optional folder path for loading custom XR input profiles.
     */
    @property.string()
    customBasePath!: string;

    /**
     * The default 3D controller model used when a custom model fails to load.
     */
    @property.object()
    defaultController!: Object3D;

    /**
     * The object which has HandTracking component added to it.
     */
    @property.object()
    trackedHand!: Object3D;

    /**
     * If true, the input profile will be mapped to the default controller, and no dynamic 3D model of controller will be loaded.
     */
    @property.bool(false)
    mapToDefaultController!: boolean;

    /**
     * If true, adds a VR mode switch component to the loaded controller model.
     */
    @property.bool(true)
    addVrModeSwitch!: boolean;

    onActivate() {
        this._handedness = hands[this.handedness];
        const defaultHandName =
            'Hand' + this._handedness.charAt(0).toUpperCase() + this._handedness.slice(1);
        this.trackedHand =
            this.trackedHand ?? this.object.parent?.findByNameRecursive(defaultHandName)[0];
        this.defaultController = this.defaultController || this.object.children[0];
        this._defaultControllerComponents = this._getComponents(this.defaultController);

        this.engine.onXRSessionStart.add(() => {
            this.engine.xr?.session.addEventListener(
                'inputsourceschange',
                this._onInputSourcesChange.bind(this)
            );
        });
    }

    onDeactivate() {
        this.engine.xr?.session?.removeEventListener(
            'inputsourceschange',
            this._onInputSourcesChange.bind(this)
        );
    }

    /**
     * Sets newly loaded controllers for the HandTracking component to proper switching.
     * @param controllerObject The controller object.
     * @hidden
     */

    private _setHandTrackingControllers(controllerObject: Object3D) {
        const handtrackingComponent: HandTracking | null =
            this.trackedHand.getComponent(HandTracking);
        if (!handtrackingComponent) return;
        handtrackingComponent.controllerToDeactivate = controllerObject;
    }

    /**
     * Retrieves all components from the specified object and its children.
     * @param obj The object to retrieve components from.
     * @return An array of components.
     * @hidden
     */
    private _getComponents(obj: Object3D | null) {
        const components: Component[] = [];
        if (obj == null) return components;
        const stack: Object3D[] = [obj];
        while (stack.length > 0) {
            const currentObj = stack.pop()!;
            const comps = currentObj
                .getComponents()
                .filter((c: Component) => !this.toFilter.has(c.type));
            components.push(...comps);
            const children = currentObj.children;
            // Push children onto the stack in reverse order to maintain the correct order
            for (let i = children.length - 1; i >= 0; --i) {
                stack.push(children[i]);
            }
        }
        return components;
    }

    /**
     * Activates or deactivates components based on the specified boolean value.
     * @param active If true, components are set to active; otherwise, they are set to inactive.
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
     * @param event The XR input source change event.
     * @hidden
     */
    private _onInputSourcesChange(event: XRInputSourcesChangeEvent) {
        if (this._isModelLoaded() && !this.mapToDefaultController) {
            this._setComponentsActive(false);
        }

        event.added.forEach((xrInputSource: XRInputSource) => {
            if (xrInputSource.hand != null) return;
            if (this._handedness != xrInputSource.handedness) return;

            this.gamepad = xrInputSource.gamepad;
            const profile =
                this.customBasePath !== ''
                    ? this.customBasePath
                    : this.defaultBasePath + xrInputSource.profiles[0];
            this.url = profile + '/profile.json';

            this._profileJSON = InputProfile.Cache.get(this.url) ?? null;

            if (this._profileJSON != null) return;
            fetch(this.url)
                .then((res) => res.json())
                .then((out) => {
                    this._profileJSON = out;
                    InputProfile.Cache.set(this.url, this._profileJSON);

                    if (!this._isModelLoaded()) this._loadAndMapGamepad(profile);
                })
                .catch((e) => {
                    console.error(`Failed to load profile from ${this.url}. Reason:`, e);
                });
        });
    }

    /**
     * Checks if the 3D controller model is loaded.
     * @return True if the model is loaded; otherwise, false.
     * @hidden
     */
    private _isModelLoaded() {
        return this._controllerModel !== null;
    }

    /**
     * Loads the 3D controller model and caches the mapping to the gamepad.
     * @param profile The path to the input profile.
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
                console.error(
                    `Failed to load i-p controller model. Reason:`,
                    e,
                    `Continuing with ${this._handedness} default controller.`
                );
                this._setComponentsActive(true);
            }
            this._controllerModel.parent = this.object;
            this._controllerModel.setPositionLocal([0, 0, 0]);
            this._setComponentsActive(false);

            if (this.addVrModeSwitch)
                this._controllerModel.addComponent(VrModeActiveSwitch);
            this.onModelLoaded.notify();
        }
        this._cacheGamepadObjectsFromProfile(this._profileJSON, this._controllerModel);
        this._setHandTrackingControllers(this._controllerModel);
        this.update = () => this._mapGamepadInput();
    }

    /**
     * Caches gamepad objects (buttons, axes) from the loaded input profile.
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

                this._gamepadObjects[valueNode] = obj.findByNameRecursive(valueNode)[0];
                this._gamepadObjects[minNode] = obj.findByNameRecursive(minNode)[0];
                this._gamepadObjects[maxNode] = obj.findByNameRecursive(maxNode)[0];

                const indice = visualResponses[j].componentProperty;
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
                    case 'yAxis':
                        this._axes.push(response);
                        break;
                }
            }
        }
    }

    /**
     * Assigns a transformed position and rotation to the target based on minimum and maximum values and a normalized input value.
     * @param target The target object to be transformed.
     * @param min The minimum object providing transformation limits.
     * @param max The maximum object providing transformation limits.
     * @param value The normalized input value.
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
