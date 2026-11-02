# InkMatch Progress

## Stage 1 implementation

- Four responsive workflow steps separate physical paper setup, writing geometry, live editing and export. The compact header carries the product sentence; the full hero was removed.
- Paper upload supports JPG/PNG limits, best-effort local detection, four manual normalized corner controls and perspective correction. The correction preview reuses the photo frame; Back retains manual corner values, Accept returns to editable controls, and the original image remains available for recropping.
- Writing settings use physical page millimetres. Users can set regular spacing or individually edit/add/remove baselines, and add/edit/delete exclusion rectangles. The shared deterministic layout engine applies these constraints to preview and PDF, moves text around exclusion areas, paginates, and warns when text cannot fit.
- Template UI lists/loads/creates/explicitly updates via local SQLite APIs and caches browser copies with IndexedDB fallback. Same-name saves require explicit selection and update. Draft and printer profile persistence remain browser-local.
- Equation Mode is session-only and starts OFF. A4/Letter/custom physical PDF, ink-only export, calibration reference PDF, saved X/Y offsets and Actual Size print guidance are implemented. Stage 2 handwriting capture is not started.

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
