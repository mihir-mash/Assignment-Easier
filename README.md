# InkMatch

InkMatch is a local-first Stage 1 web editor for positioning typed text on a user's own physical paper. Stage 1 uses an explicitly labeled demo handwriting renderer; it does not learn personal handwriting.

## Run locally

Install frontend dependencies once:

```text
npm install
```

Run the frontend and FastAPI backend together:

```text
npm run dev
```

The frontend runs at `http://localhost:5173` and proxies `/api` to the backend at `http://localhost:8000`.

Checks:

```text
npm run typecheck
npm run test
npm run build
npm run test:backend
```

The backend also requires Python 3.11+ and the pinned packages in `backend/requirements.txt`.

## Current implementation

Implemented: React/Vite editor shell, local backend health endpoint, demo preview, Equation Mode source-preserving toggle, local JPG/PNG paper upload with size/type validation, A4/Letter selection, editable physical layout fields, browser-local template persistence, a deterministic physical-mm layout endpoint, and ink-only PDF export with focused parser/pagination/media-box tests.

Partial/planned Stage 1 work: real paper-analysis suggestions, saved template/document APIs, frontend consumption of the canonical layout endpoint, printer offset controls, and physical print alignment testing.

Stage 2 handwriting acquisition is intentionally not implemented.
