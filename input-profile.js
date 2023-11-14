import {Component, Property} from '@wonderlandengine/api';
import {HandTracking} from '@wonderlandengine/components';
import {vec3, quat} from 'gl-matrix';

const _TempVec = vec3.create();
const _TempQuat = quat.create();
const minTemp = new Float32Array(3);
const maxTemp = new Float32Array(3);
const hands = ['left', 'right'];

export class InputProfile extends Component {
    static TypeName = 'input-profile';
    static Properties = {
        defaultController: Property.object(),
        handednessIndex: Property.enum(hands, 0),
        path: Property.string(
            'https://cdn.jsdelivr.net/npm/@webxr-input-profiles/assets@latest/dist/profiles/'
        ),
        customProfileFolder: Property.string(''),
        mapToDefaultController: Property.bool(false),
        trackedHand: Property.object(),
    };

    init() {
        this._gamepadObjects = {};
        this._modelLoaded = false;
    }

    start() {
        this.controllerModel = null;
        this.toFilter = new Set(['vr-mode-active-mode-switch']);
        this.defaultControllerComponents = [];
        this.getComponents(this.defaultController);
        this.handedness = hands[this.handednessIndex];

        if (this.engine.xr?.session != null) {
            this.engine.xr.session.addEventListener(
                'inputsourceschange',
                this.onInputSourcesChange.bind(this)
            );
        } else {
            this.engine.onXRSessionStart.add(() => {
                this.engine.xr.session.addEventListener(
                    'inputsourceschange',
                    this.onInputSourcesChange.bind(this)
                );
            });
        }
    }

    onDeactivate() {
        if (this.engine.xr?.session != null) {
            this.engine.xr.session.removeEventListener(
                'inputsourceschange',
                this.onInputSourcesChange.bind(this)
            );
        } else {
            this.engine.onXRSessionStart.add(() => {
                this.engine.xr.session.removeEventListener(
                    'inputsourceschange',
                    this.onInputSourcesChange.bind(this)
                );
            });
        }
    }

    setHandTrackingControllers(controllerObject) {
        this.trackedHand.getComponent(HandTracking).controllerToDeactivate =
            controllerObject;
    }

    getComponents(obj) {
        if (obj == null) return;
        const comps = obj.getComponents().filter((c) => !this.toFilter.has(c.type));
        this.defaultControllerComponents = this.defaultControllerComponents.concat(comps);

        let children = obj.children;
        for (let i = 0; i < children.length; ++i) {
            this.getComponents(children[i]);
        }
    }

    setComponentsActive(active) {
        const comps = this.defaultControllerComponents;
        for (let i = 0; i < comps.length; ++i) {
            comps[i].active = active;
        }
    }

    onInputSourcesChange(event) {
        if (this.modelLoaded && !this.mapToDefaultController) {
            this.setComponentsActive(false);
        }

        event.added.forEach((xrInputSource) => {
            if (xrInputSource.hand != null) return;
            if (this.handedness === xrInputSource.handedness) {
                var profile = this.path + xrInputSource.profiles[0];
                if (this.customProfileFolder != '') {
                    profile = this.customProfileFolder;
                }

                this.url = profile + '/profile.json';
                console.log('url is ' + this.url);

                fetch(this.url)
                    .then((res) => res.json())
                    .then((out) => {
                        this.ProfileJSON = out;
                        const consoleText = this.modelLoaded
                            ? 'Profile loaded' + this.url
                            : 'Reloaded Profile for gamepad mapping ';
                        console.log(consoleText);
                        this.loadGamepad(profile, xrInputSource);
                    })
                    .catch((e) => {
                        console.error('failed to load profile.json');
                        console.error(e);
                    });
            }
        });
    }
    isModelLoaded() {
        return this.controllerObject !== null;
    }

