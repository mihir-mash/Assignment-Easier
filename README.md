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

1. **Paper Setup:** select A4, US Letter, or Custom. Custom width and height accept 50 to 1,000 mm. Landscape swaps the selected dimensions; returning to a preset does not erase custom values. Upload a JPG/JPEG/PNG, up to 10 MB, 8,000 pixels per side and 24 megapixels. Automatic boundary detection is a suggestion. Adjust the four corners by dragging, keyboard arrows (Shift for larger steps), or percentage inputs. Preview the perspective-corrected crop and explicitly accept it. The original remains available for reset/reprocessing. Editing corners invalidates the accepted crop. A changed page aspect ratio requires recropping.
2. Configure headers, footer, margins, first baseline and line spacing in mm. Printed-line analysis is separate from boundary detection; it only proposes values and never changes manual settings until you apply them. Save named reusable templates, including original image, corners and accepted crop.
3. **Writing Editor:** type plain text and adjust size, spacing, colour and slant. Changes render immediately, including multiple pages, even with the backend offline. Geometry comes from physical dimensions, independently of browser resizing. Equation Mode always starts OFF when reopening; enabling it lasts only for the current editing session. Tabs preserve the document and settings.
4. **Preview and Export:** inspect the pages, set X/Y print offsets in mm, and download the PDF. Positive X moves ink right; positive Y moves it down. The PDF embeds the same demo font and uses the exact same positioned glyphs as the preview. It includes no paper image, guides, ruled lines, decorations or white background rectangles. Offsets that risk physical clipping block export with a visible error.

Drafts and templates are stored locally in IndexedDB, including image data rather than temporary blob URLs. Browser storage failures are visible. Existing numeric settings in the old `inkmatch.stage1.template` key are read without deleting or rewriting it. Old expired blob URLs cannot recover an image; re-upload it once. Clearing browser site data removes local saves. Original images are retained to support manual recropping; the backend processes images in memory and does not retain uploads or send anything to third-party services.

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

1. Use the matching physical sheet and page dimensions.
2. Print a single page at **Actual size / 100%**, disabling fit-to-page scaling.
3. Check printer feed orientation and nonprintable edges.
4. Measure horizontal and baseline error in mm. Apply the opposite X/Y offsets and repeat.
5. Record printer, feed direction, selected dimensions, scaling and measured before/after errors. Printer feed variance cannot be verified in software.

Stage 2 handwriting acquisition and training remain outside the implemented scope.
