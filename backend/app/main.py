from fastapi import FastAPI
from fastapi.responses import StreamingResponse
from io import BytesIO
from reportlab.pdfgen import canvas
from reportlab.lib.units import mm
from pydantic import BaseModel

from app.layout.engine import LayoutSettings, layout_document


class HealthResponse(BaseModel):
    status: str
    service: str
    stage: str


class LayoutRequest(BaseModel):
    source_text: str = ""
    equation_mode: bool = True
    width_mm: float = 210.0
    height_mm: float = 297.0
    font_size_mm: float = 6.0
    letter_spacing_mm: float = 0.4
    word_spacing_mm: float = 1.4
    first_baseline_mm: float = 45.0
    line_spacing_mm: float = 8.0
    left_margin_mm: float = 22.0
    right_margin_mm: float = 18.0
    offset_x_mm: float = 0.0
    offset_y_mm: float = 0.0


class LayoutRunResponse(BaseModel):
    text: str
    x_mm: float
    baseline_y_mm: float
    width_mm: float
    font_size_mm: float
    source_range: tuple[int, int]
    kind: str
    ink_color: str


class LayoutPageResponse(BaseModel):
    page_index: int
    width_mm: float
    height_mm: float
    runs: list[LayoutRunResponse]
    warnings: list[str]


class LayoutResponse(BaseModel):
    pages: list[LayoutPageResponse]


app = FastAPI(title="InkMatch API", version="0.1.0")


@app.get("/api/v1/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(status="ok", service="inkmatch-api", stage="stage-1")


@app.post("/api/v1/layout", response_model=LayoutResponse)
def layout(request: LayoutRequest) -> LayoutResponse:
    settings = LayoutSettings(
        font_size_mm=request.font_size_mm,
        letter_spacing_mm=request.letter_spacing_mm,
        word_spacing_mm=request.word_spacing_mm,
        first_baseline_mm=request.first_baseline_mm,
        line_spacing_mm=request.line_spacing_mm,
        left_margin_mm=request.left_margin_mm,
        right_margin_mm=request.right_margin_mm,
        equation_mode=request.equation_mode,
        offset_x_mm=request.offset_x_mm,
        offset_y_mm=request.offset_y_mm,
    )
    pages = layout_document(request.source_text, settings, request.width_mm, request.height_mm)
    return LayoutResponse(pages=[LayoutPageResponse(page_index=page.page_index, width_mm=page.width_mm, height_mm=page.height_mm, runs=[LayoutRunResponse(**run.__dict__) for run in page.runs], warnings=page.warnings) for page in pages])


@app.post("/api/v1/export/pdf")
def export_pdf(request: LayoutRequest) -> StreamingResponse:
    settings = LayoutSettings(
        font_size_mm=request.font_size_mm,
        letter_spacing_mm=request.letter_spacing_mm,
        word_spacing_mm=request.word_spacing_mm,
        first_baseline_mm=request.first_baseline_mm,
        line_spacing_mm=request.line_spacing_mm,
        left_margin_mm=request.left_margin_mm,
        right_margin_mm=request.right_margin_mm,
        equation_mode=request.equation_mode,
        offset_x_mm=request.offset_x_mm,
        offset_y_mm=request.offset_y_mm,
    )
    pages = layout_document(request.source_text, settings, request.width_mm, request.height_mm)
    buffer = BytesIO()
    document = canvas.Canvas(buffer, pagesize=(request.width_mm * mm, request.height_mm * mm))
    document.setTitle("InkMatch ink-only export")
    for page_index, page in enumerate(pages):
        for run in page.runs:
            document.setFillColor(run.ink_color)
            document.setFont("Helvetica", max(run.font_size_mm * mm, 1))
            document.drawString(run.x_mm * mm, (request.height_mm - run.baseline_y_mm) * mm, run.text)
        if page_index < len(pages) - 1:
            document.showPage()
    document.save()
    buffer.seek(0)
    return StreamingResponse(buffer, media_type="application/pdf", headers={"Content-Disposition": "attachment; filename=inkmatch-ink-only.pdf"})
