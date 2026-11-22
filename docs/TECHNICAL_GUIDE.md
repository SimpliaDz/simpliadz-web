# SimpliaDz Web — Technical Guide

## 1. Purpose and current scope

SimpliaDz Web is the separate Angular frontend for the SimpliaDz platform. It is intentionally independent from the .NET backend repository: it has its own Git history, dependency lockfile, build pipeline, and deployment configuration.

The project currently establishes a production-minded frontend foundation. It has an application shell, configuration bootstrap, routing, localization, quality tooling, smoke tests, and public authentication pages. Permission-aware navigation beyond the authenticated-route guard, Organization management, and Inventory workflows remain future feature slices.

The backend is a tenant-aware modular monolith. The browser must respect that boundary:

- An API deployment represents one configured tenant; the browser must not send a tenant-selection header.
- The authenticated API remains the authority for roles and permissions. The frontend uses permissions to make the interface clearer, never as a substitute for authorization.
- Inventory keeps products, variants, and stock separate. Products define commercial data; variants are sellable/stockable; stock belongs to a variant at a location.

## 2. Technology choices

| Area                   | Choice                                                 | Reason                                                                             |
| ---------------------- | ------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| Framework              | Angular 22 standalone application                      | Angular-native composition without `NgModule` boilerplate.                         |
| Language               | TypeScript in strict mode                              | Catches unsafe API and UI assumptions early.                                       |
| Package manager        | Yarn 4, `nodeLinker: node-modules`                     | Locked, reproducible installs with broad editor/tool compatibility.                |
| UI primitives          | Angular Material and CDK                               | Accessible, maintained controls and overlays; avoid adding competing UI libraries. |
| Styling                | SCSS plus Material design tokens                       | Product-specific styling without a second CSS framework.                           |
| HTTP                   | Angular `HttpClient` and functional interceptors       | One Angular-native request pipeline for authorization, retry, and errors.          |
| State                  | Signals for local state, feature facades for workflows | Small and explicit; a global state package is not justified yet.                   |
| Forms                  | Typed Reactive Forms                                   | Stable choice for business forms and cross-field validation.                       |
| Unit/component tests   | Vitest plus Angular testing utilities                  | Generated Angular test stack, already running.                                     |
| Browser tests          | Playwright with Chromium                               | Real browser smoke and end-to-end coverage.                                        |
| Localization           | Angular built-in compile-time i18n                     | Extractable, reviewable translation catalogues for English, French, and Arabic.    |
| Continuous integration | GitHub Actions                                         | Installs, lints, tests, and builds every locale on pushes and pull requests.       |

Avoid adding Axios, an alternate router, a second component library, a generic HTTP wrapper, or NgRx by default. Each would duplicate platform capabilities and increase maintenance. Revisit global state only when a real cross-feature synchronization problem appears.

## 3. Directory structure and ownership

```text
src/
├── app/
│   ├── core/                    # Singleton cross-cutting application infrastructure
│   │   ├── config/              # Runtime deployment configuration
│   │   ├── i18n/                # Locale and text-direction bootstrap
│   │   ├── api/                 # Future HTTP API primitives/interceptors
│   │   ├── auth/                # Future session, guards, and permission support
│   │   └── layout/              # Future authenticated shell/navigation
│   ├── features/                # Business features, loaded by route
│   │   └── home/                # Current minimal landing route
│   ├── shared/                  # Reusable UI/utilities with no feature ownership
│   ├── app.config.ts            # Root providers
│   ├── app.routes.ts            # Root route table
│   └── app.ts                   # Root application shell
├── locale/                      # English source + French/Arabic XLIFF catalogues
├── index.html
├── main.ts
└── styles.scss                  # Global Material theme and global CSS

public/
└── config/app-config.json       # Deployment-time API configuration

e2e/                             # Playwright browser tests
docs/                            # Architectural and contributor documentation
.github/workflows/ci.yml         # CI definition
```

The dependency direction is deliberately one-way:

```text
core  ───────────────────────────────► shared
  ▲                                      ▲
  │                                      │
features ───────────────────────────────┘
```

More precisely:

- `core` may be used throughout the app but must never import a feature.
- `shared` contains generic presentation or utility code only. It cannot know about products, permissions, or a specific backend module.
- A feature owns its pages, feature-specific UI, API services, models, and state/facade.
- Presentational components accept input and emit events. Pages/facades orchestrate workflows.

