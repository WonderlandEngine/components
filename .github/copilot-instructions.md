# Wonderland Engine Code Guidelines

## Effective Use of TypeScript Features

-   Use OOP priciples: make class members as private as possible(encapsulation)

## Code formatting

-   use 4 spaces, no tabs
-   Never omit braces, even when it's one line.
-   use `getComponents(MeshComponent)` with a type, instead `getComponents('mesh')` with a string.
-   Use LowerCamelCase for variable, function, and property names: TypeScript is case-sensitive. By convention, use lowerCamelCase for variables, functions, and properties.
-   private variables, functions etc start with an `_`. This is because the private keyword does not exist in JavaScript. The `_` naming convention is common in JavaScript to indicate variables etc are private.

Example:

```typescript
let myVariable: number;
function myFunction() {}
class MyClass {
    private _myProperty: string;
}
```

-   Use UpperCamelCase (PascalCase) for class names: The first letter of the identifier and the first letter of each subsequent concatenated word are capitalized.
    Example:

```typescript
class MyAwesomeClass {}
```

-   The only exception to the casing specified above is when you are using a backing field. In this case, keep the name the same as the property, but start this with an `_`.

Example:

```typescript
private _someProperty: false;

get someProperty(): boolean{
 return this._someProperty;
}
```

-   Avoid logic in getters and setters, except for a null/undefined check, or triggering an onChange type event. Always prefer methods when logic is needed. This way other developers know there won't be any side effects.
-   Use const to declare constants: The 'const' keyword indicates that a variable's value will not be changed after it's defined. Always prefer `const` over `let`.
-   Always use a Type Annotation: Specifying the type can help catch bugs earlier in your development process and enables better tooling. When defining variables, no need to be explicit with types when types can be read from the same line.

Example:

```typescript
let age: number;
let minAge = 18;
```

