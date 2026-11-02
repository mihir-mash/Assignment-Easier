from dataclasses import fields
from subprocess import SubprocessError
from fastapi import FastAPI,HTTPException,Response
from pydantic import BaseModel, ConfigDict, Field
from app.api.models import LayoutRequest,LayoutResponse
from app.layout.engine import LayoutSettings,layout_result
from app.pdf.export import render_pdf, render_calibration_pdf
from app.paper.routes import router as paper_router
from app.paper.templates import router as templates_router
from app.profiles import router as profiles_router


class HealthResponse(BaseModel):
    status: str
    service: str
    stage: str


app = FastAPI(title='InkMatch API',version='0.2.0')
app.include_router(paper_router)
app.include_router(templates_router)
app.include_router(profiles_router)


@app.get('/api/v1/health',response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(status='ok',service='inkmatch-api',stage='stage-1')


def calculate(request: LayoutRequest) -> dict:
    values = request.model_dump()
    settings = LayoutSettings(**{field.name:values[field.name] for field in fields(LayoutSettings)})
    try:
        return layout_result(request.source_text,settings,request.width_mm,request.height_mm)
    except (OSError,SubprocessError) as error:
        raise HTTPException(503,'Layout runtime unavailable. Install Node.js 24 or newer.') from error


@app.post('/api/v1/layout',response_model=LayoutResponse)
def layout(request: LayoutRequest) -> dict:
    return calculate(request)


@app.post('/api/v1/export/pdf')
def export_pdf(request: LayoutRequest) -> Response:
    result = calculate(request)
    if not result['pages'] or any('outside the sheet' in warning for warning in result['warnings']):
        raise HTTPException(422,result['warnings'])
    return Response(render_pdf(result),media_type='application/pdf',headers={'Content-Disposition':'attachment; filename=inkmatch-ink-only.pdf'})


class CalibrationRequest(BaseModel):
    model_config = ConfigDict(extra='forbid', allow_inf_nan=False)
    width_mm: float = Field(default=210, ge=50, le=1000)
    height_mm: float = Field(default=297, ge=50, le=1000)
    offset_x_mm: float = Field(default=0, ge=-30, le=30)
    offset_y_mm: float = Field(default=0, ge=-30, le=30)


@app.post('/api/v1/calibration/pdf')
def calibration_pdf(request: CalibrationRequest) -> Response:
    try:
        if not (10 <= request.width_mm/2+request.offset_x_mm <= request.width_mm-10 and 10 <= request.height_mm/2+request.offset_y_mm <= request.height_mm-10):
            raise ValueError('Calibration cross would fall outside the printable page.')
        if request.width_mm >= 125 and request.height_mm >= 130:
            ruler_start = request.width_mm/2-50
            if ruler_start + request.offset_x_mm < 5 or ruler_start + 100 + request.offset_x_mm > request.width_mm-5:
                raise ValueError('Current X offset would move the 100 mm calibration ruler outside the printable page.')
            ruler_y = request.height_mm/2 + min(20, request.height_mm/8)
            if ruler_y + request.offset_y_mm < 10 or ruler_y + request.offset_y_mm + 14 > request.height_mm-5:
                raise ValueError('Current Y offset would move the calibration ruler outside the printable page.')
    except ValueError as error:
        raise HTTPException(422, str(error)) from error
    pdf = render_calibration_pdf(request.width_mm, request.height_mm, request.offset_x_mm, request.offset_y_mm)
    return Response(pdf, media_type='application/pdf', headers={'Content-Disposition':'attachment; filename=inkmatch-calibration.pdf'})
