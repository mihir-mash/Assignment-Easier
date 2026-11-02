# AGENTS.md — Codex Instructions for InkMatch

You are the coding agent working in the InkMatch repository. These instructions apply to the entire repo unless a more specific nested AGENTS.md overrides them.

## 1. Read first, every session
1. Read `PROJECT_SPEC.md` and `ARCHITECTURE.md` before planning or editing.
2. Read the current `README.md`, existing code, tests, and git status before making changes.
3. Respect the **current authorized stage**. Stage 1 is implemented. Stage 2 Run 1 (audit and data model/storage) is authorized; do not proceed to Run 2 or later tasks unless explicitly asked. Never implement Stage 3 without explicit authorization.
4. When a request conflicts with one of these files, explain the conflict briefly and request approval before changing the requirements.

## 2. Product invariants (never violate)
- Live editor shows the uploaded paper image behind the text/handwriting layer.
- Printing PDF contains **ink/text only**, never scanned paper background, ruled lines or existing headers.
- Page coordinate geometry is computed from physical dimensions, not CSS zoom values.
- One deterministic layout model governs visual preview and PDF export.
- Manual corrections to automatically detected paper boundaries/lines must persist.
- Math toggle **ON** turns recognized `x^2` into displayed `x²`; **OFF** preserves literal `x^2`. Never destructively rewrite the stored source string as a consequence of toggling.
- Handwriting capture supports uploaded notes, guided stylus or both in later stages; this is **not** implemented in Stage 1.
- Do not mislabel a demo font as learned personal handwriting or claim advanced handwriting realism before its implementation.
- No external AI service gets users' handwriting, paper images or document text by default.

## 3. Working method
- Before significant changes, provide a brief plan: affected modules, tests, risks and how to run.
- Implement one coherent task at a time. Keep patches small enough to review.
- Inspect and reuse existing code before adding components or dependencies.
- If requirements are ambiguous but not blocking, make a reversible, documented assumption; ask only when a choice would fundamentally change the product or expose personal data.
- For every new feature, include error states and at least one focused test. Do not claim success without running tests.
- After each task, summarize changed files, commands executed, observed results, limitations and next proposed task.
- Update README and architecture docs when interfaces or setup steps change.
- Prefer complete working slices over mock buttons. Clearly mark any deliberately non-functional placeholder and do not present it as finished.

## 4. Coding conventions
- Frontend: strict TypeScript, functional React components and hooks. Avoid `any` unless documented and unavoidable. Isolate API client, geometry math and rendering code. Use semantic controls and keyboard-accessible interactions.
- Backend: typed Python, FastAPI route/service separation, Pydantic request/response validation, pure functions for layout/coordinate/math operations.
- Use clear names with units (`xMm`, `baselineYMm`, `widthPx`), not ambiguous `x` or `size`. Avoid magic pixel-to-mm constants.
- Keep rendering deterministic for the same text, template, settings, profile and seed. Never use random values without a fixed seed in stable preview or export.
- Add input validation and limits for uploaded image size, file type, image dimensions and PDF-related payloads. No unsanitized arbitrary path access.
- Prefer few dependencies; pin and lock them. Never commit credentials, API keys or users' private notes.
- Avoid giant components, repeated coordinate conversions and duplicated math parsing in client/server.

## 5. Tests and definition of done
For a change to be considered done:
1. Relevant lint/typecheck/unit/integration tests pass or exact blockers are documented.
2. The app runs using documented local commands.
3. A human-visible success path and at least one failure path have been checked.
4. Geometry/PDF changes are tested for physical page dimensions and clipping; export contains no paper background image.
5. Documentation for changed behavior is updated.

Required Stage 1 checks:
- A4 PDF media box matches A4 mm converted to points (within reasonable rounding tolerance).
- User can upload a paper image, set/revise physical dimensions, save/reload a template, and manually configure lines/margins/first writable line.
- Best-effort auto-detection can be corrected and does not override user choices.
- Source text updates live overlay; settings change layout; line breaks and multi-page behavior are tested.
- Equation Mode: `x^2 + y^2 = z^2` is displayed as `x² + y² = z²` when ON; literal `^` characters remain when OFF.
- Ink-only export has no embedded paper photo or duplicate ruled lines.
- Test-print guidance warns about actual size / no fit-to-page scaling.

## 6. Changes requiring explicit approval
Do **not** make any of these changes without asking first:
- Change the four-stage scope, remove an explicitly required feature or silently weaken a product invariant.
- Replace the selected core stack, switch from web-first to desktop-first, or introduce a mandatory paid/cloud service.
- Upload/transfer handwriting samples or document text to any third-party service.
- Add authentication, payments, tracking/analytics, public sharing or telemetry.
- Delete user data, rewrite profile storage in an incompatible format or perform destructive database migrations.
- Implement Stage 2, Stage 3 or Stage 4 beyond explicitly requested work.
- Make broad unrelated refactors that would prevent review of the task at hand.

## 7. Stage 1 implementation order
1. Scaffold project, dev scripts, health endpoint, validation and tests.
2. Paper upload, known size/crop, manual layout editor and best-effort auto-detection.
3. Canonical page-mm layout engine, live text overlay, global settings, equation toggle, save/reload.
4. Ink-only PDF export, multi-page fixtures, print warnings and simple X/Y offset controls.
5. Run tests; guide user through one physical print alignment test; document remaining limits and handoff notes for Stage 2.

**Always distinguish:** implemented, partially implemented, and planned. Stop at the authorized stage boundary.

## 8. Stage 2 standing rules
- Do not start Stage 3. No fake personalised rendering. The existing temporary handwriting renderer stays until Stage 3.
- All handwriting processing is local. No paid services, no cloud APIs, no external OCR APIs, no heavy ML dependencies.
- Original uploads and raw stroke data are never modified or discarded. Processing works on copies and can be repeated.
- Never silently overwrite or delete profile data. Deletion needs confirmation.
- Do not claim accuracy, security or encryption that is not implemented and tested.
- No em dashes in any application UI text, labels, instructions or generated user-facing copy.
- Windows compatible. Do not hardcode project paths. Avoid new dependencies unless clearly justified.
- Keep code modular, reuse existing components and utilities, use the existing test framework, no duplicate implementations of the same feature.
- After each task: run relevant tests, fix regressions, update STAGE2_PLAN.md and PROGRESS.md, report limitations.
