from dataclasses import fields
from subprocess import SubprocessError
from fastapi import FastAPI,HTTPException,Response
from pydantic import BaseModel
from app.api.models import LayoutRequest,LayoutResponse
from app.layout.engine import LayoutSettings,layout_result
from app.pdf.export import render_pdf
from app.paper.routes import router as paper_router


class HealthResponse(BaseModel):
    status: str
    service: str
    stage: str


app = FastAPI(title='InkMatch API',version='0.2.0')
app.include_router(paper_router)


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