Do not create empty `domain`, `application`, `infrastructure`, or `contracts` folders for every frontend feature. Use a small feature shape only when it has a real need:

```text
features/inventory/brands/
├── data-access/     # Brand API service, DTO mapping, feature facade/state
├── pages/           # Routed list/edit pages
├── ui/              # Brand-specific table/form components
└── models/          # UI-specific models where API DTOs are not enough
```

## 4. Application startup and runtime configuration

`src/main.ts` bootstraps the standalone root component using `appConfig`.

`app.config.ts` provides:

1. Global browser error listeners.
2. `HttpClient` for all API access.
3. Async Angular Material animations.
4. `AppConfigService`, which loads runtime configuration before first render.
5. `LocaleBootstrapService`, which applies the document language and text direction.
6. Angular Router with top-of-page scrolling on navigation.

The startup flow is:

```text
Browser loads index.html
        │
        ▼
Angular bootstrap
        │
        ├── GET /config/app-config.json
        │       └── validates and normalizes apiBaseUrl
        │
        └── applies lang + dir to <html>
                │
                ▼
           renders routed application
```

`public/config/app-config.json` is copied as a static asset. Its initial value is deliberately empty:

```json
{ "apiBaseUrl": "" }
```

For local development it is set to `/api`. `proxy.conf.json` forwards that prefix to `http://localhost:5278` and removes the prefix before sending the request. This avoids a browser CORS dependency during local development. The build copies this file into each localized directory, for example `dist/.../browser/ar/config/app-config.json`. The application deliberately loads `config/app-config.json` relative to the locale base path, so the Arabic build requests `/ar/config/app-config.json` and the French build requests `/fr/config/app-config.json`. A production host must route `/api` to its API origin, or replace this public runtime configuration with an approved API base URL. If the file is absent, the app continues using `/api` and logs a warning rather than rendering a blank page. Do not put credentials, refresh tokens, connection strings, or tenant data in this file. It is public deployment configuration.

Use `yarn start:ar` or `yarn start:fr` to test a localized development build against the local API. These configurations preserve the development server's `/api` proxy. Do not use a generic static server for an authenticated local test unless that server is also configured to proxy `/api` to port `5278`; otherwise the browser receives its `404 Not Found` response instead of reaching the API.

Application code reads configuration through `AppConfigService`; it must not hard-code API origins in feature code. Consumers that build request URLs must read the current `value` when making the request, rather than capturing the pre-bootstrap default configuration. This lets the same compiled bundle move between local, test, and production API environments.

## 5. Routing and feature loading

The root route table lives in `src/app/app.routes.ts`. Two layouts are lazy-loaded:

- `PublicLayoutComponent` (`core/layout/public-layout.component.ts`) wraps `/login`, `/forgot-password` and `/reset-password`, with a brand header and the theme toggle.
- `ShellLayoutComponent` (`core/layout/shell-layout.component.ts`) wraps everything under `/app`, behind `authGuard`. It has a toolbar (navigation toggle, theme toggle, user menu with sign-out) and a sidebar built from `core/layout/navigation.ts`.

Implemented routes, grouped by feature ownership. Each route declares the permissions it needs in `data.permissions` and passes through `permissionGuard` after `authGuard`. The sidebar uses the same permission lists, so a screen is only offered when it can be opened.

```text
Public        /login  /forgot-password  /reset-password
Overview      /app/dashboard
Business      /app/organization                                   organization.view
Catalogue     /app/catalogue/products[/new|/:id|/:id/edit]        products.*
              /app/catalogue/products/:id/variants/new            variants.create
              /app/catalogue/variants/:id                         variants.view
              /app/catalogue/brands | categories | attributes[/:id]
Inventory     /app/inventory/locations[/new|/:id/edit]            locations.*
              /app/inventory/price-lists                          price-lists.view
              /app/inventory/stock | stock/movements | stock/policies   stock.view
              /app/inventory/transfers[/:id]                      stock.view
              /app/inventory/counts[/:id]                         stock.view
              /app/inventory/warnings                             inventory-warnings.view
              /app/inventory/documents                            inventory-documents.view
              /app/inventory/labels                               barcode-labels.view
Purchasing    /app/purchasing/suppliers                           suppliers.view
              /app/purchasing/orders[/:id]                        purchase-orders.view
Sales         /app/sales/sales[/:id]                              sales.view
              /app/sales/customers                                customers.view
              /app/sales/cash/registers                           cash-registers.view
              /app/sales/cash/sessions[/:id]                      cash-sessions.view
Accounting    /app/accounting/expenses                            expenses.view + expense-categories.view
              /app/accounting/expense-categories                  expense-categories.view
Workforce     /app/workforce/clock                                (any signed-in user)
              /app/workforce/sessions                             work-sessions.view
              /app/workforce/report                               work-sessions.report
Admin         /app/administration/users[/new|/:id]                users.view / users.create
              /app/administration/roles[/:id]                     roles.view
Account       /app/account/profile                                (any signed-in user)
              /app/account/security                               (any signed-in user)
Status        /app/forbidden   /app/** (not found)
```

