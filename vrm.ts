import {Component} from '@wonderlandengine/api';
import {quat, quat2, vec3} from 'gl-matrix';
import {Object3D} from '@wonderlandengine/api';
import {property} from '@wonderlandengine/api/decorators.js';

const VRM_ROLL_AXES: Record<string, [number, number, number]> = {
    X: [1.0, 0.0, 0.0],
    Y: [0.0, 1.0, 0.0],
    Z: [0.0, 0.0, 1.0],
};

const VRM_AIM_AXES: Record<string, [number, number, number]> = {
    PositiveX: [1.0, 0.0, 0.0],
    NegativeX: [-1.0, 0.0, 0.0],
    PositiveY: [0.0, 1.0, 0.0],
    NegativeY: [0.0, -1.0, 0.0],
    PositiveZ: [0.0, 0.0, 1.0],
    NegativeZ: [0.0, 0.0, -1.0],
};

const Rad2Deg = 180.0 / Math.PI;
const RightVector = vec3.fromValues(1, 0, 0);
const UpVector = vec3.fromValues(0, 1, 0);
const ForwardVector = vec3.fromValues(0, 0, 1);

interface FirstPersonAnnotation {
    node: Object3D;
    firstPerson: boolean;
    thirdPerson: boolean;
}

interface LookAtRangeMap {
    inputMaxValue: number;
    outputScale: number;
}

interface LookAt {
    offsetFromHeadBone: [number, number, number];
    horizontalInner: LookAtRangeMap;
    horizontalOuter: LookAtRangeMap;
    verticalDown: LookAtRangeMap;
    verticalUp: LookAtRangeMap;
}

interface HumanoidBones {
    [key: string]: Object3D | null;
    /* Torso */
    hips: Object3D | null;
    spine: Object3D | null;
    chest: Object3D | null;
    upperChest: Object3D | null;
    neck: Object3D | null;

    /* Head */
    head: Object3D | null;
    leftEye: Object3D | null;
    rightEye: Object3D | null;
    jaw: Object3D | null;

    /* Legs */
    leftUpperLeg: Object3D | null;
    leftLowerLeg: Object3D | null;
    leftFoot: Object3D | null;
    leftToes: Object3D | null;
    rightUpperLeg: Object3D | null;
    rightLowerLeg: Object3D | null;
    rightFoot: Object3D | null;
    rightToes: Object3D | null;

    /* Arms */
    leftShoulder: Object3D | null;
    leftUpperArm: Object3D | null;
    leftLowerArm: Object3D | null;
    leftHand: Object3D | null;
    rightShoulder: Object3D | null;
    rightUpperArm: Object3D | null;
    rightLowerArm: Object3D | null;
    rightHand: Object3D | null;

    /* Fingers */
    leftThumbMetacarpal: Object3D | null;
    leftThumbProximal: Object3D | null;
    leftThumbDistal: Object3D | null;
    leftIndexProximal: Object3D | null;
    leftIndexIntermediate: Object3D | null;
    leftIndexDistal: Object3D | null;
    leftMiddleProximal: Object3D | null;
    leftMiddleIntermediate: Object3D | null;
    leftMiddleDistal: Object3D | null;
    leftRingProximal: Object3D | null;
    leftRingIntermediate: Object3D | null;
    leftRingDistal: Object3D | null;
    leftLittleProximal: Object3D | null;
    leftLittleIntermediate: Object3D | null;
    leftLittleDistal: Object3D | null;
    rightThumbMetacarpal: Object3D | null;
    rightThumbProximal: Object3D | null;
    rightThumbDistal: Object3D | null;
    rightIndexProximal: Object3D | null;
    rightIndexIntermediate: Object3D | null;
    rightIndexDistal: Object3D | null;
    rightMiddleProximal: Object3D | null;
    rightMiddleIntermediate: Object3D | null;
    rightMiddleDistal: Object3D | null;
    rightRingProximal: Object3D | null;
    rightRingIntermediate: Object3D | null;
    rightRingDistal: Object3D | null;
    rightLittleProximal: Object3D | null;
    rightLittleIntermediate: Object3D | null;
    rightLittleDistal: Object3D | null;
}

