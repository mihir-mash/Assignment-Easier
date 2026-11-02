# InkMatch

A local Stage 1 web editor for composing text on a photograph of your physical paper and exporting only the intended ink. The included Bitstream Vera italic font is a temporary demo, not learned personal handwriting.

## Setup and run

Requirements: Node.js 24+, Python 3.11+, and a current browser. No paid services or cloud credentials are needed.

From the repository root, in PowerShell:

```powershell
python -m venv .venv
.venv/Scripts/python.exe -m pip install --require-hashes -r backend/requirements.lock
npm ci
.venv/Scripts/Activate.ps1
npm run dev
```

Alternatively, use `uv venv .venv` and `uv pip sync backend/requirements.lock --python .venv/Scripts/python.exe`. On macOS/Linux, activate with `source .venv/bin/activate`.

Open http://localhost:5173. Vite proxies `/api` to the local FastAPI server at http://127.0.0.1:8000. `npm run dev:frontend` and `npm run dev:backend` also run the services separately. Keep the project local; no authentication or production hosting is configured.

## Workflow

1. **Select Your Paper:** select A4, US Letter, or Custom. Custom width and height accept 50 to 1,000 mm. Choose portrait or landscape. Upload a JPG/JPEG/PNG, up to 10 MB, 8,000 pixels per side and 24 megapixels. Automatic boundary detection is a suggestion. Adjust the four corners by dragging, keyboard arrows (Shift for larger steps), or percentage inputs. Preview the perspective-corrected crop and explicitly accept it. This step only configures the physical sheet. The original remains available for reset/reprocessing. Editing corners invalidates the accepted crop. A changed page aspect ratio requires recropping.
2. **Configure Writing Area:** set top/header, bottom/footer, left and right writing boundaries, first baseline and line spacing in mm. Drag the overlay edges and baseline or use the numerical fields and keyboard sliders. Printed-line analysis only proposes values and never changes manual settings until you apply them. Save named reusable templates, including original image, corners, crop, physical dimensions and writing settings.
3. **Write and Edit:** type plain text and adjust size, spacing, colour and slant. Changes render immediately, including multiple pages, even with the backend offline. Geometry comes from physical dimensions, independently of browser resizing. Equation Mode always starts OFF when reopening; enabling it lasts only for the current editing session. Tabs preserve the document and settings.
4. **Preview and Export:** inspect pages, set X/Y print offsets in mm, save named printer offset profiles, download a calibration PDF, or export the ink-only PDF. Positive X moves ink right; positive Y moves it down. The calibration sheet includes a centered cross and a 100 mm reference ruler when the page is large enough. The ink export embeds the same demo font and uses the exact same positioned glyphs as the preview. It includes no paper image, guides, ruled lines, decorations or white background rectangles. Offsets that risk physical clipping block export with a visible error.

Drafts, UI templates and printer offset profiles are stored locally in IndexedDB, including image data rather than temporary blob URLs. Browser storage failures are visible. The backend also exposes local SQLite paper-template APIs at `GET/POST /api/v1/paper/templates` and `GET/PUT /api/v1/paper/templates/{id}` for local integrations; the current UI uses IndexedDB templates. A client using that API stores its submitted template payload in the local SQLite database. Calibration PDFs are available from `POST /api/v1/calibration/pdf`. Existing numeric settings in the old `inkmatch.stage1.template` key are read without deleting or rewriting it. Clearing browser site data removes browser-local saves. Original images are retained to support manual recropping; the backend processes image analysis in memory and does not send anything to third-party services.

## Equation Mode

The conservative grammar supports single-letter variables followed by `^` or `_` and unsigned digits, or signed integers inside braces. Examples: `x^2`, `a_12`, `x^{-2}`. Prose, identifiers such as `file_name`, escaped expressions and unsupported syntax stay literal. Recognized scripts use raised/lowered digit glyphs; source text is never rewritten. Unsupported expressions are flagged rather than erased. The demo font has limited Unicode coverage; unsupported characters produce an explicit warning and a visible `?` fallback, with source preserved.

## Checks

```powershell
npm run lint
npm run typecheck
npm test
npm run test:backend
npm run build
npm run test:e2e
```

Backend tests should run with the virtual environment activated, or use `.venv/Scripts/python.exe -m pytest backend/tests -q`. The backend runtime and browser share `shared/layout.ts`, `shared/equations.ts` and generated font metrics. Node.js is therefore required for PDF/layout API requests as well as frontend development. To regenerate the checked-in demo font/metrics, run `python scripts/prepare_font.py`; its redistribution license is in `frontend/public/fonts/LICENSE.txt`.

Browser tests launch a real headless Chrome against local services on ports 15173 and 18000. The default executable is `C:/Program Files/Google/Chrome/Application/chrome.exe`; adjust `playwright.config.ts` for another installation/platform. `INKMATCH_PYTHON` can select a specific Python executable for these tests. Tests generate a perspective paper-on-desk fixture with uneven lighting and surrounding objects; screenshots and test PDFs are written under ignored `tmp/qa/`.

## Remaining verification and limits

Automatic boundaries and line suggestions are best effort, especially with heavy shadows, similarly coloured surroundings, occlusions or curved sheets. Manual review is always required; a four-corner homography handles planar perspective, not page curvature. Automated crop verification uses generated photograph-like fixtures; representative real camera photos still need human review.

The editor works offline; image processing and PDF generation require the local backend. Layout currently uses a regular baseline grid with header/footer exclusions. Irregular individual baselines, extra no-print rectangles, advanced math and personalized handwriting are not implemented in this slice. Templates/drafts are browser-local, not a cross-browser SQLite document library.

Stage 1 is not closed until a physical alignment test is recorded:

1. In **Preview and Export**, select the page size of the blank paper in the printer and download the calibration PDF.
2. In the print dialog choose **Actual Size** or **100%**. Turn off **Fit**, **Scale to fit**, **Shrink oversized pages**, borderless expansion and any other automatic page scaling. Confirm the dialog page size matches the physical sheet and check feed orientation.
3. Print the calibration sheet onto the blank paper. Measure the cross location against the paper center and use the 100 mm ruler to check scale. The reference marks are ink only; the blank-paper image is never sent to the PDF.
4. If output lands X mm to the right of the desired position, enter an X offset of `-X` mm. If it lands Y mm below, enter a Y offset of `-Y` mm. Save the offsets under a printer profile name.
5. Download and print the calibration PDF again at 100%. Repeat small corrections, then print a page of document content and check feed orientation and nonprintable edges.
6. Record printer, feed direction, selected dimensions, print-dialog scaling and measured before/after errors. Actual physical alignment remains unverified until this is done on the target printer.

Irregular per-line baseline lists, arbitrary additional exclusion zones and a cross-browser SQLite template UI are not implemented; the current writing grid uses a manually adjustable first baseline and uniform line spacing. Stage 2 handwriting acquisition and training remain outside the implemented scope.
