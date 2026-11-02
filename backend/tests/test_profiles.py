import json
import os
import socket
import sqlite3
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app import profiles
from app.paper import templates
from app import storage
from app.storage import read_image_asset, save_image_asset


def setup_database(tmp_path, monkeypatch):
    database = tmp_path / "inkmatch.sqlite3"
    monkeypatch.setattr(profiles, "DATABASE", database)
    monkeypatch.setattr(templates, "DATABASE", database)
    return database


def test_migration_preserves_stage1_templates_and_creates_timestamped_backup(tmp_path, monkeypatch):
    database = setup_database(tmp_path, monkeypatch)
    with sqlite3.connect(database) as db:
        db.execute("CREATE TABLE paper_templates (id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE, payload TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)")
        db.execute("INSERT INTO paper_templates(id,name,payload) VALUES('existing-id','Ruled A4','{\"settings\":{}}')")
    client = TestClient(app)
    assert client.get("/api/v1/paper/templates").status_code == 200
    assert client.get("/api/v1/paper/templates/existing-id").json()["template"] == {"settings": {}}
    backups = list(tmp_path.glob("inkmatch.backup-*.sqlite3"))
    assert len(backups) == 1
    with sqlite3.connect(backups[0]) as backup:
        assert backup.execute("SELECT name FROM paper_templates").fetchone() == ("Ruled A4",)
        assert backup.execute("PRAGMA user_version").fetchone() == (0,)


def test_new_database_does_not_create_pre_migration_backup(tmp_path):
    database = tmp_path / "new.sqlite3"
    storage.migrate(database)
    assert database.exists()
    assert list(tmp_path.glob("new.backup-*.sqlite3")) == []
    with sqlite3.connect(database) as db:
        assert db.execute("PRAGMA user_version").fetchone() == (1,)
        assert db.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='handwriting_profiles'"
        ).fetchone() == ("handwriting_profiles",)


def _schema_snapshot(database):
    with sqlite3.connect(database) as db:
        return db.execute(
            "SELECT type,name,tbl_name,sql FROM sqlite_master "
            "WHERE name NOT LIKE 'sqlite_%' ORDER BY type,name"
        ).fetchall()


def test_failed_migration_rolls_back_and_retry_is_safe(tmp_path, monkeypatch):
    database = tmp_path / "legacy.sqlite3"
    with sqlite3.connect(database) as db:
        db.execute("CREATE TABLE paper_templates (id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE, payload TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)")
        db.execute("INSERT INTO paper_templates(id,name,payload) VALUES('preserve-id','Keep me','{\"a\":1}')")
    original_schema = _schema_snapshot(database)
    original_migration = storage._migration_1

    def fail_after_schema_change(db):
        db.execute(storage.MIGRATION_1_STATEMENTS[0])
        db.execute(storage.MIGRATION_1_STATEMENTS[1])
        raise RuntimeError("injected migration failure")

    monkeypatch.setattr(storage, "_migration_1", fail_after_schema_change)
    with pytest.raises(RuntimeError, match="injected migration failure"):
        storage.migrate(database)

    assert _schema_snapshot(database) == original_schema
    with sqlite3.connect(database) as db:
        assert db.execute("PRAGMA user_version").fetchone()[0] == 0
        assert db.execute("SELECT id,name,payload FROM paper_templates").fetchall() == [
            ("preserve-id", "Keep me", '{"a":1}')
        ]
    backups = list(tmp_path.glob("legacy.backup-*.sqlite3"))
    assert len(backups) == 1
    with sqlite3.connect(backups[0]) as backup:
        assert backup.execute("SELECT id,name,payload FROM paper_templates").fetchall() == [
            ("preserve-id", "Keep me", '{"a":1}')
        ]

    monkeypatch.setattr(storage, "_migration_1", original_migration)
    storage.migrate(database)
    schema_after_migration = _schema_snapshot(database)
    storage.migrate(database)
    assert _schema_snapshot(database) == schema_after_migration
    with sqlite3.connect(database) as db:
        assert db.execute("PRAGMA user_version").fetchone()[0] == 1
        assert db.execute("SELECT id,name,payload FROM paper_templates").fetchall() == [
            ("preserve-id", "Keep me", '{"a":1}')
        ]