interface SpringChainCollider {
    id: number;
    object: Object3D;
    shape: {
        isCapsule: boolean;
        radius: number;
        offset: [number, number, number];
        tail: [number, number, number];
    };
    cache: {
        head: vec3;
        tail: vec3;
    };
}

interface SpringJointState {
    prevTail: vec3;
    currentTail: vec3;
    initialLocalRotation: quat;
    initialLocalTransformInvert: quat2;
    boneAxis: vec3;
    boneLength: number;
    prevTailCenter: vec3 | null;
    currentTailCenter: vec3 | null;
}

interface SpringJoint {
    hitRadius: number;
    stiffness: number;
    gravityPower: number;
    gravityDir: [number, number, number];
    dragForce: number;
    node: Object3D;
    state: SpringJointState | null;
}

interface SpringChain {
    name: string;
    center: Object3D | null;
    joints: SpringJoint[];
    sphereColliders: SpringChainCollider[];
    capsuleColliders: SpringChainCollider[];
}

/**
 * Component for loading and handling VRM 1.0 models.
 *
 * Posing of the model should be done exclusively by rotating the bones. These can be
 * accessed using the `.bones` property and follow the VRM bone naming. Note that not
 * all VRM models will have all possible bones. The rest pose (T-pose) is captured in
 * the `.restPose` property. Resetting a bone to its rest pose can be done as follows:
 * ```js
 * vrmComponent.bones[vrmBoneName].rotationLocal = vrmComponent.restPose[vrmBoneName];
 * ```
 *
 * Moving the model through the world should be done by moving the object this component
 * is attached to. In other words, by moving the root of the VRM model. The bones and any
 * descendant objects should *not* be used to move the VRM model.
 *
 * The core extension `VRMC_vrm` as well as the`VRMC_springBone` and `VRMC_node_constraint`
 * extensions are supported.
 *
 * **Limitations:**
 * - No support for `VRMC_material_mtoon`
 * - Expressions aren't supported
 * - Expression based lookAt isn't supported
 * - Mesh annotation mode `auto` is not supported (first person mode)
 */
export class Vrm extends Component {
    static TypeName = 'vrm';

    /** URL to a VRM file to load */
    @property.string()
    src!: string;
    /** Object the VRM is looking at */
    @property.object()
    lookAtTarget!: Object3D | null;

    /** Meta information about the VRM model */
    meta: any = null;
    /** The humanoid bones of the VRM model */
    bones: HumanoidBones = {
        /* Torso */
        hips: null,
        spine: null,
        chest: null,
        upperChest: null,
        neck: null,

        /* Head */
        head: null,
        leftEye: null,
        rightEye: null,
        jaw: null,

        /* Legs */
        leftUpperLeg: null,
        leftLowerLeg: null,
        leftFoot: null,
        leftToes: null,
        rightUpperLeg: null,
        rightLowerLeg: null,
        rightFoot: null,
        rightToes: null,

        /* Arms */
        leftShoulder: null,
        leftUpperArm: null,
        leftLowerArm: null,
        leftHand: null,
        rightShoulder: null,
        rightUpperArm: null,
        rightLowerArm: null,
        rightHand: null,

        /* Fingers */
        leftThumbMetacarpal: null,
        leftThumbProximal: null,
        leftThumbDistal: null,
        leftIndexProximal: null,
        leftIndexIntermediate: null,
        leftIndexDistal: null,
        leftMiddleProximal: null,
        leftMiddleIntermediate: null,
        leftMiddleDistal: null,
        leftRingProximal: null,
        leftRingIntermediate: null,
        leftRingDistal: null,
        leftLittleProximal: null,
        leftLittleIntermediate: null,
        leftLittleDistal: null,
        rightThumbMetacarpal: null,
        rightThumbProximal: null,
        rightThumbDistal: null,
        rightIndexProximal: null,
        rightIndexIntermediate: null,
        rightIndexDistal: null,
        rightMiddleProximal: null,
        rightMiddleIntermediate: null,
        rightMiddleDistal: null,
        rightRingProximal: null,
        rightRingIntermediate: null,
        rightRingDistal: null,
        rightLittleProximal: null,
        rightLittleIntermediate: null,
        rightLittleDistal: null,
    };

    /** Rotations of the bones in the rest pose (T-pose) */
    restPose: {[key: string]: quat} = {};

