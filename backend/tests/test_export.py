from fastapi.testclient import TestClient

from app.main import app


def test_pdf_export_has_a4_media_box_and_no_paper_image() -> None:
    response = TestClient(app).post("/api/v1/export/pdf", json={"source_text": "Ink only", "equation_mode": False})
    assert response.status_code == 200
    assert response.headers["content-type"] == "application/pdf"
    pdf = response.content
    assert b"/MediaBox [ 0 0 595.2756 841.8898 ]" in pdf
    assert b"/Subtype /Image" not in pdf
