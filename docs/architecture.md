# Frontend architecture

SimpliaDz Web is a standalone Angular application organized by business feature.

## Structure

```text
src/app/
  core/       # Singleton application infrastructure: API, auth, config, layout.
  shared/     # Reusable UI and utility code with no business ownership.
  features/   # Lazy-loaded business capabilities matching active API modules.
```

Each feature may contain `data-access`, `pages`, `ui`, and `models` folders when it needs them. Do not create empty layers by default.

## Boundary rules

- `core` code may be used everywhere, but must not depend on a feature.
- `shared` code has no knowledge of a particular business module.
- A feature owns its API calls, state/facade, routes, pages, and local UI.
- Presentational UI emits events; pages and facades coordinate workflows.
- Backend permissions improve UI navigation and actions; API authorization remains authoritative.

## Backend alignment

Implemented API modules map to Identity, Organization, and Inventory features. Inventory is organized around products, variants, categories, brands, attributes, locations, and price lists. A product never owns stock quantity; variants are stockable and quantities are location-aware.

## Shell and template adaptation

The authenticated experience follows the Sneat template's layout language, rebuilt with Angular Material (no Bootstrap, jQuery or second UI library):

- Sidebar: 260px (16.25rem) docked from 1200px up, an overlay below that. The active item has a tinted background and a trailing 4px indicator, written with logical properties so it flips in Arabic.
- Toolbar: sticky, with the navigation toggle, theme toggle and a user menu. The menu shows the signed-in email and roles, links to security, and signs out.
- Content: centred, 72rem maximum width, with page headers using the Material headline type scale.
- Colours, radii and elevation come from Material system tokens, so light and dark themes stay aligned. Sneat's free edition has no dark theme, so dark values are Material's own.
- Icons: Material Symbols (already loaded), not the template's Boxicons. The Sneat free edition is MIT-licensed; its copyright notice must be kept in any copied assets.

Not carried over from the template: demo illustrations, third-party brand logos, upsell buttons, and jQuery/ApexCharts widgets.

## Runtime configuration

`public/config/app-config.json` is fetched before the application is rendered. It supplies the API base URL, allowing one compiled frontend build to be deployed against different API environments. It is deployment configuration, not a place for secrets or tenant selection.

## Localization

English (`en-US`) is the source locale. French (`fr`) and Arabic (`ar`) translations are compiled as separate production outputs using Angular’s built-in localization system. This keeps translated content statically analyzable and avoids a runtime translation framework.

Mark user-facing template text with Angular `i18n` attributes and run `yarn i18n:extract` whenever English source copy changes. Translate only `messages.fr.xlf` and `messages.ar.xlf`; do not edit the generated English source catalogue. Arabic receives `dir="rtl"` during application bootstrap, so new layouts must use logical CSS properties (`margin-inline`, `padding-inline`, `inset-inline`) when direction matters.
