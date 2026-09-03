from fastapi.testclient import TestClient
from api.main import app
import sqlite3

client = TestClient(app)

def test_repro():
    conn = sqlite3.connect("data/routine.db")
    version = conn.execute("SELECT MAX(id) FROM routine_versions").fetchone()[0]
    
    # get a class from this version
    c = conn.execute("SELECT id, batch, section FROM classes WHERE routine_version_id=? LIMIT 1", (version,)).fetchone()
    c_id, batch, section = c
    
    # check effective classes
    orig = client.get(f"/api/classes?version_id={version}&batch={batch}&section={section}").json()
    count_orig = len(orig['classes'])
    
    # apply an edit
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
    
    # check effective classes again
    edited = client.get(f"/api/classes?version_id={version}&batch={batch}&section={section}").json()
    count_edited = len(edited['classes'])
    
    # count how many times this class ID appears
    appearances = [cls for cls in edited['classes'] if cls['id'] == c_id]
    appearances_by_course = [cls for cls in edited['classes'] if cls['course_code'] == "COURSE1" and cls['room'] == "ROOM1"]
    
    print(f"Original count: {count_orig}, Edited count: {count_edited}")
    print(f"Appearances of ID {c_id}: {len(appearances)}")
    print(f"Appearances of COURSE1: {len(appearances_by_course)}")

test_repro()
