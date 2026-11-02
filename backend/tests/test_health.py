from fastapi.testclient import TestClient

from app.main import app


def test_health_returns_stage_one_service_status() -> None:
    response = TestClient(app).get("/api/v1/health")
    assert response.status_code == 200
    assert response.json() == {
        "status": "ok",
        "service": "inkmatch-api",
        "stage": "stage-1",
    }