    /* All node constraints, ordered to deal with dependencies */
    private _nodeConstraints: any[] = [];

    /* VRMC_springBone chains */
    private _springChains: SpringChain[] = [];
    /* Spherical colliders for spring bones */
    private _sphereColliders: SpringChainCollider[] = [];
    /* Capsule shaped colliders for spring bones */
    private _capsuleColliders: SpringChainCollider[] = [];

    /* Indicates which meshes are rendered in first/third person views */
    private _firstPersonAnnotations: FirstPersonAnnotation[] = [];

    /* Contains details for (bone type) lookAt behaviour */
    private _lookAt: LookAt | null = null;

    /* Whether or not the VRM component has been initialized with `initializeVrm` */
    private _initialized: boolean = false;

    private _tempV3 = vec3.create();
    private _tempV3A = vec3.create();
    private _tempV3B = vec3.create();
    private _tempQuat = quat.create();
    private _tempQuatA = quat.create();
    private _tempQuatB = quat.create();
    private _tempQuat2 = quat2.create();

    private _tailToShape = vec3.create();
    private _headToTail = vec3.create();

    private _inertia = vec3.create();
    private _stiffness = vec3.create();
    private _external = vec3.create();

    private _identityQuat = quat.identity(quat.create());

    async start() {
        if (!this.src) {
            console.error('vrm: src property not set');
            return;
        }

        const prefab = await this.engine.loadGLTF({url: this.src, extensions: true});

        const {root, extensions} = this.engine.scene.instantiate(prefab);
        root!.children.forEach((child) => (child.parent = this.object));
        this._initializeVrm(prefab.extensions, extensions?.idMapping!);
        root!.destroy();
    }

    /**
     * Parses the VRM glTF extensions and initializes the vrm component.
     * @param extensions The glTF extensions for the VRM model
     */
    private _initializeVrm(extensions: any, idMapping: number[]): void {
        if (this._initialized) {
            throw new Error('VRM component has already been initialized');
        }

        const VRMC_vrm = extensions.root['VRMC_vrm'];
        if (!VRMC_vrm) {
            throw new Error('Missing VRM extensions');
        }
        if (VRMC_vrm.specVersion !== '1.0') {
            throw new Error(
                `Unsupported VRM version, only 1.0 is supported, but encountered '${VRMC_vrm.specVersion}'`
            );
        }

        this.meta = VRMC_vrm.meta;
        this._parseHumanoid(VRMC_vrm.humanoid, idMapping);

        if (VRMC_vrm.firstPerson) {
            this._parseFirstPerson(VRMC_vrm.firstPerson, extensions);
        }

        if (VRMC_vrm.lookAt) {
            this._parseLookAt(VRMC_vrm.lookAt);
        }

        this._findAndParseNodeConstraints(extensions, idMapping);

        const springBone = extensions.root['VRMC_springBone'];
        if (springBone) {
            this._parseAndInitializeSpringBones(springBone, idMapping);
        }

        this._initialized = true;
    }

    private _parseHumanoid(humanoid: any, idMapping: number[]): void {
        for (const boneName in humanoid.humanBones) {
            if (!(boneName in this.bones)) {
                console.warn(`Unrecognized bone '${boneName}'`);
                continue;
            }

            const node = humanoid.humanBones[boneName].node;
            const objectId = idMapping[node];

            this.bones[boneName] = this.engine.scene.wrap(objectId);
            this.restPose[boneName] = this.bones[boneName]!.getRotationLocal(quat.create());
        }
    }

    private _parseFirstPerson(firstPerson: any, idMapping: number[]): void {
        for (const meshAnnotation of firstPerson.meshAnnotations) {
            const annotation: FirstPersonAnnotation = {
                node: this.engine.scene.wrap(idMapping[meshAnnotation.node]),
                firstPerson: true,
                thirdPerson: true,
            };
            switch (meshAnnotation.type) {
                case 'firstPersonOnly':
                    annotation.thirdPerson = false;
                    break;
                case 'thirdPersonOnly':
                    annotation.firstPerson = false;
                    break;
                case 'both':
                    break;
                case 'auto':
                    console.warn(
                        "First person mesh annotation type 'auto' is not supported, treating as 'both'!"
                    );
                    break;
                default:
                    console.error(`Invalid mesh annotation type '${meshAnnotation.type}'`);
                    break;
            }
            this._firstPersonAnnotations.push(annotation);
        }
    }

