# InkMatch Progress

## Implemented in Stage 1

- Four responsive workflow steps: Select Your Paper, Configure Writing Area, Write and Edit, and Preview and Export. Paper dimensions/crop are separate from writing margins and baselines. Switching steps preserves workspace state.
- Original JPG/PNG remains available for recropping. Local best-effort corner detection, manual corner controls, perspective correction and explicit crop acceptance remain in the paper step.
- Writing boundaries (top/header, bottom/footer, left and right) and first baseline have mm fields plus draggable and keyboard-adjustable preview handles. Uniform line spacing remains independently editable. Suggestions can propose a first baseline, spacing and side margins; the user must explicitly apply them.
- Browser IndexedDB draft and reusable templates persist physical paper data, image crop, manual corrections and writing settings. A local SQLite API now supports paper template list/create/load/update for integrations. Printer offsets can be saved as named browser-local profiles and do not modify template geometry.
- The shared deterministic TypeScript engine still governs live preview and ink-only PDF positions, wrapping and pagination. A4, Letter and custom sizes retain exact physical media boxes. X/Y offsets apply to rendered ink and clipping validation remains active.
- A calibration PDF endpoint and UI download create a page-sized center cross and 100 mm reference ruler when dimensions permit; offsets are applied. Print instructions cover Actual Size / 100%, disabling automatic scaling, measuring offsets and repeating.
- Equation Mode remains session-only and OFF on reopen. Demo font is still clearly identified. No Stage 2 handwriting acquisition is implemented.

## Design decisions

- Kept React/Vite, FastAPI, OpenCV/Pillow, ReportLab and the shared TypeScript layout engine.
- Kept IndexedDB as the current user-facing template/draft store for compatibility and offline use. The backend SQLite template API is a local integration surface; the UI does not depend on it.
- Kept printer calibration separate from template/write-area geometry. Positive X moves ink right; positive Y moves ink down. A measured positive print error is corrected by applying the opposite offset.
- No cloud service or paid dependency was added.

## Verification

- Frontend unit tests: 18 passed.
- Backend tests: 23 passed, including paper detection/cropping/line suggestions, SQLite template CRUD and invalid-geometry validation, exact PDF dimensions, ink-only output and calibration offsets.
- Browser end-to-end tests: 5 passed, including manual crop recovery, template/draft persistence, multipage export, named printer profile restore, calibration PDF download, separated paper/writing controls and millimetre baseline dragging.
- `npm run lint`, `npm run typecheck`, and `npm run build` passed. Backend test run reports one upstream Starlette/AnyIO deprecation warning.

## Remaining limits and next task

- Physical printer alignment is not verified. Print the calibration PDF on the target paper at Actual Size / 100%, check the 100 mm scale, measure X/Y error, apply opposite offsets, save the printer profile and repeat. Record printer/feed settings and before/after measurements before closing Stage 1.
- Four-corner homography assumes a flat sheet; difficult lighting, occlusion and curved pages may need manual adjustment. Synthetic photos do not prove robustness on all real camera images.
- Ruling is represented by a regular baseline grid. Detected irregular individual baselines, extra exclusion rectangles and a UI connected to the SQLite template API remain incomplete. Current UI templates persist in that browser.
- Demo font coverage is limited. Advanced equation layout and personalized handwriting remain out of scope. No Stage 2 work has started.