def test_profile_sample_crud_association_and_persistence(tmp_path, monkeypatch):
    setup_database(tmp_path, monkeypatch)
    client = TestClient(app)
    profile = client.post("/api/v1/profiles", json={"name": "  My Writing  ", "sample_sources": ["stylus"]}).json()
    profile_id = profile["id"]
    assert profile["name"] == "My Writing"
    assert client.get("/api/v1/profiles").json()[0]["id"] == profile_id
    assert client.put(f"/api/v1/profiles/{profile_id}", json={"name": "Renamed"}).json()["name"] == "Renamed"

    payload = {"source_type": "uploaded_image", "label_type": "word", "label_text": "book", "label_alignment": "unaligned", "context": "in_word", "dimensions": {"width_px": 800, "height_px": 300}, "quality_indicators": {"contrast": "good"}}
    sample = client.post(f"/api/v1/profiles/{profile_id}/samples", json=payload)
    assert sample.status_code == 201
    sample_id = sample.json()["id"]
    restarted_client = TestClient(app)
    loaded = restarted_client.get(f"/api/v1/profiles/{profile_id}/samples/{sample_id}").json()
    assert loaded["label_alignment"] == "unaligned"
    assert loaded["label_text"] == "book"
    assert restarted_client.get(f"/api/v1/profiles/{profile_id}").json()["total_sample_count"] == 1
    assert len(restarted_client.get(f"/api/v1/profiles/{profile_id}/samples").json()) == 1
    assert restarted_client.put(f"/api/v1/profiles/{profile_id}/samples/{sample_id}", json={**payload, "label_alignment": "manual"}).json()["label_alignment"] == "manual"
    assert restarted_client.delete(f"/api/v1/profiles/{profile_id}/samples/{sample_id}").status_code == 409
    assert restarted_client.delete(f"/api/v1/profiles/{profile_id}/samples/{sample_id}?confirm=true").status_code == 200
    assert restarted_client.get(f"/api/v1/profiles/{profile_id}").json()["total_sample_count"] == 0
    assert restarted_client.delete(f"/api/v1/profiles/{profile_id}").status_code == 409
    assert restarted_client.delete(f"/api/v1/profiles/{profile_id}?confirm=true").status_code == 200


def test_sample_association_invalid_ids_and_confirmed_profile_deletion(tmp_path, monkeypatch):
    setup_database(tmp_path, monkeypatch)
    client = TestClient(app)
    first_id = client.post("/api/v1/profiles", json={"name": "First"}).json()["id"]
    second_id = client.post("/api/v1/profiles", json={"name": "Second"}).json()["id"]
    sample_payload = {"source_type": "uploaded_image", "label_type": "word", "label_text": "hello"}
    sample_response = client.post(f"/api/v1/profiles/{first_id}/samples", json=sample_payload)
    assert sample_response.status_code == 201
    sample_id = sample_response.json()["id"]

    assert client.get(f"/api/v1/profiles/{first_id}/samples/not-a-sample").status_code == 404
    assert client.get(f"/api/v1/profiles/{second_id}/samples/{sample_id}").status_code == 404
    assert client.get(f"/api/v1/profiles/{second_id}/samples").json() == []
    assert client.post("/api/v1/profiles/not-a-profile/samples", json=sample_payload).status_code == 404
    assert client.get(f"/api/v1/profiles/{first_id}/samples/{sample_id}").status_code == 200

    assert client.delete(f"/api/v1/profiles/{first_id}").status_code == 409
    assert client.get(f"/api/v1/profiles/{first_id}/samples/{sample_id}").status_code == 200
    assert client.delete(f"/api/v1/profiles/{first_id}?confirm=true").status_code == 200
    assert client.get(f"/api/v1/profiles/{first_id}").status_code == 404
    assert client.get(f"/api/v1/profiles/{first_id}/samples/{sample_id}").status_code == 404
    assert client.get(f"/api/v1/profiles/{second_id}").status_code == 200


def test_stroke_round_trip_allows_missing_pressure_and_tilt(tmp_path, monkeypatch):
    database = setup_database(tmp_path, monkeypatch)
    client = TestClient(app)
    profile_id = client.post("/api/v1/profiles", json={"name": "Stylus"}).json()["id"]
    stroke_data = {"format_version": 1, "pointer_type": "pen", "canvas": {"width_px": 400, "height_px": 200}, "strokes": [{"points": [{"x": 0.1, "y": 0.2, "timestamp": 4.5}, {"x": 0.3, "y": 0.8, "timestamp": 8, "pressure": 0.7}]}], "events": [{"type": "pen_down", "timestamp": 4.5}, {"type": "pen_up", "timestamp": 8}], "pen_metadata": {"pointerId": 2}}
    created = client.post(f"/api/v1/profiles/{profile_id}/samples", json={"source_type": "stylus", "label_type": "character", "label_text": "a", "stroke_data": stroke_data})
    assert created.status_code == 201, created.text
    loaded = client.get(f"/api/v1/profiles/{profile_id}/samples/{created.json()['id']}").json()["stroke_data"]
    assert loaded == stroke_data
    stroke_files = list((database.parent / "inkmatch-assets").glob("*.stroke-v1.json"))
    assert len(stroke_files) == 1
    assert json.loads(stroke_files[0].read_text()) == stroke_data