    private _parseLookAt(lookAt: any): void {
        if (lookAt.type !== 'bone') {
            console.warn(
                `Unsupported lookAt type '${lookAt.type}', only 'bone' is supported`
            );
            return;
        }

        const parseRangeMap = (rangeMap: any): LookAtRangeMap => {
            return {
                inputMaxValue: rangeMap.inputMaxValue,
                outputScale: rangeMap.outputScale,
            };
        };
        this._lookAt = {
            offsetFromHeadBone: lookAt.offsetFromHeadBone || [0, 0, 0],
            horizontalInner: parseRangeMap(lookAt.rangeMapHorizontalInner),
            horizontalOuter: parseRangeMap(lookAt.rangeMapHorizontalOuter),
            verticalDown: parseRangeMap(lookAt.rangeMapVerticalDown),
            verticalUp: parseRangeMap(lookAt.rangeMapVerticalUp),
        };
    }

    private _findAndParseNodeConstraints(extensions: any, idMapping: number[]): void {
        const traverse = (object: Object3D) => {
            const nodeExtensions = extensions.node[object.objectId];
            if (nodeExtensions && 'VRMC_node_constraint' in nodeExtensions) {
                const nodeConstraintExtension = nodeExtensions['VRMC_node_constraint'];

                const constraint = nodeConstraintExtension.constraint;
                let type: string | undefined, axis: [number, number, number] | undefined;
                if ('roll' in constraint) {
                    type = 'roll';
                    axis = VRM_ROLL_AXES[constraint.roll.rollAxis as string];
                } else if ('aim' in constraint) {
                    type = 'aim';
                    axis = VRM_AIM_AXES[constraint.aim.aimAxis as string];
                } else if ('rotation' in constraint) {
                    type = 'rotation';
                }

                if (type) {
                    const source = this.engine.scene.wrap(
                        idMapping[constraint[type].source]
                    );
                    this._nodeConstraints.push({
                        type,
                        source,
                        destination: object,
                        axis: axis,
                        weight: constraint[type].weight,
                        /* Rest pose */
                        destinationRestLocalRotation: object.getRotationLocal(
                            quat.create()
                        ),
                        sourceRestLocalRotation: source.getRotationLocal(quat.create()),
                        sourceRestLocalRotationInv: quat.invert(
                            quat.create(),
                            source.getRotationLocal(this._tempQuat)
                        ),
                    });
                } else {
                    console.warn(
                        'Unrecognized or invalid VRMC_node_constraint, ignoring it'
                    );
                }
            }

            for (const child of object.children) {
                traverse(child);
            }
        };
        traverse(this.object);
    }

