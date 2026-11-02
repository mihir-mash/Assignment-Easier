from fastapi.testclient import TestClient

from app.main import app
from io import BytesIO
from pypdf import PdfReader
import pytest


def test_pdf_export_has_a4_media_box_and_no_paper_image() -> None:
    response = TestClient(app).post("/api/v1/export/pdf", json={"source_text": "Ink only", "equation_mode": False})
    assert response.status_code == 200
    assert response.headers["content-type"] == "application/pdf"
    pdf = response.content
    assert b"/MediaBox [ 0 0 595.2756 841.8898 ]" in pdf
    assert b"/Subtype /Image" not in pdf


@pytest.mark.parametrize('width,height',[(160,220),(220,160),(215.9,279.4)])
def test_custom_pdf_sizes_and_shared_positioned_content(width:float,height:float) -> None:
    client=TestClient(app)
    payload={'source_text':'Prose x^2\nSecond line','equation_mode':True,'width_mm':width,'height_mm':height,'ink_color':'#123456','slant_deg':10}
    layout=client.post('/api/v1/layout',json=payload).json()
    result=client.post('/api/v1/export/pdf',json=payload)
    reader=PdfReader(BytesIO(result.content))
    page=reader.pages[0]
    assert float(page.mediabox.width)==pytest.approx(width*72/25.4,abs=.001)
    assert float(page.mediabox.height)==pytest.approx(height*72/25.4,abs=.001)
    assert not list(page.images)
    assert len(reader.pages)==len(layout['pages'])
    assert [run['text'] for run in layout['pages'][0]['runs']][:5]==list('Prose')
    assert b'/Subtype /Image' not in result.content


@pytest.mark.parametrize('payload',[{'width_mm':0},{'height_mm':1001},{'font_size_mm':30},{'left_margin_mm':200},{'ink_color':'invalid'},{'line_spacing_mm':0},{'source_text':'x'*20001}])
def test_rejects_invalid_export_requests(payload:dict) -> None:
    assert TestClient(app).post('/api/v1/export/pdf',json=payload).status_code==422


def test_export_page_count_and_glyph_origins_match_canonical_layout() -> None:
    client=TestClient(app)
    payload={'source_text':('Line one with x^2\n'*50),'equation_mode':True,'width_mm':160,'height_mm':150,'offset_x_mm':2,'offset_y_mm':1}
    layout=client.post('/api/v1/layout',json=payload).json()
    reader=PdfReader(BytesIO(client.post('/api/v1/export/pdf',json=payload).content))
    assert len(reader.pages)==len(layout['pages'])>1
    for page,positioned in zip(reader.pages,layout['pages']):
        observed=[]
        def visit(text,cm,tm,font,font_size):
            if text.strip():observed.append((cm[4],cm[5],font_size))
        page.extract_text(visitor_text=visit)
        expected=[run for run in positioned['runs'] if run['draw_text'].strip()]
        assert len(observed)==len(expected)
        for actual,run in zip(observed,expected):
            assert actual[0]==pytest.approx(run['x_mm']*72/25.4,abs=.001)
            assert actual[1]==pytest.approx((positioned['height_mm']-run['baseline_y_mm'])*72/25.4,abs=.001)
            assert actual[2]==pytest.approx(run['font_size_mm']*72/25.4,abs=.001)
    # Large negative offsets are explicitly blocked instead of producing clipped PDF ink.
    assert client.post('/api/v1/export/pdf',json={'source_text':'Visible','offset_x_mm':-30}).status_code==422


def test_calibration_pdf_uses_selected_physical_size_and_applies_offsets() -> None:
    client = TestClient(app)
    response = client.post('/api/v1/calibration/pdf', json={'width_mm': 160, 'height_mm': 220, 'offset_x_mm': 2, 'offset_y_mm': -1})
    assert response.status_code == 200
    page = PdfReader(BytesIO(response.content)).pages[0]
    assert float(page.mediabox.width) == pytest.approx(160*72/25.4, abs=.001)
    assert float(page.mediabox.height) == pytest.approx(220*72/25.4, abs=.001)
    assert '100 mm reference' in page.extract_text()
    assert not list(page.images)
    assert client.post('/api/v1/calibration/pdf', json={'width_mm': 50, 'height_mm': 50, 'offset_x_mm': 30}).status_code == 422