def test_profile_sample_invalid_inputs_and_refs_are_rejected(tmp_path, monkeypatch):
    setup_database(tmp_path, monkeypatch)
    client = TestClient(app)
    assert client.post("/api/v1/profiles", json={"name": " "}).status_code == 422
    assert client.post("/api/v1/profiles", json={"name": "bad", "status": "Learned"}).status_code == 422
    profile_id = client.post("/api/v1/profiles", json={"name": "Valid"}).json()["id"]
    assert client.post(f"/api/v1/profiles/{profile_id}/samples", json={"source_type": "uploaded_image", "original_asset_ref": "../../secret"}).status_code == 422
    assert client.post(f"/api/v1/profiles/{profile_id}/samples", json={"source_type": "stylus", "stroke_data": {"format_version": 1, "pointer_type": "pen", "canvas": {"width_px": 100, "height_px": 100}, "strokes": [{"points": [{"x": 2, "y": 0, "timestamp": 1}]}]}}).status_code == 422
    assert client.get("/api/v1/profiles/not-a-uuid").status_code == 404


def _free_local_port():
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as probe:
        probe.bind(("127.0.0.1", 0))
        return probe.getsockname()[1]


def _start_isolated_backend(database, backend_root):
    bootstrap = """
import os
from pathlib import Path
from app import profiles
from app.paper import templates
database = Path(os.environ['INKMATCH_TEST_DATABASE'])
profiles.DATABASE = database
templates.DATABASE = database
import uvicorn
uvicorn.run('app.main:app', host='127.0.0.1', port=int(os.environ['INKMATCH_TEST_PORT']), log_level='error')
"""
    last_error = "server did not become ready"
    for _ in range(5):
        port = _free_local_port()
        environment = os.environ.copy()
        environment["INKMATCH_TEST_DATABASE"] = str(database)
        environment["INKMATCH_TEST_PORT"] = str(port)
        process = subprocess.Popen(
            [sys.executable, "-c", bootstrap],
            cwd=backend_root,
            env=environment,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        base_url = f"http://127.0.0.1:{port}"
        for _ in range(100):
            if process.poll() is not None:
                last_error = f"server exited with code {process.returncode}"
                break
            try:
                with urllib.request.urlopen(f"{base_url}/api/v1/health", timeout=0.2):
                    return process, base_url
            except (OSError, urllib.error.URLError):
                time.sleep(0.05)
        _stop_isolated_backend(process)
    raise RuntimeError(last_error)


def _stop_isolated_backend(process):
    if process.poll() is not None:
        return
    process.terminate()
    try:
        process.wait(timeout=5)
    except subprocess.TimeoutExpired:
        process.kill()
        process.wait(timeout=5)


def _request_json(base_url, path, method="GET", payload=None):
    body = None if payload is None else json.dumps(payload).encode("utf-8")
    request = urllib.request.Request(
        f"{base_url}{path}",
        data=body,
        method=method,
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(request, timeout=5) as response:
        return json.loads(response.read())


def test_profile_and_sample_survive_backend_process_restart(tmp_path):
    database = tmp_path / "restart.sqlite3"
    backend_root = Path(__file__).resolve().parents[1]
    first_process = second_process = None
    try:
        first_process, base_url = _start_isolated_backend(database, backend_root)
        profile = _request_json(
            base_url,
            "/api/v1/profiles",
            "POST",
            {
                "name": "Restart profile",
                "status": "Collecting Samples",
                "sample_sources": ["uploaded_image", "stylus"],
                "metadata": {"note": "persisted"},
            },
        )
        sample = _request_json(
            base_url,
            f"/api/v1/profiles/{profile['id']}/samples",
            "POST",
            {
                "source_type": "uploaded_image",
                "label_type": "sentence",
                "label_text": "InkMatch persists this sample.",
                "context": "in_sentence",
                "repetition_number": 2,
                "label_alignment": "unaligned",
                "quality_indicators": {"manual_review": True},
            },
        )
        _stop_isolated_backend(first_process)
        first_process = None

        second_process, restarted_url = _start_isolated_backend(database, backend_root)
        loaded_profile = _request_json(restarted_url, f"/api/v1/profiles/{profile['id']}")
        loaded_sample = _request_json(
            restarted_url,
            f"/api/v1/profiles/{profile['id']}/samples/{sample['id']}",
        )
        assert loaded_profile["name"] == "Restart profile"
        assert loaded_profile["sample_sources"] == ["stylus", "uploaded_image"]
        assert loaded_profile["metadata"] == {"note": "persisted"}
        assert loaded_profile["total_sample_count"] == 1
        assert loaded_sample["profile_id"] == profile["id"]
        assert loaded_sample["label_text"] == "InkMatch persists this sample."
        assert loaded_sample["label_alignment"] == "unaligned"
        assert loaded_sample["quality_indicators"] == {"manual_review": True}
    finally:
        if first_process is not None:
            _stop_isolated_backend(first_process)
        if second_process is not None:
            _stop_isolated_backend(second_process)


def test_image_asset_storage_uses_generated_names_and_rejects_paths(tmp_path):
    database = tmp_path / "inkmatch.sqlite3"
    image = b"local image bytes"
    reference = save_image_asset(database, image, "png")
    assert read_image_asset(database, reference, "png") == image
    assert list((tmp_path / "inkmatch-assets").glob("*.png"))[0].stem == reference
    try:
        read_image_asset(database, "..\\secret", "png")
    except ValueError:
        pass
    else:
        raise AssertionError("path-like image references must be rejected")
