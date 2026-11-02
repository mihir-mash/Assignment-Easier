from fastapi.testclient import TestClient

from app.main import app
from app.paper import templates
from app.api.models import LayoutRequest


def test_template_api_saves_loads_and_updates_without_path_access(tmp_path, monkeypatch):
    monkeypatch.setattr(templates, "DATABASE", tmp_path / "paper.sqlite3")
    client = TestClient(app)
    payload = {"name": "Ruled A4", "template": {"settings": LayoutRequest().model_dump(), "paper": {"image": "data:image/png;base64,abc"}}}
    saved = client.post("/api/v1/paper/templates", json=payload)
    assert saved.status_code == 201
    template_id = saved.json()["id"]
    assert client.get("/api/v1/paper/templates").json()[0]["name"] == "Ruled A4"
    assert client.get(f"/api/v1/paper/templates/{template_id}").json()["template"] == payload["template"]
    changed = client.put(f"/api/v1/paper/templates/{template_id}", json={**payload, "name": "Blank A4"})
    assert changed.status_code == 200
    assert client.get(f"/api/v1/paper/templates/{template_id}").json()["name"] == "Blank A4"
    assert client.get("/api/v1/paper/templates/not-a-path").status_code == 404


def test_template_api_rejects_duplicate_and_blank_names(tmp_path, monkeypatch):
    monkeypatch.setattr(templates, "DATABASE", tmp_path / "paper.sqlite3")
    client = TestClient(app)
    payload = {"name": "Local", "template": {"settings": LayoutRequest().model_dump()}}
    assert client.post("/api/v1/paper/templates", json=payload).status_code == 201
    assert client.post("/api/v1/paper/templates", json=payload).status_code == 409
    assert client.post("/api/v1/paper/templates", json={"name": "  ", "template": {}}).status_code == 422
    invalid_settings = LayoutRequest().model_dump()
    invalid_settings["width_mm"] = 0
    invalid = client.post(
        "/api/v1/paper/templates",
        json={"name": "Invalid", "template": {"settings": invalid_settings}},
    )
    assert invalid.status_code == 422