-   Avoid using `any` Type: Using any type may lead to runtime problems as it doesn't enforce any type-checking
-   Use Template strings instead of concatenation
-   Always specify access modifier for methods and properties
-   Try to avoid using void return types
-   Don't export mutable bindings: This goes in line with the idea that functions should not change state without making it clear in their input/output.
-   Keep lines short (80-100 characters) for readability. We use 92 characters to be specific.
-   Add a space before opening brace { in blocks or control structures
-   Always use triple equals === instead of double equals ==. This ensures that you're checking both value equality AND type equality.

## Wonderland Components

-   Always Add and Remove event handlers. Overload the `onActivate` and `onDeactivate` methods from `Component` to make sure everything stays set up correctly.
-   Do not use methods with an event handler, but user Arrow functions assigned to a property.
    Example:

```typescript
onActivate(){
  this.engine.onXRSessionStart.add(this.onSessionStart);
}

onDeactiveate(){
  this.engine.onXRSessionRemove.add(this.onSessionStart);
}

private onSessionStart = (session: XRSession) => {
  // session start implementation
}
```

-   In Start you validate if a property on the component has been set. If not throw an error here. Make sure to include the name of the component in the error and give it a description.
    In this example, there's a check if the `handL` object has been set. It contains the name of the component and a description of what was expected.

```typescript
if (!this.handL) {
    throw new Error('flashlight: Flashlight needs a reference to the left hand');
}
```

-   NEVER reference to children of components by index directly. The order of children can change at any time, breaking your application. You can either use `findByName` or use a reference. Otherwise, make sure you have another way to be certain that you have the right object. For example, sorting them by name, or adding a simple index component and using that.

❌ Incorrect:

```typescript
const someChild = this.object.children[0];
```

✅ Correct:

```typescript
@property.object()
firstChild?:Object3D;
...
const someChild = this.firstChild;
```

-   Don't longer use a global `WL` symbol, but use the API from @wonderlandengine/api instead
-   Create a class that inherits from the API Component class
-   The registration name of the component is now a static property
-   The properties are set on the class, and use a @property decorater. Wonderland properties are always public.

Example:

```typescript
import {Component, Object3D} from '@wonderlandengine/api';
import {property} from '@wonderlandengine/api/decorators.js';

export class SelfDestruct extends Component {
    static TypeName = 'self-destruct';

    /**
     * Time until the object is destroyed
     */
    @property.float(2500)
    timer = 2500;

    start() {
        setTimeout(() => {
            this.object.destroy();
        }, this.timer);
    }
}
```

-   Mark properties that are required with the correct value in the decorator:

```typescript
     @property.texture({required: true})
     arrow!: Texture;
```

Below are some parts of the definitions you should follow when reviewing code.

### Declaration of the property decorator

```typescript
export declare const property: {
    string: (defaultValue?: string | undefined) => ReturnType<typeof propertyDecorator>;
    object: (
        opts?: import('./property.js').PropertyReferenceOptions | undefined
    ) => ReturnType<typeof propertyDecorator>;
    animation: (
        opts?: import('./property.js').PropertyReferenceOptions | undefined
    ) => ReturnType<typeof propertyDecorator>;
    color: (
        r?: number | undefined,
        g?: number | undefined,
        b?: number | undefined,
        a?: number | undefined
    ) => ReturnType<typeof propertyDecorator>;
    float: (defaultValue?: number | undefined) => ReturnType<typeof propertyDecorator>;
    bool: (defaultValue?: boolean | undefined) => ReturnType<typeof propertyDecorator>;
    int: (defaultValue?: number | undefined) => ReturnType<typeof propertyDecorator>;
    enum: (
        values: string[],
        defaultValue?: string | number | undefined
    ) => ReturnType<typeof propertyDecorator>;
    mesh: (
        opts?: import('./property.js').PropertyReferenceOptions | undefined
    ) => ReturnType<typeof propertyDecorator>;
    texture: (
        opts?: import('./property.js').PropertyReferenceOptions | undefined
    ) => ReturnType<typeof propertyDecorator>;
    material: (
        opts?: import('./property.js').PropertyReferenceOptions | undefined
    ) => ReturnType<typeof propertyDecorator>;
    skin: (
        opts?: import('./property.js').PropertyReferenceOptions | undefined
    ) => ReturnType<typeof propertyDecorator>;
    vector2: (
        x?: number | undefined,
        y?: number | undefined
    ) => ReturnType<typeof propertyDecorator>;
    vector3: (
        x?: number | undefined,
        y?: number | undefined,
        z?: number | undefined
    ) => ReturnType<typeof propertyDecorator>;
    vector4: (
        x?: number | undefined,
        y?: number | undefined,
        z?: number | undefined,
        w?: number | undefined
    ) => ReturnType<typeof propertyDecorator>;
};
```

### Declaration of the component class

```typescript
export interface ComponentProto {

    init?: () => void;
    start?: () => void;
    update?: (dt: number) => void;
    onActivate?: () => void;
    onDeactivate?: () => void;
    onDestroy?: () => void;
},
```

The Component class has a few static methods/Properties that are allowed:

```typescript
static TypeName: string;
static InheritProperties?: boolean;
static onRegister?: (engine: WonderlandEngine) => void;
```

#### Performance Considerations

**Do not create Vectors/Quaternions in Update Loop**
For performance reasons, do not create quaternions (quats) or vectors (vec3s) inside the update loop. Instead, reuse constants defined in the global file scope or class scope.
Prefer adding them to the global or file scope, when they are only used in 1 method.
Only make an exception when the quat or vec is used in multiple places, and then create it on construction or definition.
This ensures efficient memory usage and better performance.

-   **Global Scope Reuse Example**:

    ```typescript
    const transformPositionVec = vec3.create();
    const transformPositionVec2 = vec3.create();
    const transformLaneVec = vec3.create();
    const tempQuat = quat.create();

    class ExampleComponent extends Component {
        update(dt: number) {
            // Reuse tempQuat and other vectors here
        }
    }
    ```

````
  - **Class Scope Reuse Example**:
    ```typescript
    class ExampleComponent extends Component {
        private _tempQuat = quat.create();

        update(dt: number) {
            // Reuse _tempQuat here
        }
    }
````

#### Deprecated Properties/Methods

Deprecated Methods and Their Alternatives. Do not use these, only use the alternatives.
Object3D.resetTranslationRotation() => Alternative: Object3D.resetPositionRotation()
Object3D.resetTranslation() => Alternative: Object3D.resetPosition()
Object3D.translate() => Alternative: Object3D.translateLocal()
Object3D.rotateAxisAngleDeg() => Alternative: Object3D.rotateAxisAngleDegLocal()
Object3D.rotateAxisAngleRad() => Alternative: Object3D.rotateAxisAngleRadLocal()
Object3D.rotate() => Alternative: Object3D.rotateLocal()
Object3D.scale() => Alternative: Object3D.scaleLocal()
Object3D.getTranslationLocal() => Alternative: Object3D.getPositionLocal()
Object3D.getTranslationWorld() => Alternative: Object3D.getPositionWorld()
Object3D.setTranslationLocal() => Alternative: Object3D.setPositionLocal()
Object3D.setTranslationWorld() => Alternative: Object3D.setPositionWorld()
Object3D.transformLocal => Alternative: Object3D.getTransformLocal() and Object3D.setTransformLocal()
Object3D.transformWorld => Alternative: Object3D.getTransformWorld() and Object3D.setTransformWorld()
Object3D.scalingLocal => Alternative: Object3D.getScalingLocal() and Object3D.setScalingLocal()
Object3D.scalingWorld => Alternative: Object3D.getScalingWorld() and Object3D.setScalingWorld()
Object3D.rotationLocal => Alternative: Object3D.getRotationLocal() and Object3D.setRotationLocal()
Object3D.rotationWorld => Alternative: Object3D.getRotationWorld() and Object3D.setRotationWorld()
Object3D.getForward() => Alternative: Object3D.getForwardWorld()
Object3D.getUp() => Alternative: Object3D.getUpWorld()
Object3D.getRight() => Alternative: Object3D.getRightWorld()
Component.equals() => Alternative: Use JavaScript reference comparison instead.
new Mesh() => Alternative: Use MeshManager.create instead, accessible via WonderlandEngine.meshes.
Texture.constructor() => Alternative: Use TextureManager.create instead, accessible via WonderlandEngine.textures.
Texture.valid => Alternative: Use SceneResource.isDestroyed instead.
Texture.id => Alternative: Use Texture.index instead.
