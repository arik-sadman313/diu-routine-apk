from fastapi.testclient import TestClient
from api.main import app
import sqlite3

client = TestClient(app)

def test_repro():
    conn = sqlite3.connect("data/routine.db")
    version = conn.execute("SELECT MAX(id) FROM routine_versions").fetchone()[0]
    
    # Let's get a specific class
    c = conn.execute("SELECT * FROM classes WHERE routine_version_id=? LIMIT 1", (version,)).fetchone()
    keys = [desc[0] for desc in conn.execute("SELECT * FROM classes LIMIT 1").description]
    orig_class = dict(zip(keys, c))
    
    # Post an edit
    req = {
        "target_class_id": orig_class['id'],
        "override_type": "edited",
        "day": "Monday",
        "start_time": "10:00",
        "end_time": "11:30",
        "room": "ROOM1",
        "course_code": "COURSE1",
        "group_code": "",
        "batch": orig_class['batch'],
        "section": orig_class['section'],
        "subgroup": "",
        "special_group": "",
        "teacher": "T1"
    }
    client.post(f"/api/routine/{version}/overrides", json=req)
    
    # Get all effective classes for that batch and section
    res = client.get(f"/api/classes?version_id={version}&batch={orig_class['batch']}&section={orig_class['section']}").json()
    
    # Check what classes are returned
    classes = res['classes']
    
    # Find classes with the original id OR the new course_code
    found = [cls for cls in classes if cls['id'] == orig_class['id'] or cls['course_code'] == 'COURSE1' or cls['course_code'] == orig_class['course_code']]
    
    print(f"Total classes in batch {orig_class['batch']} section {orig_class['section']}: {len(classes)}")
    print("Found matching classes:")
    for cls in found:
        print(cls)
        
test_repro()