    private _parseAndInitializeSpringBones(springBone: any, idMapping: number[]): void {
        const colliders: SpringChainCollider[] = (springBone.colliders || []).map(
            (collider: any, i: number) => {
                const shapeType = 'capsule' in collider.shape ? 'capsule' : 'sphere';
                return {
                    id: i,
                    object: this.engine.scene.wrap(idMapping[collider.node]),
                    shape: {
                        isCapsule: shapeType === 'capsule',
                        radius: collider.shape[shapeType].radius,
                        offset: collider.shape[shapeType].offset,
                        tail: collider.shape[shapeType].tail,
                    },
                    cache: {
                        head: vec3.create(),
                        tail: vec3.create(),
                    },
                };
            }
        );
        this._sphereColliders = colliders.filter((c) => !c.shape.isCapsule);
        this._capsuleColliders = colliders.filter((c) => c.shape.isCapsule);

        const colliderGroups: {name: string; colliders: SpringChainCollider[]}[] = (
            springBone.colliderGroups || []
        ).map((group: any) => ({
            name: group.name,
            colliders: group.colliders.map((c: number) => colliders[c]),
        }));

        for (const spring of springBone.springs) {
            const joints: SpringJoint[] = [];
            for (const joint of spring.joints) {
                const springJoint: SpringJoint = {
                    hitRadius: 0.0,
                    stiffness: 1.0,
                    gravityPower: 0.0,
                    gravityDir: [0.0, -1.0, 0.0],
                    dragForce: 0.5,
                    node: null as any,
                    state: null,
                };
                Object.assign(springJoint, joint);
                springJoint.node = this.engine.scene.wrap(idMapping[joint.node]);
                joints.push(springJoint);
            }

            const springChainColliders: SpringChainCollider[] = (
                spring.colliderGroups || []
            ).flatMap((cg: number) => colliderGroups[cg].colliders);
            this._springChains.push({
                name: spring.name,
                center: spring.center
                    ? this.engine.scene.wrap(idMapping[spring.center])
                    : null,
                joints,
                sphereColliders: springChainColliders.filter((c) => !c.shape.isCapsule),
                capsuleColliders: springChainColliders.filter((c) => c.shape.isCapsule),
            });
        }

        /* Initialize spring bone joint state */
        for (const springChain of this._springChains) {
            for (let i = 0; i < springChain.joints.length - 1; ++i) {
                const springBoneJoint = springChain.joints[i];
                const childSpringBoneJoint = springChain.joints[i + 1];

                const springBonePosition = springBoneJoint.node.getPositionWorld(
                    vec3.create()
                );
                const childSpringBonePosition = childSpringBoneJoint.node.getPositionWorld(
                    vec3.create()
                );
                const boneDirection = vec3.subtract(
                    this._tempV3A,
                    springBonePosition,
                    childSpringBonePosition
                );
                const state: SpringJointState = {
                    prevTail: vec3.copy(vec3.create(), childSpringBonePosition),
                    currentTail: vec3.copy(vec3.create(), childSpringBonePosition),
                    initialLocalRotation: springBoneJoint.node.getRotationLocal(
                        quat.create()
                    ),
                    initialLocalTransformInvert: quat2.invert(
                        quat2.create(),
                        springBoneJoint.node.getTransformLocal(this._tempQuat2)
                    ),
                    boneAxis: vec3.normalize(
                        vec3.create(),
                        childSpringBoneJoint.node.getPositionLocal(this._tempV3)
                    ),
                    /* Ensure bone length is at least 1cm to avoid jittery behaviour from zero-length bones */
                    boneLength: Math.max(0.01, vec3.length(boneDirection)),
                    /* Tail positions in center space, if needed */
                    prevTailCenter: null,
                    currentTailCenter: null,
                };

                if (springChain.center) {
                    state.prevTailCenter = springChain.center.transformPointInverseWorld(
                        vec3.create(),
                        childSpringBonePosition
                    ) as vec3;
                    state.currentTailCenter = vec3.copy(
                        vec3.create(),
                        childSpringBonePosition
                    );
                }

                springBoneJoint.state = state;
            }
        }
    }

    update(dt: number) {
        if (!this._initialized) {
            return;
        }

        /* 1. Resolve humanoid bones (performed by user) */
        /* 2. Resolve LookAt (bone type) as the position of the head is determined */
        this._resolveLookAt();
        /* 3. Expression update (TODO) */
        /* 4. Apply Expression (TODO) */
        /* 5. Resolve constraints */
        this._resolveConstraints();
        /* 6. Resolve Spring Bone */
        this._updateSpringBones(dt);
    }

    private _rangeMap(rangeMap: LookAtRangeMap, input: number): number {
        const maxValue = rangeMap.inputMaxValue;
        const outputScale = rangeMap.outputScale;
        return (Math.min(input, maxValue) / maxValue) * outputScale;
    }

