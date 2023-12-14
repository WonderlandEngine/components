import {Component, Object3D, Emitter} from '@wonderlandengine/api';
import {HandTracking} from './hand-tracking.js';
import {vec3, quat} from 'gl-matrix';
import {property} from '@wonderlandengine/api/decorators.js';

const _TempVec = vec3.create();
const _TempQuat = quat.create();
const _TempRotation1 = new Float32Array(4);
const _TempRotation2 = new Float32Array(4);
const minTemp = new Float32Array(3);
const maxTemp = new Float32Array(3);
const hands = ['left', 'right'];

interface VisualResponse {
    target: Object3D;
    min: Object3D;
    max: Object3D;
    id: number;
}

export class InputProfile extends Component {
    static TypeName = 'input-profile';
    static Cache: Map<string, any> = new Map();
    private _gamepadObjects: Record<string, Object3D> = {};
    private _controllerModel: Object3D | null = null;
    private _defaultControllerComponents: Component[] | undefined;
    private _handedness!: string;
    private _profileJSON: any = null;
    private _gamepad: Gamepad | undefined;
    private _buttons: VisualResponse[] = [];
    private _axes: VisualResponse[] = [];
    private _urlEmitter: Emitter = new Emitter();

    private notifyUrlReady() {
        this._urlEmitter.notify();
    }

    onUrlReady(callback: () => void) {
        this._urlEmitter.add(callback);
    }

    url!: string;
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

    start() {
        this._controllerModel = null;
        this.toFilter = new Set(['vr-mode-active-mode-switch']);
        this._defaultControllerComponents = this.getComponents(this.defaultController);
        this._handedness = hands[this.handednessIndex];

        this.engine.onXRSessionStart.add(() => {
            console.warn('adding event listener for inputChange');
            this.engine.xr?.session.addEventListener(
                'inputsourceschange',
                this.onInputSourcesChange.bind(this)
            );
        });
    }

    onDeactivate() {
        this.engine.xr?.session.removeEventListener(
            'inputsourceschange',
            this.onInputSourcesChange.bind(this)
        );
    }

    setHandTrackingControllers(controllerObject: Object3D) {
        const handtrackingComponent = this.trackedHand.getComponent(HandTracking);
        if (!handtrackingComponent) return;
        /** @todo: Remove any when hand tracking is typed. */
        (handtrackingComponent as any).controllerToDeactivate = controllerObject;
    }

    getComponents(obj: Object3D) {
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

    private _setComponentsActive(active: boolean) {
        const comps = this._defaultControllerComponents;
        if (comps == undefined) return;
        for (let i = 0; i < comps.length; ++i) {
            comps[i].active = active;
        }
    }

    onInputSourcesChange(event: XRInputSourceChangeEvent) {
        if (this.isModelLoaded() && !this.mapToDefaultController) {
            this._setComponentsActive(false);
        }

        event.added.forEach((xrInputSource: XRInputSource) => {
            if (xrInputSource.hand != null) return;
            if (this._handedness != xrInputSource.handedness) return;
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
                    console.log('Profile downloaded and loaded from ' + this.url);
                    InputProfile.Cache.set(this.url, this._profileJSON);
                    this.loadAndMapGamepad(profile, xrInputSource);
                })
                .catch((e) => {
                    console.error('failed to load profile from' + this.url);
                    console.error(e);
                });
        });
    }

    isModelLoaded() {
        return this._controllerModel !== null;
    }

    async loadAndMapGamepad(profile: string, xrInputSource: XRInputSource) {
        this._gamepad = xrInputSource.gamepad;
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
                    'Couldnot load i-p, continuing with ' +
                        this._handedness +
                        ' default controller'
                );
            }
            this._setComponentsActive(false);
            this._controllerModel.parent = this.object;
            this._controllerModel.setPositionLocal([0, 0, 0]);
            console.log('Disabling ' + this._handedness + ' default Controller');
            console.log(this._handedness + 'controller model loaded to the scene');
            this.notifyUrlReady();
        } else {
            console.log('mapping i-p to ' + this._handedness + ' default controllers');
        }
        this.getGamepadObjectsFromProfile(this._profileJSON, this._controllerModel);
        this.setHandTrackingControllers(this.defaultController);
        this.update = () => this.mapGamepadInput();
    }

    getGamepadObjectsFromProfile(profile: any, obj: Object3D) {
        const components = profile.layouts[this._handedness].components;
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

    getGamepadObjectByName(obj: Object3D, name: string) {
        if (!obj || !name) return;

        if (obj.name === name) this._gamepadObjects[name] = obj;

        const children = obj.children;
        for (let i = 0; i < children.length; ++i)
            this.getGamepadObjectByName(children[i], name);
    }

    assignTransform(target: Object3D, min: Object3D, max: Object3D, value: number) {
        vec3.lerp(
            _TempVec,
            min.getPositionWorld(minTemp),
            max.getPositionWorld(maxTemp),
            value
        );
        target.setPositionWorld(_TempVec);
        quat.lerp(
            _TempQuat,
            min.getRotationWorld(_TempRotation1),
            max.getRotationWorld(_TempRotation2),
            value
        );
        quat.normalize(_TempQuat, _TempQuat);
        target.setRotationWorld(_TempQuat);
    }

    mapGamepadInput() {
        for (const button of this._buttons) {
            const buttonValue = this._gamepad!.buttons[button.id].value;
            this.assignTransform(button.target, button.min, button.max, buttonValue);
        }
        for (const axis of this._axes) {
            const axisValue = this._gamepad!.axes[axis.id];
            const normalizedAxisValue = (axisValue + 1) / 2;
            this.assignTransform(axis.target, axis.min, axis.max, normalizedAxisValue);
        }
    }
}