Feature folders follow the recipe in section 12: `data-access/` owns HTTP and DTOs, `pages/` orchestrates, `ui/` holds dialogs. Cross-feature imports are limited to the same business module (for example products reading brands from catalogue).

Permission checks are UX only; the API enforces every request.

The sidebar lists an entry only when its screen exists and its permissions are held. Add navigation entries in the same change that adds the route.

Keep the public landing/login routes small and eagerly accessible. Lazy-load large authenticated areas once they have real screens. Do not add multiple nested lazy boundaries without measuring the resulting navigation cost.

## 6. API and authentication

Authentication is the first implemented API slice. Its public pages are lazy-loaded under `/login`, `/forgot-password`, and `/reset-password`; `/app` is protected by `authGuard`. An unauthenticated visitor is redirected to login with a safe `/app` return URL.

| Method | Route                   | Request / response use                                                       |
| ------ | ----------------------- | ---------------------------------------------------------------------------- |
| `POST` | `/auth/login`           | `{ email, password }` → access token, refresh token, expiries, email, roles. |
| `POST` | `/auth/refresh`         | `{ refreshToken }` → rotated token pair.                                     |
| `POST` | `/auth/logout`          | `{ refreshToken }` → `204 No Content`.                                       |
| `GET`  | `/auth/me`              | Current user ID, email, roles, permissions, and saved `languageCode`.         |
| `PUT`  | `/auth/me/language`     | `{ languageCode: "en" | "fr" | "ar" }` → saved language code.             |
| `POST` | `/auth/forgot-password` | `{ email }` → development-only reset token.                                  |
| `POST` | `/auth/reset-password`  | `{ email, resetToken, newPassword }` → `204 No Content`.                     |

`AuthSessionService` owns the access token (memory only), the current user, and the refresh token. Login and refresh use a raw `HttpClient` backed by `HttpBackend` so they cannot recurse through interceptors; after each token response, `/auth/me` loads authoritative roles, permissions, and the saved language. It exposes `hasPermission` and `hasAllPermissions` for UX checks.

The HTTP structure is:

```text
core/api/
├── api-error.ts                 # toApiError(): normalizes both backend error shapes for forms and alerts
├── api-url.service.ts           # Combines runtime apiBaseUrl with relative paths
└── interceptors/
    ├── auth.interceptor.ts      # Adds access-token bearer header
    └── refresh.interceptor.ts   # One refresh attempt after a 401; on failure clears the session and goes to login
```

Functional interceptors are registered in `app.config.ts` as `withInterceptors([authInterceptor, refreshInterceptor])`; that order is commented beside the registration. Keep retry rules conservative: do not retry writes by default.

`toApiError` understands both shapes the backend returns: the global handler's `{ error, message, errors: [{ propertyName, errorMessage }] }` and the problem-style `{ title, errors: { Key: [msg] } }`. Field keys come back lower-camel-cased so they match Reactive Form control names.

The implemented authentication flow is:

1. Login calls the backend’s public login endpoint. If loading `/auth/me` then fails, the half-established session is cleared.
2. The access token stays in memory. The refresh token is kept in `sessionStorage` under `simpliadz.refreshToken`, so a reload can restore the session.
3. `authGuard` calls `restore()`, which refreshes once from the stored refresh token when no access token is in memory. A failed restore signs the user out.
4. Add the access token only to requests that target the configured API origin.
5. Coordinate a single refresh request when an eligible protected request receives a 401; concurrent requests share that refresh.
6. On refresh failure, clear session state and navigate to `/login?returnUrl=…`.
7. Logout always clears local state, even if its server call fails, and revokes the refresh token on the server.
8. Changing the password revokes every session on the backend, so the UI clears local state and asks the user to sign in again.

