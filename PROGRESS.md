# InkMatch Progress

## Completed

- Repository requirements reviewed: `AGENTS.md`, `PROJECT_SPEC.md`, and `ARCHITECTURE.md`.
- Stage 1 confirmed as the current authorized scope.
- Stage 1 scaffolded with React/Vite frontend, FastAPI backend, pinned dependency manifests, and documented local commands.
- Added `/api/v1/health` with a focused backend test.
- Added responsive core editor layout with explicit Stage 1 demo-handwriting labeling.
- Added live source-text preview, source-preserving Equation Mode toggle, local JPG/PNG paper upload validation, physical layout fields, and browser-local template persistence.
- Added deterministic backend physical-mm layout engine and `/api/v1/layout`, including limited exponent/subscript parsing with source ranges, wrapping, and pagination.
- Added `/api/v1/export/pdf` using the same positioned runs, with A4 media-box and no-image tests; connected the frontend export action and 100%-scale print notice.
- Connected the frontend preview to `/api/v1/layout` when the local backend is ready, with a safe local fallback while offline.
- Frontend typecheck, two UI tests, production build, and backend test pass.

## Design decisions

- Follow the documented web-first React/TypeScript + FastAPI architecture.
- Keep the canonical physical-coordinate layout model shared by preview and PDF export.
- Treat demo handwriting as explicitly Stage 1-only; do not claim personal handwriting learning.

## Known issues

- Paper upload currently uses a browser-local object URL; server-side asset registration and safe persistence are next.
- Auto-detection, saved template/document APIs, printer offset controls, richer line-break reconstruction in the preview, and physical print alignment remain incomplete.
- Physical print alignment cannot be verified until the export slice exists and a real A4 sheet is tested.

## Next task

- Stage 1 task 4: add best-effort paper analysis/template APIs and printer offset controls, then complete a real A4 print alignment test.
