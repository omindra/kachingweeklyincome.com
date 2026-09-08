# kachingweeklyincome.com

Public, read-only static dashboard for the Kaching weekly-income options
strategy — mirrors two pages from the `prealerts` app (Kaching Scanner +
the real KaChing dashboard's Active Diagonal Plans/universe badges,
**not** positions or P&L — see the saved project plan for why).

## Structure

```
src/
├── index.html   — dashboard (Scanner + Active Plans tabs)
├── help.html    — Help & Glossary page
├── app.js       — fetch + render logic (no backend calls other than the
│                  two JSON files below; no login, no writes)
├── style.css    — all styling, self-contained (no external deps)
├── content/
│   └── help-draft.md  — source copy for help.html (plain-language,
│                         see the file's own header for the copyright
│                         reasoning behind why it's written the way it is)
└── data/
    ├── kaching-scanner.sample.json  — LOCAL PREVIEW ONLY, hand-built
    │                                  from real DB rows for visual QA.
    │                                  Not deployed; the real
    │                                  kaching-scanner.json is written by
    │                                  KachingExportService in the
    │                                  prealerts repo, published to S3.
    └── kaching-plans.sample.json    — same, for the Active Plans tab.
```

## How data actually gets here

`app.js` fetches `./data/kaching-scanner.json` and `./data/kaching-plans.json`
relative to wherever `index.html` is served from. In production those two
files are objects in the S3 bucket this site is hosted from/behind
(written on a schedule by `KachingExportService`, prealerts repo) — they
are NOT part of this git repo and NOT committed here. The `.sample.json`
files above are for local preview only (open `src/index.html` directly,
or swap the fetch paths in `app.js` temporarily) — see each file's
"sample" suffix.

## Deploying

See the saved project plan (Claude memory: `kaching-static-site-plan`)
for the full S3 + CloudFront + ACM + DNS setup. Short version: `aws s3
sync src/ s3://<bucket>/` for site-code changes; the two JSON data files
publish themselves automatically once `KachingExportService` is enabled.