    private _resolveLookAt(): void {
        if (!this._lookAt || !this.lookAtTarget) {
            return;
        }

        const lookAtSource = this.bones.head!.transformPointWorld(
            this._tempV3A,
            this._lookAt.offsetFromHeadBone
        );

        const lookAtTarget = this.lookAtTarget.getPositionWorld(this._tempV3B);
        const lookAtDirection = vec3.sub(this._tempV3A, lookAtTarget, lookAtSource);
        vec3.normalize(lookAtDirection, lookAtDirection);

        /* Convert the direction into LookAt space */
        this.bones.head!.parent!.transformVectorInverseWorld(lookAtDirection);
        const z = vec3.dot(lookAtDirection, ForwardVector);
        const x = vec3.dot(lookAtDirection, RightVector);
        const yaw = Math.atan2(x, z) * Rad2Deg;

        const xz = Math.sqrt(x * x + z * z);
        const y = vec3.dot(lookAtDirection, UpVector);
        let pitch = Math.atan2(-y, xz) * Rad2Deg;

        /* Limit pitch */
        if (pitch > 0) {
            pitch = this._rangeMap(this._lookAt.verticalDown, pitch);
        } else {
            pitch = -this._rangeMap(this._lookAt.verticalUp, -pitch);
        }

        /* Left eye (limit yaw) */
        if (this.bones.leftEye) {
            let yawLeft = yaw;
            if (yawLeft > 0) {
                yawLeft = this._rangeMap(this._lookAt.horizontalInner, yawLeft);
            } else {
                yawLeft = -this._rangeMap(this._lookAt.horizontalOuter, -yawLeft);
            }

            const eyeRotation = quat.fromEuler(this._tempQuatA, pitch, yawLeft, 0);
            this.bones.leftEye.setRotationLocal(
                quat.multiply(eyeRotation, this.restPose.leftEye, eyeRotation)
            );
        }

        /* Right eye (limit yaw) */
        if (this.bones.rightEye) {
            let yawRight = yaw;
            if (yawRight > 0) {
                yawRight = this._rangeMap(this._lookAt.horizontalOuter, yawRight);
            } else {
                yawRight = -this._rangeMap(this._lookAt.horizontalInner, -yawRight);
            }

            const eyeRotation = quat.fromEuler(this._tempQuatA, pitch, yawRight, 0);
            this.bones.rightEye.setRotationLocal(
                quat.multiply(eyeRotation, this.restPose.rightEye, eyeRotation)
            );
        }
    }

    private _resolveConstraints(): void {
        for (const nodeConstraint of this._nodeConstraints) {
            this._resolveConstraint(nodeConstraint);
        }
    }

    private _resolveConstraint(nodeConstraint: any): void {
        const dstRestQuat = nodeConstraint.destinationRestLocalRotation;
        const srcRestQuatInv = nodeConstraint.sourceRestLocalRotationInv;
        const targetQuat = quat.identity(this._tempQuatA);

        switch (nodeConstraint.type) {
            case 'roll':
                {
                    const deltaSrcQuat = quat.multiply(
                        this._tempQuatA,
                        srcRestQuatInv,
                        nodeConstraint.source.rotationLocal
                    );

                    /* source to parent */
                    const deltaSrcQuatInParent = quat.multiply(
                        this._tempQuatA,
                        nodeConstraint.sourceRestLocalRotation,
                        deltaSrcQuat
                    );
                    quat.mul(deltaSrcQuatInParent, deltaSrcQuatInParent, srcRestQuatInv);

                    /* parent to destination */
                    const dstRestQuatInv = quat.invert(this._tempQuatB, dstRestQuat);
                    const deltaSrcQuatInDst = quat.multiply(
                        this._tempQuatB,
                        dstRestQuatInv,
                        deltaSrcQuatInParent
                    );
                    quat.multiply(deltaSrcQuatInDst, deltaSrcQuatInDst, dstRestQuat);

                    const toVec = vec3.transformQuat(
                        this._tempV3A,
                        nodeConstraint.axis,
                        deltaSrcQuatInDst
                    );
                    const fromToQuat = quat.rotationTo(
                        this._tempQuatA,
                        nodeConstraint.axis,
                        toVec
                    );

                    quat.mul(
                        targetQuat,
                        dstRestQuat,
                        quat.invert(this._tempQuat, fromToQuat)
                    );
                    quat.mul(targetQuat, targetQuat, deltaSrcQuatInDst);
                }
                break;
            case 'aim':
                {
                    const dstParentWorldQuat =
                        nodeConstraint.destination.parent!.rotationWorld;
                    /* fromVec = aimAxis.applyQuaternion( dstParentWorldQuat * dstRestQuat ) */
                    const fromVec = vec3.transformQuat(
                        this._tempV3A,
                        nodeConstraint.axis,
                        dstRestQuat
                    );
                    vec3.transformQuat(fromVec, fromVec, dstParentWorldQuat);
                    /* toVec = ( srcWorldPos - dstWorldPos ).normalized */
                    const toVec = nodeConstraint.source.getTranslationWorld(this._tempV3B);
                    vec3.sub(
                        toVec,
                        toVec,
                        nodeConstraint.destination.getTranslationWorld(this._tempV3)
                    );
                    vec3.normalize(toVec, toVec);

                    /* fromToQuat = Quaternion.fromToRotation( fromVec, toVec ) */
                    const fromToQuat = quat.rotationTo(this._tempQuatA, fromVec, toVec);

                    quat.mul(
                        targetQuat,
                        quat.invert(this._tempQuat, dstParentWorldQuat),
                        fromToQuat
                    );
                    quat.mul(targetQuat, targetQuat, dstParentWorldQuat);
                    quat.mul(targetQuat, targetQuat, dstRestQuat);
                }
                break;
            case 'rotation':
                {
                    const srcDeltaQuat = quat.mul(
                        targetQuat,
                        srcRestQuatInv,
                        nodeConstraint.source.rotationLocal
                    );
                    quat.mul(targetQuat, dstRestQuat, srcDeltaQuat);
                }
                break;
        }

        /* Apply constraint */
        quat.slerp(targetQuat, dstRestQuat, targetQuat, nodeConstraint.weight);
        nodeConstraint.destination.rotationLocal = targetQuat;
    }