Storage trade-off: `sessionStorage` survives a reload but is readable by any script running in the page, and it is cleared when the tab closes. It was chosen over `localStorage` (which would persist across tabs and restarts) and over in-memory-only (which logs users out on every reload). The preferred long-term design remains a Secure, HttpOnly, SameSite refresh cookie issued by the API or a BFF; the UI can adopt it without rewriting features.

Never send a tenant header. The backend selects the active tenant per API deployment and binds JWTs to it.

## 7. State, forms, and UI conventions

Use the smallest state mechanism that makes a feature understandable:

- Component-only transient state: private signals in the component.
- One-page async state: a feature facade/service holding signals such as `isLoading`, `error`, and `items`.
- Shared state inside a business feature: one feature facade provided at the feature route level.
- Cross-feature global state: propose it explicitly with an example before adding a store library.

Use `computed` signals for derived values and keep side effects narrow. HTTP requests remain `HttpClient` observables at the data-access boundary; convert them to promises/signals only where it improves the page or facade API.

Business forms use typed Reactive Forms. Server errors must be mapped into visible form or page errors; do not expose raw HTTP error objects in templates. Client validation improves feedback but never replaces the backend’s FluentValidation/domain validation.

Use Angular Material/CDK controls before introducing a third-party control. Build small reusable wrappers in `shared/ui` only after repeated, stable patterns emerge.

## 8. Localization and RTL

English (`en-US`) is the source locale. The source catalogue is `src/locale/messages.xlf`. French and Arabic translations live in `messages.fr.xlf` and `messages.ar.xlf`.

Angular produces separate optimized outputs for:

```text
dist/simpliadz-web/browser/
├── en-US/
├── fr/
└── ar/
```

When adding user-visible template text:

1. Mark it with Angular’s `i18n` attribute and a stable custom ID where appropriate.
2. Run `yarn i18n:extract`.
3. Review the updated English source catalogue.
4. Update the French and Arabic `target` values.
5. Run `yarn build` to validate every localized output.

Do not translate product identifiers, permission keys, API field names, or backend error codes. Translate user-facing labels, descriptions, empty states, confirmations, and actionable error messages.

Arabic is a right-to-left language. `LocaleBootstrapService` sets `dir="rtl"` for the Arabic build. Use logical CSS properties for layout-sensitive CSS:

```scss
// Preferred: automatically correct in both LTR and RTL
padding-inline: 1rem;
margin-inline-start: 0.5rem;
border-inline-start: 1px solid var(--mat-sys-outline);

// Avoid unless direction is intentionally fixed
padding-left: 1rem;
margin-right: 0.5rem;
```

Language is a user preference, managed from Account › Profile. The Profile page saves `en`, `fr`, or `ar` through `PUT /auth/me/language`; after any login, session refresh, or preference update, `LanguagePreferenceService` compares the saved value with the current compiled locale. If they differ, it performs a full navigation to the matching localized build while preserving the current route, query string, and hash: English uses `/`, French `/fr/`, and Arabic `/ar/`. A full navigation is intentional because Angular compile-time i18n cannot safely replace every translated message in an already-running bundle.

Credentials and other machine-readable identifiers are an exception: email addresses, passwords, reset tokens, SKUs, barcodes, and API keys must use `dir="ltr"` and the shared `auth-credential-input` class. This ensures mixed punctuation such as `Admin123!` is entered and displayed left-to-right inside an RTL page.

## 9. Light and dark theme

Angular Material provides the color tokens used by both the application shell and Material controls. `ThemeService` selects a `light` or `dark` color scheme by setting `data-theme` on the root HTML element; the global CSS changes `color-scheme` accordingly. A header icon button toggles the theme and stores the user choice in local storage under `simpliadz.theme`.

Use Material system tokens such as `--mat-sys-surface`, `--mat-sys-on-surface`, and `--mat-sys-outline-variant` for application-level colors. Do not add per-component `.dark` selectors or hard-coded light colors unless a visual exception is intentionally documented. This keeps custom UI aligned with Material controls in both themes.

## 10. Testing and quality gates

