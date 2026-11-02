# SimpliaDz Web

The Angular frontend for SimpliaDz. It is a separate repository from the .NET backend.

## Prerequisites

- Node.js 24 or newer
- Corepack (included with supported Node.js releases)

Enable Corepack once on a new machine, then install the locked dependencies:

```bash
corepack enable
yarn install --immutable
```

This repository pins Yarn in `package.json`; use Yarn rather than npm.

See [the architecture guide](docs/architecture.md) and [the tooling guide](docs/tooling.md) for the project conventions.

## Development server

To start a local development server, run:

```bash
yarn start
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
yarn ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
yarn ng generate --help
```

## Building

To build the project run:

```bash
yarn build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Running unit tests

To execute unit tests with the [Vitest](https://vitest.dev/) test runner, use the following command:

```bash
yarn test --watch=false
```

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
yarn ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.