    loadGamepad(profile, xrInputSource) {
        this.gamepad = xrInputSource.gamepad;

        const assetPath = profile + '/' + this.handedness + '.glb';
        if (this.modelLoaded) return;
        console.log('flag value == ');
        console.log(this.mapToDefaultController);

        if (!this.mapToDefaultController) {
            this.engine.scene
                .append(assetPath)
                .then((obj) => {
                    this.controllerModel = obj;
                    this.setComponentsActive(false);
                    console.log('setting comp false ');
                    this.controllerModel.parent = this.object;
                    this.controllerModel.setTranslationLocal([0, 0, 0]);
                    this.getGamepadObjectsFromProfile(
                        this.ProfileJSON,
                        this.controllerModel
                    );
                    this.modelLoaded = this.isModelLoaded();
                    this.setHandTrackingControllers(this.controllerModel);
                    this.update = () => this.mapGamepadInput();
                    console.log('model loaded to the scene');
                })
                .catch((e) => {
                    console.error('failed to load 3d model');
                    console.error(e);
                    this.setComponentsActive(true);
                    console.log('setting comp true');
                });
        } else {
            this.controllerModel = this.defaultController;
            this.getGamepadObjectsFromProfile(this.ProfileJSON, this.defaultController);
            this.modelLoaded = this.isModelLoaded();
            this.update = () => this.mapGamepadInput();
            this.setHandTrackingControllers(this.defaultController);
        }
    }

    getGamepadObjectsFromProfile(profile, obj) {
        const components = profile.layouts[this.handedness].components;
        if (!components) return;

        for (const i in components) {
            if (components.hasOwnProperty(i)) {
                const visualResponses = components[i].visualResponses;

                for (const j in visualResponses) {
                    if (visualResponses.hasOwnProperty(j)) {
                        const valueNode = visualResponses[j].valueNodeName;
                        const minNode = visualResponses[j].minNodeName;
                        const maxNode = visualResponses[j].maxNodeName;

                        this.getGamepadObjectByName(obj, valueNode);
                        this.getGamepadObjectByName(obj, minNode);
                        this.getGamepadObjectByName(obj, maxNode);
                    }
                }
            }
        }
    }

    getGamepadObjectByName(obj, name) {
        if (!obj || !name) return;

        if (obj.name === name) this._gamepadObjects[name] = obj;

        const children = obj.children;
        for (let i = 0; i < children.length; ++i)
            this.getGamepadObjectByName(children[i], name);
    }

    assignTransform(target, min, max, value) {
        vec3.lerp(
            _TempVec,
            min.getPositionWorld(minTemp),
            max.getPositionWorld(maxTemp),
            value
        );
        target.setTranslationWorld(_TempVec);

        quat.lerp(_TempQuat, min.rotationWorld, max.rotationWorld, value);
        quat.normalize(_TempQuat, _TempQuat);
        target.rotationWorld = _TempQuat;
    }

    mapGamepadInput() {
        const components = this.ProfileJSON.layouts[this.handedness].components;
        if (!components) return;

        for (const i in components) {
            if (components.hasOwnProperty(i)) {
                const component = components[i];
                const visualResponses = component.visualResponses;

                for (const j in visualResponses) {
                    if (visualResponses.hasOwnProperty) {
                        const visualResponse = visualResponses[j];
                        const target = this._gamepadObjects[visualResponse.valueNodeName];
                        const min = this._gamepadObjects[visualResponse.minNodeName];
                        const max = this._gamepadObjects[visualResponse.maxNodeName];

                        this.assignTransform(
                            target,
                            min,
                            max,
                            this.getGamepadValue(component, visualResponse)
                        );
                    }
                }
            }
        }
    }

    getGamepadValue(component, visualResponse) {
        if (visualResponse.valueNodeProperty === 'transform') {
            switch (component.type) {
                case 'button':
                    return this.gamepad.buttons[component.gamepadIndices.button].pressed;

                case 'thumbstick':
                    if (visualResponse.componentProperty === 'button') {
                        return this.gamepad.buttons[component.gamepadIndices.button]
                            .pressed;
                    } else if (visualResponse.componentProperty === 'xAxis') {
                        return (this.gamepad.axes[component.gamepadIndices.xAxis] + 1) / 2;
                    } else if (visualResponse.componentProperty === 'yAxis') {
                        return (this.gamepad.axes[component.gamepadIndices.yAxis] + 1) / 2;
                    } else {
                        console.log('unidentified componentProperty');
                    }
                case 'trigger':
                    return this.gamepad.buttons[component.gamepadIndices.button].value;

                case 'squeeze':
                    return this.gamepad.buttons[component.gamepadIndices.button].value;
            }
        }
    }
}
