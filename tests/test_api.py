from pathlib import Path
import os
import sys

from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))


def make_client(tmp_path, monkeypatch):
    monkeypatch.setenv("ROUTINE_DB", str(tmp_path / "routine.db"))
    from api.main import app
    return TestClient(app)


def seed(client, pdf):
    with open(pdf, "rb") as f:
        response = client.post("/api/upload", files={"file": ("Summer-2026.pdf", f, "application/pdf")})
    assert response.status_code == 200, response.text
    return response.json()


def test_api_routine_and_options(tmp_path, monkeypatch):
    client = make_client(tmp_path, monkeypatch)
    pdf = Path(__file__).resolve().parents[0] / "fixtures/input.pdf"
    upload = seed(client, pdf)
    assert upload["record_count"] == 2007
    assert upload["warning_count"] == 0
    assert upload["semester"] == "Summer 2026"

    routine = client.get("/api/routine/70/G")
    assert routine.status_code == 200
    assert routine.json()["count"] == 18
    assert all(x["batch"] == "70" and x["section"] == "G" for x in routine.json()["classes"])

    options = client.get("/api/options")
    assert options.status_code == 200
    assert "70" in options.json()["batches"]
    assert {"batch": "70", "section": "G"} in options.json()["batch_sections"]


def test_api_search(tmp_path, monkeypatch):
    client = make_client(tmp_path, monkeypatch)
    pdf = Path(__file__).resolve().parents[0] / "fixtures/input.pdf"
    seed(client, pdf)
    response = client.get("/api/search", params={"q": "KT-810"})
    assert response.status_code == 200
    assert response.json()["count"] > 0
    assert all("KT-810" in x["room"] for x in response.json()["classes"])

def test_api_upload_manual_confirm(tmp_path, monkeypatch):
    import json
    import src.parser
    from src.models import ParsingResult, ParsingSummary, DiagnosticRecord, Severity, Stage, Resolution
    
    orig_parse = src.parser.parse_pdf
    
    def mock_parse(pdf_path, manual_corrections=None, original_filename=None):
        res = orig_parse(pdf_path, manual_corrections=manual_corrections, original_filename=original_filename)
        if manual_corrections:
            # Assume success
            res.diagnostics.unresolved = []
            return res
        else:
            # Force unresolved
            res.diagnostics.unresolved = [
                DiagnosticRecord(severity=Severity.WARNING, stage=Stage.AI, resolution=Resolution.UNRESOLVED,
                page=1, day="Monday", time="10:00", room="G1-007", raw_text="BAD_CLASS", message="unresolved")
            ]
            return res
            
    monkeypatch.setattr("api.main.parse_pdf", mock_parse)
    client = make_client(tmp_path, monkeypatch)
    pdf = Path(__file__).resolve().parents[0] / "fixtures/input.pdf"
    
    with open(pdf, "rb") as f:
        response = client.post("/api/upload", files={"file": ("Summer-2026.pdf", f, "application/pdf")})
        
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "needs_review"
    assert "session_id" in data
    assert len(data["unresolved"]) == 1
    
    session_id = data["session_id"]
    
    # Send confirm
    corrections = [{
        "page": 1,
        "day": "Monday",
        "time": "10:00",
        "room": "G1-007",
        "raw_text": "BAD_CLASS",
        "course_code": "CSE111",
        "group_code": "A",
        "teacher": "TEA",
        "start_time": "10:00",
        "end_time": "11:30"
    }]
    
    resp_confirm = client.post("/api/upload/confirm", data={
        "session_id": session_id,
        "filename": "dummy.pdf",
        "corrections": json.dumps(corrections)
    })
    
    assert resp_confirm.status_code == 200
    assert resp_confirm.json()["message"] == "Routine imported successfully."
