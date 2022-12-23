WL.registerComponent(
	"input-profile",
	{
		controller: {type: WL.Type.Object},
		handednessIndex: {
			type: WL.Type.Enum,
			values: ["left", "right"],
			default: "left",
		},
		path: {
			type: WL.Type.String,
			default:
				"https://cdn.jsdelivr.net/npm/@webxr-input-profiles/assets@1.0/dist/profiles/",
		},
		customProfileFolder: {
			type: WL.Type.String,
		},
	},
	{
		init: function () {
			this.gamepadObjects = {};
			this.modelLoaded = false;
		},

		start: function () {
			WL.onXRSessionStart.push((session) => {
				session.addEventListener("inputsourceschange", this.onInputSourcesChange.bind(this));
			});
			this.handedness = ["left", "right"][this.handednessIndex];
		},

		update: function () {
			if (this.modelLoaded) this.mapGamepadInput();
		},

		onInputSourcesChange: function (event) {
			event.added.forEach((xrInputSource) => {
				const profile = this.customProfileFolder || xrInputSource.profiles[0];
				/** load Profile json */ 
				/** Note: if you are providing a custom ProfileJson provide its path in the 
				 * customProfileFolder property of the input-profile component.
				*/
				this.url = this.path + profile + "/profile.json";
				fetch(this.url)
					.then((res) => res.json())
					.then((out) => {
						ProfileJSON = out;
					})
					.catch((err) => console.error(err));

				if (this.handedness == xrInputSource.handedness) {
					this.gamepad = xrInputSource.gamepad;
					/** load controllerModel **/
					const assetPath = this.path + profile + "/" + this.handedness + ".glb";
					if (!this.modelLoaded) {
						WL.scene
							.append(assetPath)
							.then((obj) => {
								obj.parent = this.object;
								obj.setTranslationLocal([0, 0, 0]);
								this.getgamepadObjectsFromProfile(ProfileJSON, obj);
								this.modelLoaded = true;
							})
							.catch((error) => {
								console.error("error : ", error);
							});
					}
				}
			});
		},

		getgamepadObjectsFromProfile: function (profile, obj) {
			components = profile["layouts"][this.handedness]["components"];
			for (i in components) {
				if (components.hasOwnProperty(i)) {
					visualResponses = components[i]["visualResponses"];
					for (j in visualResponses) {
						if (visualResponses.hasOwnProperty(j)) {
							this.getObjectName(obj, visualResponses[j]["valueNodeName"]);
							this.getObjectName(obj, visualResponses[j]["minNodeName"]);
							this.getObjectName(obj, visualResponses[j]["maxNodeName"]);
						}
					}
				}
			}
		},

		getObjectName: function (obj, name) {
			if (obj.name == name) this.gamepadObjects[name] = obj;
			const children = obj.children;
			for (let i = 0; i < children.length; ++i) this.getObjectName(children[i], name);
		},

		assignTransform: function (target, min, max, value) {
			const tempVec = glMatrix.vec3.create();
			glMatrix.vec3.lerp(
				tempVec,
				min.getTranslationWorld([]),
				max.getTranslationWorld([]),
				value,
			);
			target.setTranslationWorld(tempVec);

			const tempquat = glMatrix.quat.create();
			glMatrix.quat.lerp(tempquat, min.rotationWorld, max.rotationWorld, value);
			glMatrix.quat.normalize(tempquat, tempquat);
			target.rotationWorld = tempquat;
		},

		mapGamepadInput: function () {
			components = ProfileJSON["layouts"][this.handedness]["components"];
			for (i in components) {
				if (components.hasOwnProperty(i)) {
					component = components[i];
					visualResponses = component["visualResponses"];
					for (j in visualResponses) {
						if (visualResponses.hasOwnProperty) {
							visualResponse = visualResponses[j];
							let target = this.gamepadObjects[visualResponse["valueNodeName"]];
							let min = this.gamepadObjects[visualResponse["minNodeName"]];
							let max = this.gamepadObjects[visualResponse["maxNodeName"]];
							this.assignTransform(
								target,
								min,
								max,
								this.getGamepadValue(component, visualResponse),
							);
						}
					}
				}
			}
		},

		getGamepadValue: function (component, visualResponse) {
			if (visualResponse["valueNodeProperty"] == "transform") {
				switch (component["type"]) {
					case "button":
						var value = this.gamepad.buttons[component["gamepadIndices"]["button"]].pressed;
						break;
					case "thumbstick":
						// check if component property matches with axis
						if (visualResponse["componentProperty"] == "button") {
							var value = this.gamepad.buttons[component["gamepadIndices"]["button"]].pressed;
						}
						if (visualResponse["componentProperty"] == "xAxis") {
							var value = (this.gamepad.axes[component["gamepadIndices"]["xAxis"]] + 1) / 2;
						}
						if (visualResponse["componentProperty"] == "yAxis") {
							var value = (this.gamepad.axes[component["gamepadIndices"]["yAxis"]] + 1) / 2;
						}
						break;
					case "trigger":
						var value = this.gamepad.buttons[component["gamepadIndices"]["button"]].value;
						break;

					case "squeeze":
						var value = this.gamepad.buttons[component["gamepadIndices"]["button"]].value;
						break;
				}
			}
			return value;
		},
	},
);
