# Tooling and quality baseline

## Required local tools

- Node.js 24+
- Corepack, which provides the Yarn version pinned in `package.json`

Use `yarn install --immutable` after cloning. Never generate or commit `package-lock.json`.

## Commands

| Command                   | Purpose                                                                         |
| ------------------------- | ------------------------------------------------------------------------------- |
| `yarn start`              | Serve the English development build.                                            |
| `yarn lint`               | Run Angular-aware ESLint.                                                       |
| `yarn test --watch=false` | Run the Vitest unit/component suite once.                                       |
| `yarn build`              | Produce optimized English, French, and Arabic application builds.               |
| `yarn i18n:extract`       | Rebuild the English source translation catalogue after changing marked UI copy. |
| `yarn e2e`                | Run Playwright tests after browsers are installed.                              |

Install Playwright browsers only when end-to-end tests are introduced:

```bash
yarn playwright install
```

## Rules

- ESLint identifies correctness and Angular template issues; Prettier owns formatting.
- CI runs install, lint, tests, and the localized production build for every push and pull request.
- Angular Material/CDK provides accessible primitives. Reuse it before adding another UI library.
- Use `HttpClient` and functional interceptors for API concerns. Do not add Axios or a generic HTTP wrapper.
- Use signals for local state and feature facades. Add a global store only when an actual cross-feature state problem demands it.

## OpenAPI types

The API contract generator is intentionally deferred. The currently available generator release does not declare compatibility with this project’s TypeScript 6 toolchain, and the backend Swagger URL has not been selected. Re-evaluate it when the development API contract endpoint is ready.
