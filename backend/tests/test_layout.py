from fastapi.testclient import TestClient

from app.layout.engine import LayoutSettings, layout_document
from app.math.parser import parse_visual_tokens
from app.main import app


def test_equation_mode_changes_visual_tokens_without_changing_source_ranges() -> None:
    source = "x^2 + y^2 = z^2"
    enabled = "".join(token.text for token in parse_visual_tokens(source, True))
    disabled = "".join(token.text for token in parse_visual_tokens(source, False))
    assert enabled == "x² + y² = z²"
    assert disabled == source
    assert parse_visual_tokens(source, True)[1].source_range == (2, 3)


def test_layout_wraps_and_paginates_in_physical_mm() -> None:
    pages = layout_document("word " * 250, LayoutSettings(first_baseline_mm=20, line_spacing_mm=10), 210, 50)
    assert len(pages) > 1
    assert all(page.width_mm == 210 and page.height_mm == 50 for page in pages)
    assert all(run.x_mm >= 22 for page in pages for run in page.runs)


def test_layout_endpoint_returns_a4_geometry() -> None:
    response = TestClient(app).post("/api/v1/layout", json={"source_text": "x^2", "equation_mode": True})
    assert response.status_code == 200
    payload = response.json()
    assert payload["pages"][0]["width_mm"] == 210
    assert payload["pages"][0]["height_mm"] == 297
    assert [run["text"] for run in payload["pages"][0]["runs"]] == ["x", "²"]
