# InkMatch Stage 2 Plan

Statuses: Not Started, In Progress, Blocked, Completed. Stage 2 acquisition builds on the local Stage 1 app. Stage 3 synthesis is explicitly out of scope.

## Run 1: Audit and data model/storage

### Task 0: Audit
- **Objective:** Confirm current repository structure, routes, persistence, UI state, image utilities, pointer events, design system, and baseline checks against the implementation.
- **Expected files/modules:** Repository docs, `frontend/src`, `backend/app`, `shared`, `backend/tests`, `e2e`.
- **Dependencies:** None.
- **Acceptance:** Audit records actual schema and features; lint, typecheck, frontend, backend, build, and browser test outcomes are recorded; Stage 1 software blockers are called out. E2E tests use an isolated database.
- **Required tests:** `npm run lint`, `npm run typecheck`, `npm test -- --run`, `npm run test:backend`, `npm run build`, `npm run test:e2e`.
- **Status:** Completed.

### Task 1: Data model and storage
- **Objective:** Add local profile/sample records, versioned stroke JSON files, safe opaque asset references, versioned SQLite migration with pre-migration backup, and editable coverage thresholds.
- **Expected files/modules:** `backend/app/storage.py`, `backend/app/profiles.py`, `backend/app/coverage_thresholds.json`, `backend/app/main.py`, profile backend tests, `ARCHITECTURE.md`, `AGENTS.md`, `PROGRESS.md`.
- **Dependencies:** Task 0 audit.
- **Acceptance:** Profile and sample CRUD, association and process-restart persistence work; renames preserve data; deletes require explicit confirmation; migration preserves Stage 1 templates and makes a timestamped backup for pre-existing databases; failed migrations roll back schema and data; repeated migration creates no duplicate objects; a new database does not create an empty backup; stroke JSON round-trips with optional pressure/tilt omitted; paths are not exposed; invalid data is rejected.
- **Required tests:** Focused profile API tests, injected migration failure with successful retry, process restart, and full backend suite. Frontend checks and E2E are regression checks.
- **Hardening verification:** Backend 33 passed, frontend 19 passed, E2E 5 passed; lint, typecheck, build and diff check passed.
- **Status:** Completed.

## Run 2: Guided stylus capture

### Task 3: Guided stylus capture
- **Objective:** Add prompt-driven, repeatable pointer capture with retry and save flow. Preserve normalized canvas coordinates, timing, stroke boundaries and available pointer metadata.
- **Expected files/modules:** New `frontend/src/features/profiles/` capture components, typed profile API client, profile workflow state, backend integration as needed.
- **Dependencies:** Task 1 API and stroke format.
- **Acceptance:** Pen, touch and mouse work; absent pressure/tilt are accepted; resizing after capture does not change stored coordinates; failure/retry states are accessible; no sample leaves the local app.
- **Required tests:** Component/pointer tests and browser success/failure paths; backend stroke persistence regression.
- **Status:** Not Started.

### Task 4 (stylus half): Normalization and quality checks
- **Objective:** Validate stylus sample geometry and provide local quality signals without rejecting missing hardware metadata.
- **Expected files/modules:** Shared or backend sample validation helpers, capture quality UI, focused tests.
- **Dependencies:** Task 3.
- **Acceptance:** normalized points and canvas dimensions are validated; quality indicators are explainable and retryable; pressure/tilt absence is not a failure.
- **Required tests:** valid, boundary, malformed and missing-metadata cases.
- **Status:** Not Started.

## Run 3: Notes upload

### Task 2: Upload system
- **Objective:** Add local image upload for handwriting samples with file/dimension limits and generated asset identifiers.
- **Expected files/modules:** Profile upload UI/API and local asset storage modules.
- **Dependencies:** Task 1 asset-reference model.
- **Acceptance:** Supported images persist as local files; unsafe names/paths are impossible; invalid, oversized and malformed uploads show actionable errors; originals remain unchanged.
- **Required tests:** API upload limits, generated storage names, content validation, retrieval and failure cases.
- **Status:** Not Started.

### Task 4 (upload half): Segmentation and quality checks
- **Objective:** Add local image cleanup and line/word segmentation while keeping source samples immutable and labels honest.
- **Expected files/modules:** Profile image processing utilities and upload review UI.
- **Dependencies:** Task 2. Any OCR provider or cloud service remains disallowed.
- **Acceptance:** Processed copies are reproducible; segmentation uncertainty is visible; a word prompt is not marked as per-character aligned without mapping.
- **Required tests:** image fixtures, segmentation quality indicators, alignment metadata and invalid-image cases.
- **Status:** Not Started.

## Run 4: Profile workflow and regression

### Task 5: Profile builder and coverage
- **Objective:** Combine uploaded and stylus samples into a profile and report character/combination/context coverage using `coverage_thresholds.json`.
- **Expected files/modules:** Profile builder and coverage service/UI, threshold config, tests.
- **Dependencies:** Tasks 2, 3, 4.
- **Acceptance:** sources can be combined; missing and underrepresented prompts are identified; thresholds are configurable; no renderer claims personal synthesis.
- **Required tests:** coverage boundary cases, source combination, label alignment and empty profile.
- **Status:** Not Started.

### Task 6: Profile management
- **Objective:** Add profile listing, selection, rename and confirmed deletion workflows.
- **Expected files/modules:** Profile management screens and typed API client.
- **Dependencies:** Tasks 1 and 5.
- **Acceptance:** profiles persist locally; destructive actions require clear confirmation; errors and empty states are visible.
- **Required tests:** UI/API CRUD, persistence and delete cancellation/confirmation.
- **Status:** Not Started.

### Task 7: Workflow integration
- **Objective:** Integrate profile setup into the existing Stage 1 navigation without disturbing paper editing/export.
- **Expected files/modules:** `frontend/src/App.tsx`, workflow navigation and profile feature modules.
- **Dependencies:** Tasks 5 and 6.
- **Acceptance:** users can reach profile acquisition and return to Stage 1; existing paper preview and ink-only PDF behavior remain intact; temporary font is clearly labeled.
- **Required tests:** end-to-end combined profile and Stage 1 flow.
- **Status:** Not Started.

### Task 8: Security and privacy
- **Objective:** Review local storage boundaries, validation, asset references, retention and deletion behavior.
- **Expected files/modules:** API/storage modules, privacy documentation, tests.
- **Dependencies:** Tasks 2 through 7.
- **Acceptance:** no third-party transfer; path traversal is blocked; originals and raw strokes remain immutable; no unsupported security/encryption claims.
- **Required tests:** path/reference fuzz cases, size/type limits, retention and confirmed deletion behavior.
- **Status:** Not Started.

### Task 9: Testing and regression
- **Objective:** Run complete quality checks and document implemented, partial and planned capabilities.
- **Expected files/modules:** Test suites, README, ARCHITECTURE, PROGRESS, this plan.
- **Dependencies:** Tasks 2 through 8.
- **Acceptance:** all relevant checks pass; Stage 1 PDF/layout invariants remain tested; browser success and failure paths are checked; remaining hardware limits are explicit.
- **Required tests:** lint, typecheck, frontend, backend, build, E2E, PDF/layout regression suite.
- **Status:** Not Started.
