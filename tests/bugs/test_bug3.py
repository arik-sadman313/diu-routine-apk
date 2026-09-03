from fastapi.testclient import TestClient
from api.main import app
import sqlite3

client = TestClient(app)

def test_repro():
    conn = sqlite3.connect("data/routine.db")
    version = conn.execute("SELECT MAX(id) FROM routine_versions").fetchone()[0]
    
    conn.execute("DELETE FROM personal_overrides")
    conn.commit()
    
    # get a visible class
    c = conn.execute("SELECT id, batch, section FROM classes WHERE routine_version_id=? AND batch IS NOT NULL LIMIT 1", (version,)).fetchone()
    c_id, batch, section = c
    
    orig = client.get(f"/api/classes?version_id={version}&batch={batch}&section={section}").json()
    orig_cls = [x for x in orig['classes'] if x['id'] == c_id]
    
    print(f"Original API response for {c_id}:")
    print(orig_cls)
    
    req = {
        "target_class_id": c_id,
        "override_type": "edited",
        "day": "Monday",
        "start_time": "10:00",
        "end_time": "11:30",
        "room": "ROOM1",
        "course_code": "COURSE1",
        "group_code": "",
        "batch": batch,
        "section": section,
        "subgroup": "",
        "special_group": "",
        "teacher": "T1"
    }
    client.post(f"/api/routine/{version}/overrides", json=req)
    
    edited = client.get(f"/api/classes?version_id={version}&batch={batch}&section={section}").json()
    
    # find all classes with the new course_code or the old id
    appearances = [x for x in edited['classes'] if x['id'] == c_id or x['course_code'] == "COURSE1"]
    
    print(f"Edited API response:")
    print(appearances)

test_repro()
