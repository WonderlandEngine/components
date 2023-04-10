import {Component, Type} from '@wonderlandengine/api';
import {vec3, quat} from 'gl-matrix';

export class InputProfile extends Component {
    static TypeName = 'input-profile';
    static Properties = {
        controller: {type: Type.Object},
        handednessIndex: {
            type: Type.Enum,
            values: ['left', 'right'],
            default: 'left',
        },
        path: {
            type: Type.String,
            default:
                'https://cdn.jsdelivr.net/npm/@webxr-input-profiles/assets@1.0.13/dist/profiles/',
        },
        customProfileFolder: {
            type: Type.String,
        },
    };

    init() {
        this.gamepadObjects = {};
        this.modelLoaded = false;
        this.tempVec = vec3.create();
    }

    start() {
        if (this.engine.xrSession) {
            this.engine.xrSession.addEventListener(
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
        if (this.modelLoaded === true) {
            this.mapGamepadInput();
        }
    }

    onInputSourcesChange(event) {
        event.added.forEach((xrInputSource) => {
            const profile = this.customProfileFolder || xrInputSource.profiles[0];
            /** load Profile json */
            /** Note: if you are providing a custom window.ProfileJSON provide its path in the
             * customProfileFolder property of the input-profile component.
             */
            this.url = this.path + profile + '/profile.json';
            console.log('loading Profile ' + this.url);
            fetch(this.url)
                .then((res) => res.json())
                .then((out) => {
                    window.ProfileJSON = out;
                    const consoleText = this.modelLoaded
                        ? 'Profile loaded'
                        : 'Reloaded Profile for gamepad mapping ';
                    console.log(consoleText);
                })
                .catch(console.error);

            if (this.handedness == xrInputSource.handedness) {
                this.gamepad = xrInputSource.gamepad;
                /** load controllerModel **/
                const assetPath = this.path + profile + '/' + this.handedness + '.glb';
                if (!this.modelLoaded) {
                    this.engine.scene
                        .append(assetPath)
                        .then((obj) => {
                            obj.parent = this.object;
                            obj.setTranslationLocal([0, 0, 0]);
                            this.getGamepadObjectsFromProfile(window.ProfileJSON, obj);
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
        const components = profile['layouts'][this.handedness]['components'];
        if (!components) return;
        for (let i in components) {
            if (components.hasOwnProperty(i)) {
                const visualResponses = components[i]['visualResponses'];
                for (let j in visualResponses) {
                    if (visualResponses.hasOwnProperty(j)) {
                        this.getObjectByName(obj, visualResponses[j]['valueNodeName']);
                        this.getObjectByName(obj, visualResponses[j]['minNodeName']);
                        this.getObjectByName(obj, visualResponses[j]['maxNodeName']);
                    }
                }
            }
        }
    }

    getObjectByName(obj, name) {
        if (!obj || !name) return;
        if (obj.name == name) this.gamepadObjects[name] = obj;
        const children = obj.children;
        for (let i = 0; i < children.length; ++i) this.getObjectByName(children[i], name);
    }

    assignTransform(target, min, max, value) {
        vec3.lerp(
            this.tempVec,
            min.getTranslationWorld([]),
            max.getTranslationWorld([]),
            value
        );
        target.setTranslationWorld(this.tempVec);

        const tempquat = quat.create();
        quat.lerp(tempquat, min.rotationWorld, max.rotationWorld, value);
        quat.normalize(tempquat, tempquat);
        target.rotationWorld = tempquat;
    }

    mapGamepadInput() {
        const components = window.ProfileJSON['layouts'][this.handedness]['components'];
        if (!components) return;
        for (let i in components) {
            if (components.hasOwnProperty(i)) {
                const component = components[i];
                const visualResponses = component['visualResponses'];
                for (let j in visualResponses) {
                    if (visualResponses.hasOwnProperty) {
                        const visualResponse = visualResponses[j];
                        const target = this.gamepadObjects[visualResponse['valueNodeName']];
                        const min = this.gamepadObjects[visualResponse['minNodeName']];
                        const max = this.gamepadObjects[visualResponse['maxNodeName']];

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
        if (visualResponse['valueNodeProperty'] == 'transform') {
            switch (component['type']) {
                case 'button':
                    return this.gamepad.buttons[component['gamepadIndices']['button']]
                        .pressed;

                case 'thumbstick':
                    // check if component property matches with axis
                    if (visualResponse['componentProperty'] == 'button') {
                        return this.gamepad.buttons[component['gamepadIndices']['button']]
                            .pressed;
                    }
                    if (visualResponse['componentProperty'] == 'xAxis') {
                        return (
                            (this.gamepad.axes[component['gamepadIndices']['xAxis']] + 1) /
                            2
                        );
                    }
                    if (visualResponse['componentProperty'] == 'yAxis') {
                        return (
                            (this.gamepad.axes[component['gamepadIndices']['yAxis']] + 1) /
                            2
                        );
                    }
                case 'trigger':
                    return this.gamepad.buttons[component['gamepadIndices']['button']]
                        .value;

                case 'squeeze':
                    return this.gamepad.buttons[component['gamepadIndices']['button']]
                        .value;
            }
        }
    }
}
