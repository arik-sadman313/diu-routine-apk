import pytest
from fastapi.testclient import TestClient
from api.main import app, get_conn

client = TestClient(app)

def test_overrides():
    res = client.get("/api/versions")
    assert res.status_code == 200
    versions = res.json()["versions"]
    if not versions:
        pytest.skip("No versions imported")
    vid = versions[0]["id"]
    
    # Add manual class with unique signature
    unique_course = "TEST999X"
    res = client.post(f"/api/routine/{vid}/overrides", json={
        "override_type": "manually_added",
        "day": "Friday",
        "start_time": "14:00",
        "end_time": "15:00",
        "course_code": unique_course,
        "batch": "99",
        "section": "Z"
    })
    assert res.status_code == 200
    
    # Find manual class
    res = client.get(f"/api/classes?version_id={vid}&limit=5000")
    manuals = [c for c in res.json()["classes"] if c["course_code"] == unique_course]
    assert len(manuals) == 1, f"Expected 1 manual class, found {len(manuals)}"
    
    mcid = manuals[0]["id"]
    assert mcid < 0, f"Expected negative ID for manual class, got {mcid}"
    assert manuals[0]["record_type"] == "manually_added"
    
    # Delete manual class
    res = client.delete(f"/api/routine/{vid}/classes/{mcid}")
    assert res.status_code == 200
    
    # Verify deletion
    res = client.get(f"/api/classes?version_id={vid}&limit=5000")
    manuals = [c for c in res.json()["classes"] if c["course_code"] == unique_course]
    assert len(manuals) == 0, "Manual class should have been deleted"

    print("All backend tests for Add Class passed successfully!")

if __name__ == "__main__":
    test_overrides()