Run these commands locally before opening a pull request:

```bash
yarn install --immutable
yarn lint
yarn test --watch=false
yarn build
yarn e2e
```

`yarn build` validates English, French, and Arabic output. `yarn e2e` starts the local Angular development server and runs the Playwright Chromium smoke test. Playwright browser binaries are installed with `yarn playwright install`.

Test responsibility is layered:

| Test type    | Use for                                                                                                                                  |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Unit         | Pure mapping, state, permissions, validation helpers, and URL creation.                                                                  |
| Service/HTTP | Request method/URL/body, API response mapping, and error normalization via Angular HTTP testing utilities.                               |
| Component    | Form behavior, visible permissions, emitted events, accessibility semantics, and localized text.                                         |
| E2E          | Login/session behavior, protected navigation, a small number of critical CRUD workflows, and a smoke check for the deployed application. |

Do not write a browser test for every component. Use E2E tests for cross-browser, integration-critical behavior; keep the majority of logic covered by fast unit and component tests.

GitHub Actions in `.github/workflows/ci.yml` repeats install, lint, tests, and build on pushes and pull requests. It is the required quality gate; local pre-commit automation is optional convenience, not the source of truth.

## 11. Git and dependency rules

- Use Yarn only. `yarn.lock` is committed; `package-lock.json` must never be added.
- Use `yarn install --immutable` in CI and on a clean checkout to catch lockfile drift.
- Keep `node_modules`, Angular caches, Playwright reports, and test results untracked.
- Keep commits focused: tooling, a single feature slice, tests, and documentation updates should be reviewable as a coherent change.
- Do not commit API keys, token values, tenant secrets, or production runtime configuration.

## 12. Adding a new feature: recommended recipe

For a new Inventory feature such as Brands:

1. Confirm the backend contract and permissions from backend documentation and Swagger before creating types or routes.
2. Add a lazy feature route under the authenticated application route.
3. Create the feature folders only as needed: `data-access`, `pages`, `ui`, `models`.
4. Put backend DTOs and HTTP calls in `data-access`; do not call `HttpClient` from a display component.
5. Create a facade when pages need shared loading/error/data state.
6. Build typed forms for create/edit operations.
7. Check the current user’s permissions for navigation and action visibility; rely on the API for real enforcement.
8. Add unit/service/component tests and one E2E test only when the workflow is critical.
9. Mark new UI copy for localization, refresh XLIFF files, and verify the Arabic layout.
10. Update this guide if the feature introduces a new cross-cutting pattern.

## 13. Current decisions and intentional deferrals

| Decision                                                                         | Status                                                                    |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Standalone Angular, strict TypeScript, Yarn 4                                    | Implemented                                                               |
| Angular Material/CDK and global Material theme                                   | Implemented                                                               |
| Persisted light/dark theme toggle using Material color schemes                   | Implemented                                                               |
| Runtime API configuration                                                        | Implemented; API URL is deployment-provided                               |
| English/French/Arabic build-time localization and RTL bootstrap                  | Implemented                                                               |
| ESLint, Prettier, Vitest, Playwright, CI                                         | Implemented                                                               |
| Functional auth/refresh interceptors, public auth pages, guards, session restore | Implemented                                                               |
| Authenticated shell: toolbar, permission-filtered sidebar, user menu, sign-out   | Implemented                                                               |
| Change password, dashboard overview, forbidden and not-found pages               | Implemented                                                               |
| Permission guard and `*appHasPermission` directive (UX only)                     | Implemented                                                               |
| API capability matrix                                                            | Implemented — see `docs/api-capability-matrix.md`                         |
| Organization, catalogue, inventory and administration screens (see routes above) | Implemented — list, create, edit and deactivate where the API allows      |
| Reports, audit log and dashboard figures                                         | Implemented — sales, products, inventory, low stock, audit, today         |
| OpenAPI TypeScript generation                                                    | Deferred pending a compatible generator and confirmed API contract source |
| Global state library                                                             | Deferred until a demonstrated cross-feature need                          |
| SSR, PWA                                                                        | Deferred pending concrete product requirements                            |
| Saved user language preference and locale-build navigation                       | Implemented — Account › Profile persists `en`, `fr`, or `ar`             |

The goal is a frontend that grows by adding small, cohesive feature slices—not by pre-building an elaborate framework before the product needs it.
