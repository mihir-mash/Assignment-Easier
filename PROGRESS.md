# InkMatch Progress

## Stage 1 implementation

- Four responsive workflow steps separate physical paper setup, writing geometry, live editing and export. The compact header carries the product sentence; the full hero was removed.
- Paper upload supports JPG/PNG limits, best-effort local detection, four manual normalized corner controls and perspective correction. The correction preview reuses the photo frame; Back retains manual corner values, Accept returns to editable controls, and the original image remains available for recropping.
- Writing settings use physical page millimetres. Users can set regular spacing or individually edit/add/remove baselines, and add/edit/delete exclusion rectangles. The shared deterministic layout engine applies these constraints to preview and PDF, moves text around exclusion areas, paginates, and warns when text cannot fit.
- Template UI lists/loads/creates/explicitly updates via local SQLite APIs and caches browser copies with IndexedDB fallback. Same-name saves require explicit selection and update. Draft and printer profile persistence remain browser-local.
- Equation Mode is session-only and starts OFF. A4/Letter/custom physical PDF, ink-only export, calibration reference PDF, saved X/Y offsets and Actual Size print guidance are implemented. Stage 2 guided stylus capture is implemented; the touchscreen and real-pen acceptance checklist remains pending.

## Design decisions

- Retained React/Vite, strict TypeScript, FastAPI/Pydantic, OpenCV/Pillow, ReportLab, SQLite, IndexedDB and the shared TS page-mm engine.
- No paid or cloud service, third-party handwriting transfer or new dependency was added. SQLite template data stays on the local service; IndexedDB provides browser caching/offline fallback.
- Exclusion rectangles are mm-based and are applied by the shared text flow algorithm; overlays are guides only and are never exported.

## Verification

- Frontend unit tests: 19 passed.
- Backend pytest: 24 passed (one upstream Starlette/AnyIO deprecation warning).
- Playwright E2E: 5 passed, covering crop review/edit, template save/load, equation toggle, multi-page export, offsets, mobile overflow, individual baseline editing and multiple exclusion overlays.
- `npm run lint`, `npm run build`, and `npm run typecheck` passed. Repeat final commands after the latest E2E additions.

## Remaining limits and next steps

- **Stage 1 software implementation is complete. Physical acceptance remains outstanding:** print the calibration PDF on target paper at Actual Size / 100%, verify its 100 mm scale, measure X/Y error, apply opposite offsets and repeat. Record printer/feed settings and before/after measurements.
- Automatic paper detection is best effort; curved/occluded sheets and atypical lighting need manual review. Generated fixtures do not establish robustness across real cameras.
- Template SQLite library is local to this backend instance; browser cache/fallback is per browser. A backend outage does not silently change the SQLite copy.
- Demo font coverage and advanced equation formatting remain limited. Personalized handwriting is outside Stage 1.

## Stage 2 Run 1: audit and data model/storage

### Audit findings

- Structure: React/Vite/TypeScript under `frontend/src`, shared deterministic layout and math under `shared`, FastAPI routes/services under `backend/app`, pytest under `backend/tests`, Vitest under `frontend/src`, Playwright under `e2e`.
- Navigation and state: four Stage 1 tabs are in `frontend/src/App.tsx`; `frontend/src/useInkMatch.tsx` owns workspace/editor state. Paper feature components are separated under `frontend/src/features`.
- Backend: paper image endpoints in `backend/app/paper/routes.py`, template endpoints in `backend/app/paper/templates.py`, layout/PDF/calibration endpoints in `backend/app/main.py`.
- SQLite before this run had only the `paper_templates` table. Stage 1 paper-photo upload is validated and processed locally in memory; saved template payload can include browser-submitted image data. No backend handwriting file store or profile API existed.
- OpenCV/Pillow utilities live in `backend/app/paper/processing.py`. Pointer Events are used for crop handles and writing geometry in `PaperCrop.tsx` and `PagePreview.tsx`. State is React hooks plus browser IndexedDB/localStorage helpers. Styling is component CSS in `frontend/src/styles.css`; no Tailwind dependency is present.
- Baseline working tree had an unrelated modified `frontend/src/App.tsx`; it was not changed by this run. Its removal of the confirmed-paper image assertion target explains two baseline E2E failures.

### Implemented

