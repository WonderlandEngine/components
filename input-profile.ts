import {Component, Object3D} from '@wonderlandengine/api';
import {HandTracking} from '@wonderlandengine/components';
import {vec3, quat} from 'gl-matrix';
import {property} from '@wonderlandengine/api/decorators.js';

const _TempVec = vec3.create();
const _TempQuat = quat.create();
const minTemp = new Float32Array(3);
const maxTemp = new Float32Array(3);
const hands = ['left', 'right'];

interface VisualResponse {
    target: Object3D;
    min: Object3D;
    max: Object3D;
    id: string;
}

export class InputProfile extends Component {
    static TypeName = 'input-profile';

    private _gamepadObjects: Record<string, any> = {};
    private controllerModel: any;
    private toFilter: Set<string> = new Set(['vr-mode-active-mode-switch']);
    private defaultControllerComponents?: Component[];
    private handedness!: string;
    private url!: string;
    private ProfileJSON: any = null;
    private modelLoaded!: boolean;
    private gamepad: any;

    _buttons: VisualResponse[] = []; /* Any button, **EVEN** thumbstick click */
    _axes: VisualResponse[] = [];

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

    init() {
        this._gamepadObjects = {};
    }

    start() {
        this.controllerModel = null;
        this.toFilter = new Set(['vr-mode-active-mode-switch']);
        this.defaultControllerComponents = this.getComponents(this.defaultController);
        this.handedness = hands[this.handednessIndex];

        if (this.engine.xr?.session != null) {
            this.engine.xr?.session.addEventListener(
                'inputsourceschange',
                this.onInputSourcesChange.bind(this)
            );
        } else {
            this.engine.onXRSessionStart.add(() => {
                this.engine.xr?.session.addEventListener(
                    'inputsourceschange',
                    this.onInputSourcesChange.bind(this)
                );
            });
        }
    }

    addToFilter(element: string) {
        this.toFilter.add(element);
    }

    removeFromFilter(element: string) {
        this.toFilter.delete(element);
    }

    onDeactivate() {
        if (this.engine.xr?.session != null) {
            this.engine.xr.session.removeEventListener(
                'inputsourceschange',
                this.onInputSourcesChange.bind(this)
            );
        } else {
            this.engine.onXRSessionStart.add(() => {
                this.engine.xr?.session.removeEventListener(
                    'inputsourceschange',
                    this.onInputSourcesChange.bind(this)
                );
            });
        }
    }

    setHandTrackingControllers(controllerObject: any) {
        const HandtrackingComponent = this.trackedHand.getComponent(HandTracking);
        if (!HandtrackingComponent) return;
        /**@ts-ignore**/
        HandtrackingComponent.controllerToDeactivate = controllerObject;
    }

    getComponents(obj: any) {
        if (obj == null) return;
        const components: Component[] = [];
        const stack = [obj];
        while (stack.length > 0) {
            const currentObj = stack.pop();
            const comps = currentObj
                .getComponents()
                .filter((c: any) => !this.toFilter.has(c.type));
            components.push(...comps);
            const children = currentObj.children || [];
            // Push children onto the stack in reverse order to maintain the correct order
            for (let i = children.length - 1; i >= 0; --i) {
                stack.push(children[i]);
            }
        }
        return components;
    }

    setComponentsActive(active: boolean) {
        const comps = this.defaultControllerComponents;
        if (!comps) return;
        for (let i = 0; i < comps.length; ++i) {
            comps[i].active = active;
        }
    }
    // Save data to cache
    saveToCache(key, data) {
        try {
            // Convert data to JSON string before storing
            const jsonString = JSON.stringify(data);

            // Save to local storage
            localStorage.setItem(key, jsonString);
        } catch (error) {
            console.error('Error saving to cache:', error);
        }
    }

    // Retrieve data from cache
    retrieveFromCache(key) {
        try {
            // Retrieve data from local storage
            const jsonString = localStorage.getItem(key);

            // Parse JSON string to get the original data
            const data = JSON.parse(jsonString);

            return data;
        } catch (error) {
            console.error('Error retrieving from cache:', error);
            return null;
        }
    }

