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
