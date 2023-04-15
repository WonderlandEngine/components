# Wonderland Engine Components

Wonderland Engine's official component library.

Learn more about Wonderland Engine at [https://wonderlandengine.com](https://wonderlandengine.com).

# Versioning

As npm packages only support three digits of [semantic versioning](https://docs.npmjs.com/about-semantic-versioning),
the package version **does not match the editor version**.
Only the first two digits match the editor, the rest should be seen as a "package version".

# Usage

Install the components to your project's package as follows:
```
npm i --save @wonderlandengine/components
```

Wonderland Editor will automatically detect all components in the package add auto-import
those that you use in the scene.

# Development

Start by installing all dependencies:

```
npm install
```

To build the TypeScript code, run the `build:ts` or `build:ts:watch` script:
```
npm run build:ts:watch
```

# Running Tests

Some components have automated tests, you can run them with the `test` and `test:watch` scripts:
```
npm run test:watch
```