    private _updateSpringBones(dt: number): void {
        /* Pre-compute collider positions */
        this._sphereColliders.forEach(({object, shape, cache}) => {
            const offset = vec3.copy(cache.head, shape.offset);
            object.transformVectorWorld(offset);
            vec3.add(cache.head, object.getPositionWorld(this._tempV3), offset);
        });
        this._capsuleColliders.forEach(({object, shape, cache}) => {
            const shapeCenter = object.getPositionWorld(this._tempV3A);
            const headOffset = vec3.copy(cache.head, shape.offset);
            object.transformVectorWorld(headOffset);
            vec3.add(cache.head, shapeCenter, headOffset);

            const tailOffset = vec3.copy(cache.tail, shape.tail);
            object.transformVectorWorld(tailOffset);
            vec3.add(cache.tail, shapeCenter, tailOffset);
        });

        /* Update spring chains */
        this._springChains.forEach((springChain: SpringChain) => {
            for (let i = 0; i < springChain.joints.length - 1; ++i) {
                const joint = springChain.joints[i];
                if (!joint.state) continue;
                const parentWorldRotation = joint.node.parent
                    ? joint.node.parent.getRotationWorld(this._tempQuat)
                    : this._identityQuat;

                /* 1. Forces */
                /* inertia = (currentTail - prevTail) * (1.0f - dragForce); */
                const inertia = this._inertia;
                if (springChain.center) {
                    vec3.sub(
                        inertia,
                        joint.state.currentTailCenter!,
                        joint.state.prevTailCenter!
                    );
                    springChain.center.transformVectorWorld(inertia);
                } else {
                    vec3.sub(inertia, joint.state!.currentTail, joint.state!.prevTail);
                }
                vec3.scale(inertia, inertia, 1.0 - joint.dragForce);

                /* stiffness = deltaTime * parentWorldRotation * localRotation * boneAxis * stiffnessForce; */
                const stiffness = vec3.copy(this._stiffness, joint.state!.boneAxis);
                vec3.transformQuat(stiffness, stiffness, joint.state!.initialLocalRotation);
                vec3.transformQuat(stiffness, stiffness, parentWorldRotation);
                vec3.scale(stiffness, stiffness, dt * joint.stiffness);

                /* external = deltaTime * gravityDir * gravityPower; */
                const external = vec3.scale(
                    this._external,
                    joint.gravityDir,
                    dt * joint.gravityPower
                );

                /* nextTail = currentTail + inertia + stiffness + external; */
                const nextTail = vec3.copy(this._tempV3A, joint.state!.currentTail);
                vec3.add(nextTail, nextTail, inertia);
                vec3.add(nextTail, nextTail, stiffness);
                vec3.add(nextTail, nextTail, external);

                /* constrain the length */
                /* nextTail = worldPosition + (nextTail - worldPosition).normalized * boneLength; */
                const worldPosition = joint.node.getPositionWorld(this._tempV3B);
                vec3.sub(nextTail, nextTail, worldPosition);
                vec3.normalize(nextTail, nextTail);
                vec3.scaleAndAdd(nextTail, worldPosition, nextTail, joint.state.boneLength);

                /* 2. Collision with colliders */
                /* Sphere colliders */
                for (const {shape, cache} of springChain.sphereColliders) {
                    let tailToShape = this._tailToShape;

                    const sphereCenter = cache.head;
                    tailToShape = vec3.sub(tailToShape, nextTail, sphereCenter);

                    const radius = shape.radius + joint.hitRadius;
                    const dist = vec3.length(tailToShape) - radius;
                    if (dist < 0.0) {
                        vec3.normalize(tailToShape, tailToShape);
                        vec3.scaleAndAdd(nextTail, nextTail, tailToShape, -dist);

                        /* constraint the length */
                        vec3.sub(nextTail, nextTail, worldPosition);
                        vec3.normalize(nextTail, nextTail);
                        vec3.scaleAndAdd(
                            nextTail,
                            worldPosition,
                            nextTail,
                            joint.state.boneLength
                        );
                    }
                }
                /* Capsule colliders */
                for (const {shape, cache} of springChain.capsuleColliders) {
                    let tailToShape = this._tailToShape;

                    const head = cache.head;
                    const tail = cache.tail;

                    /* Naively start with distance to the head */
                    tailToShape = vec3.sub(tailToShape, nextTail, head);

                    const headToTail = vec3.sub(this._headToTail, tail, head);
                    const dot = vec3.dot(headToTail, tailToShape);
                    if (vec3.squaredLength(headToTail) <= dot) {
                        /* Closest to tail */
                        vec3.sub(tailToShape, nextTail, tail);
                    } else if (dot > 0.0) {
                        /* Closest to middle */
                        vec3.scale(
                            headToTail,
                            headToTail,
                            dot / vec3.squaredLength(headToTail)
                        );
                        vec3.sub(tailToShape, tailToShape, headToTail);
                    }

                    const radius = shape.radius + joint.hitRadius;
                    const dist = vec3.length(tailToShape) - radius;
                    if (dist < 0.0) {
                        vec3.normalize(tailToShape, tailToShape);
                        vec3.scaleAndAdd(nextTail, nextTail, tailToShape, -dist);

                        /* constraint the length */
                        vec3.sub(nextTail, nextTail, worldPosition);
                        vec3.normalize(nextTail, nextTail);
                        vec3.scaleAndAdd(
                            nextTail,
                            worldPosition,
                            nextTail,
                            joint.state.boneLength
                        );
                    }
                }

                /* 3. Applying rotation */
                vec3.copy(joint.state.prevTail, joint.state.currentTail);
                vec3.copy(joint.state.currentTail, nextTail);
                if (springChain.center) {
                    vec3.copy(joint.state.prevTailCenter!, joint.state.currentTailCenter!);
                    vec3.copy(joint.state.currentTailCenter!, nextTail);
                    springChain.center.transformPointInverseWorld(
                        joint.state.currentTailCenter!
                    );
                }

                /* to = (nextTail * (node.parent.worldMatrix * initialLocalMatrix).inverse).normalized */
                joint.node.parent!.transformPointInverseWorld(nextTail);
                const nextTailDualQuat = quat2.fromTranslation(this._tempQuat2, nextTail);
                quat2.multiply(
                    nextTailDualQuat,
                    joint.state.initialLocalTransformInvert,
                    nextTailDualQuat
                );
                quat2.getTranslation(nextTail, nextTailDualQuat);
                vec3.normalize(nextTail, nextTail);
                /* node.rotation = initialLocalRotation * Quaternion.fromToQuaternion(boneAxis, to); */
                const jointRotation = quat.rotationTo(
                    this._tempQuatA,
                    joint.state.boneAxis,
                    nextTail
                );
                joint.node.setRotationLocal(
                    quat.mul(
                        this._tempQuatA,
                        joint.state.initialLocalRotation,
                        jointRotation
                    )
                );
            }
        });
    }

    /**
     * @param firstPerson Whether the model should render for first person or third person views
     */
    set firstPerson(firstPerson: boolean) {
        this._firstPersonAnnotations.forEach((annotation) => {
            const visible =
                firstPerson == annotation.firstPerson ||
                firstPerson != annotation.thirdPerson;
            annotation.node.getComponents('mesh').forEach((mesh) => {
                mesh.active = visible;
            });
        });
    }
}
