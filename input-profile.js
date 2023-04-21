import {Component, Property} from '@wonderlandengine/api';
import {vec3, quat} from 'gl-matrix';
const _TempVec = vec3.create();
const _TempQuat = quat.create();

export class InputProfile extends Component {
    static TypeName = 'input-profile';
    static Properties = {
        controller: Property.object(),
        handednessIndex: Property.enum(['left', 'right'], 0),
        path: Property.string(
            'https://cdn.jsdelivr.net/npm/@webxr-input-profiles/assets@1.0.13/dist/profiles/'
        ),
        customProfileFolder: Property.string(''),
    };

    init() {
        this._gamepadObjects = {}; 
        this._modelLoaded = false;
    }

    start() {
        if (this.engine.XRSession) {
            this.engine.XRSession.addEventListener(
                'inputsourceschange',
                this.onInputSourcesChange.bind(this)
            );
        } else {
            this.engine.onXRSessionStart.add((session) => {
                session.addEventListener(
                    'inputsourceschange',
                    this.onInputSourcesChange.bind(this)
                );
            });
        }

        this.handedness = ['left', 'right'][this.handednessIndex];
    }

    update() {
        if (this.modelLoaded) {
            this.mapGamepadInput();
        }
    }

    onInputSourcesChange(event) {
        event.added.forEach((xrInputSource) => {
            const profile = this.customProfileFolder || xrInputSource.profiles[0];
            /** load Profile json */
            /** Note: if you are providing a custom ProfileJSON provide its path in the
             * customProfileFolder property of the input-profile component.
             */
            this.url = this.path + profile + '/profile.json';
            fetch(this.url)
                .then((res) => res.json())
                .then((out) => {
                    this.ProfileJSON = out;
                    const consoleText = this.modelLoaded
                        ? 'Profile loaded' + this.url 
                        : 'Reloaded Profile for gamepad mapping ';
                    console.log(consoleText);
                })
                .catch(console.error);

            if (this.handedness === xrInputSource.handedness) {
                this.gamepad = xrInputSource.gamepad;
                /** load controllerModel **/
                const assetPath = this.path + profile + '/' + this.handedness + '.glb';
                if (!this.modelLoaded) {
                    this.engine.scene
                        .append(assetPath)
                        .then((obj) => {
                            obj.parent = this.object;
                            obj.setTranslationLocal([0, 0, 0]);
                            this.getGamepadObjectsFromProfile(this.ProfileJSON, obj);
                            this.modelLoaded = true;
                            console.log('model loaded to the scene');
                        })
                        .catch(console.error);
                }
            }
        });
    }

    getGamepadObjectsFromProfile(profile, obj) {
        //initialise components
        const components = profile.layouts[this.handedness].components;
        if (!components) return;
        for (const i in components) {
            if (components.hasOwnProperty(i)) {
                const visualResponses = components[i].visualResponses;
                for (const j in visualResponses) {
                    if (visualResponses.hasOwnProperty(j)) {
                        this.getObjectByName(obj, visualResponses[j].valueNodeName);
                        this.getObjectByName(obj, visualResponses[j].minNodeName);
                        this.getObjectByName(obj, visualResponses[j].maxNodeName);
                    }
                }
            }
        }
    }

    getObjectByName(obj, name) {
        if (!obj || !name) return;
        if (obj.name === name) this._gamepadObjects[name] = obj;
        const children = obj.children;
        for (let i = 0; i < children.length; ++i) this.getObjectByName(children[i], name);
    }

    assignTransform(target, min, max, value) {
        vec3.lerp(
            _TempVec,
            min.getTranslationWorld([]),
            max.getTranslationWorld([]),
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
                    // check if component property matches with axis
                    if (visualResponse.componentProperty === 'button') {
                        return this.gamepad.buttons[component.gamepadIndices.button]
                            .pressed;
                    }
                    if (visualResponse.componentProperty === 'xAxis') {
                        return (this.gamepad.axes[component.gamepadIndices.xAxis] + 1) / 2;
                    }
                    if (visualResponse.componentProperty === 'yAxis') {
                        return (this.gamepad.axes[component.gamepadIndices.yAxis] + 1) / 2;
                    }
                case 'trigger':
                    return this.gamepad.buttons[component.gamepadIndices.button].value;

                case 'squeeze':
                    return this.gamepad.buttons[component.gamepadIndices.button].value;
            }
        }
    }
}