    onInputSourcesChange(event: any) {
        if (this.modelLoaded && !this.mapToDefaultController) {
            this.setComponentsActive(false);
        }

        event.added.forEach((xrInputSource: any) => {
            if (xrInputSource.hand != null) return;
            if (this.handedness != xrInputSource.handedness) return;
            var profile = this.path + xrInputSource.profiles[0];
            if (this.customProfileFolder !== '') profile = this.customProfileFolder;
            this.url = profile + '/profile.json';
            this.ProfileJSON = this.retrieveFromCache(this.url);
            if (this.ProfileJSON != null) {
                console.log('Loaded Profile From Cache ');
                this.loadAndMapGamepad(profile, xrInputSource);
            } else {
                fetch(this.url)
                    .then((res) => res.json())
                    .then((out) => {
                        this.ProfileJSON = out;
                        console.log('Profile downloaded and loaded from ' + this.url);
                        this.saveToCache(this.url, out);
                        this.loadAndMapGamepad(profile, xrInputSource);
                    })
                    .catch((e) => {
                        console.error('failed to load profile from' + this.url);
                        console.error(e);
                    });
            }
        });
    }

    isModelLoaded() {
        return this.controllerModel !== null;
    }

    loadAndMapGamepad(profile: string, xrInputSource: any) {
        this.gamepad = xrInputSource.gamepad;

        const assetPath = profile + '/' + this.handedness + '.glb';
        if (this.modelLoaded) return;

        if (!this.mapToDefaultController) {
            /** load 3d model in the runtime with profile url */
            this.engine.scene
                .append(assetPath)
                .then((obj: any) => {
                    this.controllerModel = obj;
                    this.setComponentsActive(false);
                    console.log('Disabling ' + this.handedness + ' default Controller');
                    this.controllerModel.parent = this.object;
                    this.controllerModel.setTranslationLocal([0, 0, 0]);
                    this.getGamepadObjectsFromProfile(
                        this.ProfileJSON,
                        this.controllerModel
                    );
                    this.modelLoaded = this.isModelLoaded();
                    this.setHandTrackingControllers(this.controllerModel);
                    this.update = () => this.mapGamepadInput();
                    console.log(this.handedness + 'controller model loaded to the scene');
                })
                .catch((e) => {
                    console.error('failed to load 3d model');
                    console.error(e);
                    this.setComponentsActive(true);
                    console.log(
                        'Couldnot load i-p, continuing with ' +
                            this.handedness +
                            ' default controller'
                    );
                });
        } else {
            this.controllerModel = this.defaultController;
            this.getGamepadObjectsFromProfile(this.ProfileJSON, this.defaultController);
            this.modelLoaded = this.isModelLoaded();
            console.log('mapping i-p to ' + this.handedness + ' default controllers');
            this.update = () => this.mapGamepadInput();
            this.setHandTrackingControllers(this.defaultController);
        }
    }

    getGamepadObjectsFromProfile(profile: any, obj: any) {
        const components = profile.layouts[this.handedness].components;
        if (!components) return;

        for (const i in components) {
            const visualResponses = components[i].visualResponses;

            for (const j in visualResponses) {
                // update buttons with new interface of current visual response
                const visualResponse = visualResponses[j];
                const valueNode = visualResponse.valueNodeName;
                const minNode = visualResponse.minNodeName;
                const maxNode = visualResponse.maxNodeName;

                this.getGamepadObjectByName(obj, valueNode);
                this.getGamepadObjectByName(obj, minNode);
                this.getGamepadObjectByName(obj, maxNode);

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

    getGamepadObjectByName(obj: any, name: string) {
        if (!obj || !name) return;

        if (obj.name === name) this._gamepadObjects[name] = obj;

        const children = obj.children;
        for (let i = 0; i < children.length; ++i)
            this.getGamepadObjectByName(children[i], name);
    }

    assignTransform(target: any, min: any, max: any, value: number) {
        vec3.lerp(
            _TempVec,
            min.getPositionWorld(minTemp),
            max.getPositionWorld(maxTemp),
            value
        );
        target.setTranslationWorld(_TempVec);

        quat.lerp(_TempQuat, min.rotationWorld, max.rotationWorld, value);
        quat.normalize(_TempQuat, _TempQuat);
        target.setRotationWorld(_TempQuat);
    }

    mapGamepadInput() {
        for (const button of this._buttons) {
            const ButtonValue = this.gamepad.buttons[button.id].value;
            this.assignTransform(button.target, button.min, button.max, ButtonValue);
        }
        for (const axis of this._axes) {
            const AxisValue = this.gamepad.axes[axis.id] || 0;
            const normalizedAxisValue = (AxisValue + 1) / 2;
            this.assignTransform(axis.target, axis.min, axis.max, normalizedAxisValue);
        }
    }
}
