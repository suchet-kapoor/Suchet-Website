# Suchet Kapoor — personal site

A fast, no-build personal site for writing about backend systems, databases and processors.

Plain HTML, CSS and a little vanilla JavaScript. No framework, no bundler, no external fonts, no tracking.

## Pages

| Path | What it is |
| --- | --- |
| `/` | Intro, latest writing, about preview, contact |
| `/about/` | Experience, highlights, projects, stack |
| `/articles/arm-vs-x86/` | Interactive visual explainer: ARM vs x64 |
| `/articles/connection-pools/` | Database connection-pool sizing |

## Local preview

```bash
python -m http.server 4173
```

Then open <http://localhost:4173>. Any static file server works.

## Editing

- `assets/css/site.css` — all shared styling, palette and responsive rules.
- `assets/js/site.js` — theme toggle, reading progress, reading time, auto table of contents, copy-link.
- `assets/img/` — the illustrated portrait (About page) and avatar (hero panel and article bylines).
- Dark mode is the default; the header toggle stores the choice in `localStorage`.
- Article pages use the `.prose` wrapper. Headings are auto-linked into the “On this page” table of contents.
- The featured project card lives in `about/index.html`; its styles are the `.project-card` rules in `assets/css/site.css`.
- The interactive article illustrations keep their own scoped CSS and script inside `articles/arm-vs-x86/index.html`.

## Deploy

Push to `main`. `.github/workflows/pages.yml` deploys the repo root to GitHub Pages.

## Design notes

- Shared max-width, spacing and type scale via CSS custom properties.
- Sticky translucent header, visible focus states, skip link, reduced-motion support, print styles.
- Light mode uses a brighter gradient for primary buttons; content colours stay contrast-safe in both themes.
