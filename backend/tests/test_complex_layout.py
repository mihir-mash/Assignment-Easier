from io import BytesIO

from fastapi.testclient import TestClient
from pypdf import PdfReader

from app.main import app


def test_individual_baselines_and_exclusion_zones_match_ink_only_pdf():
    client = TestClient(app)
    request = {
        "source_text": "A\nB\nC\nD",
        "width_mm": 120,
        "height_mm": 100,
        "line_baselines_mm": [40, 53, 71],
        "exclusion_zones_mm": [{"x_mm": 20, "y_mm": 35, "width_mm": 28, "height_mm": 10}],
    }
    layout = client.post("/api/v1/layout", json=request)
    exported = client.post("/api/v1/export/pdf", json=request)
    assert layout.status_code == exported.status_code == 200
    pages = layout.json()["pages"]
    assert len(pages) == len(PdfReader(BytesIO(exported.content)).pages) == 2
    runs = [run for page in pages for run in page["runs"]]
    assert [run["baseline_y_mm"] for run in runs] == [40, 53, 71, 40]
    for run in runs:
        assert not (
            run["x_mm"] < 48
            and run["x_mm"] + run["width_mm"] > 20
            and run["baseline_y_mm"] - run["font_size_mm"] < 45
            and run["baseline_y_mm"] + run["font_size_mm"] * .3 > 35
        )
    assert client.post("/api/v1/layout", json={**request, "line_baselines_mm": [53, 40]}).status_code == 422
    assert client.post("/api/v1/layout", json={**request, "exclusion_zones_mm": [{"x_mm": 119, "y_mm": 20, "width_mm": 10, "height_mm": 10}]}).status_code == 422
