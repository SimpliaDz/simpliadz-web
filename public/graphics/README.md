# Simplia graphics library

This folder contains browser-served visual assets. Keep it deliberately small: graphics support orientation, welcoming moments, and empty states; they must not compete with data-dense operational screens.

```text
graphics/
├── brand/          # Product marks and lockups
├── illustrations/  # Larger contextual illustrations (auth, onboarding, welcome)
└── empty-states/   # Compact illustrations for a useful absence of data
```

## Asset rules

- Prefer optimized SVGs. They remain crisp in RTL/LTR layouts, scale cleanly, and avoid a graphics dependency.
- All current assets are original Simplia artwork created for this repository. They may be edited and used in the application without attribution.
- If an external asset is added later, record its source URL and license in this file before committing it. Do not copy graphics from a template or a search result unless its license permits product use.
- Decorative images use `alt=""` and `aria-hidden="true"`; user-facing meaning always remains available as real text.
- Use Material Symbols for functional controls. Illustrations are not a replacement for icons, labels, or status feedback.
