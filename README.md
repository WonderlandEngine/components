# Wonderland Engine Components

[![Build & Test](https://github.com/WonderlandEngine/components/actions/workflows/npm-build.yml/badge.svg)](https://github.com/WonderlandEngine/components/actions/workflows/npm-build.yml)
[![NPM Package][npm]](https://www.npmjs.com/package/@wonderlandengine/components)
[![NPM Downloads][npm-downloads]](https://img.shields.io/npm/dw/@wonderlandengine/components)
[![Discord][discord]](https://discord.wonderlandengine.com)

Wonderland Engine's official component library.

Learn more about Wonderland Engine at [https://wonderlandengine.com](https://wonderlandengine.com).

## Usage

Install the components to your project's package as follows (this is already done in most project templates):
```
npm i --save @wonderlandengine/components
```

Wonderland Editor will automatically detect all components in the package and auto-import
those that you use in the scene.

## Development

Start by installing all dependencies:

```
npm install
```

To build the TypeScript code, run the `build` or `build:watch` script:
```
npm run build:watch
```

## Running Tests

Some components have automated tests. You can run them with the `test` and `test:watch` scripts:
```
npm run test:watch
```

To run tests with a specific deploy folder, use the `DEPLOY_FOLDER` environment variable:
```
DEPLOY_FOLDER="../../some/deploy" npm run test:watch
```

## License

Wonderland Engine components TypeScript and JavaScript code is released under MIT license.
The runtime and editor are licensed under the [Wonderland Engine EULA](https://wonderlandengine.com/eula)

[npm]: https://img.shields.io/npm/v/@wonderlandengine/components
[npm-downloads]: https://img.shields.io/npm/dw/@wonderlandengine/components
[discord]: https://img.shields.io/discord/669166325456699392