- Added profile and sample SQLite tables with a versioned schema migration, foreign key association, profile sample counts, and automatic timestamped pre-migration SQLite backups.
- Added profile CRUD and sample CRUD APIs. Opaque UUID asset references prevent caller-controlled paths. Deletion requires `confirm=true`; raw stroke files are retained when sample records are removed.
- Added versioned stylus JSON storage with normalized x/y, timestamps, optional pressure/tilt, points grouped by strokes, pointer events/type, metadata and capture canvas dimensions. Missing pressure/tilt are valid and their omitted representation is preserved.
- Added bounded local image asset storage helpers that write generated JPG/JPEG/PNG/WebP files rather than SQLite blobs; the upload API and image validation/review workflow remain Run 3.
- Added editable default coverage thresholds. Coverage computation and UI remain planned.
- Updated standing rules, architecture, README and `STAGE2_PLAN.md`. Stage 3 remains unstarted. No frontend capture/upload UI or personalized rendering was added.

### Verification

- Baseline before changes: `npm run lint` passed; `npm run typecheck` passed; frontend Vitest 19 passed; backend pytest 24 passed; `npm run build` passed.
- Baseline browser E2E: 3 passed, 2 failed out of 5. Both failures expected a confirmed-paper image removed by the pre-existing uncommitted `App.tsx` change. Remaining three passed.
- After implementation: `.venv/Scripts/python.exe -m pytest backend/tests -q` passed, 29 passed, 1 upstream Starlette/AnyIO deprecation warning.
- Focused tests cover migration and backup with existing Stage 1 template data, profile/sample CRUD and association, repeated API-client persistence, label alignment, stroke round-trip with absent pressure/tilt, invalid references/input, and confirmed deletion.

### Limitations and next step

- Local image storage helpers are implemented. The profile image upload API, image-content validation and upload review flow are deferred to Run 3. Guided stylus capture and stylus normalization are completed in Run 2. Upload capture/processing remains planned for Run 3. No handwriting synthesis has been attempted.
- The earlier browser E2E failures were assertions for the intentionally removed separate crop thumbnail. The tests now assert the corrected image in the crop viewport before acceptance, editing controls after acceptance, and the accepted crop in the writing-area preview. Physical printer alignment is still pending the user's real-world test and is not a blocker for Stage 2.
- Run 2 completed Task 3 guided stylus capture and the stylus portion of Task 4 normalization/quality checks. Run 3 upload work has not started.

### Run 1 hardening verification

- Migration failure injection now raises after the profiles table DDL has executed. The transaction rolls back, restoring the exact original schema, data and `user_version`; the timestamped backup remains available. Retrying succeeds, and a second migration leaves the schema unchanged.
- A new database migrates without making a backup of the empty file; existing databases still receive timestamped backups before migration.
- Profile/sample tests now cover invalid sample IDs, nonexistent parent profiles, cross-profile isolation and confirmed profile deletion behavior.
- A process-level persistence test starts two independent backend processes against the same isolated temporary SQLite file and verifies profile/sample retrieval after restart. Processes are stopped in `finally` and ports are dynamically selected with retry.
- Playwright uses a per-run ignored SQLite database via `INKMATCH_DATABASE`, so E2E template writes do not touch the user's local template database.
- Full regression: backend pytest **33 passed**; frontend Vitest **19 passed**; Playwright **5 passed**; `npm run lint`, `npm run typecheck`, `npm run build`, and `git diff --check` passed.


## Stage 2 Run 2: guided stylus capture and normalization

### Implemented

- Added the Collect Handwriting workflow tab with a guided prompt canvas, repeatable sample save, prompt navigation, pause/resume/finish, clear, undo and an expandable category library. Each saved repetition remains separate, with prompt/context/alignment labels and a preview image.
- Added unified Pointer Events capture with normalized canvas coordinates, capture dimensions, timing, stroke boundaries, pen-down/up, pointer type, coalesced samples, optional pressure/tilt, pointer cancellation and interruption recovery. Pen only defaults on, ignores touch while enabled, and keeps mouse available for testing.
- Persisted the current draft and completed raw samples in IndexedDB. Refresh recovery pauses and marks an unfinished stroke interrupted. Completed samples sync to the local profile API; failed sync leaves the local copy available for retry.
- Added deterministic, non-mutating bbox normalization and quality notes for empty, small, short, interrupted and malformed-sequence samples. Missing pressure/tilt do not fail normalization. Raw and normalized server files are separate and versioned.

### Verification

- Frontend Vitest: 22 passed.
- Backend pytest: 37 passed.
- `npm run lint` and `npm run build` passed. Playwright E2E: 8 passed, including Stage 1 regressions, desktop/narrow capture, and profile-service failure handling. `git diff --check` passed.
- Real pen, hover, pressure/tilt, palm rejection and physical-device refresh behavior are pending the checklist in `STYLUS_MANUAL_TEST.md`; no hardware test is claimed.

### Remaining Stage 2 work

- Run 3: local handwriting image upload and image validation/review/segmentation work are not started.
- Run 4: combined profile builder/coverage, profile listing and management, workflow integration review, security/privacy review, and final regression remain incomplete. No coverage dashboard or personalized generation was added.
