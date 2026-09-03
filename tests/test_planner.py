"""Backend tests for the Personal Academic Planner.

Tests: create/edit/delete for all 5 types, toggle-complete, overdue detection,
optional course, no-course items, and regression guard (routine tables untouched).
"""
from fastapi.testclient import TestClient
from api.main import app

client = TestClient(app)
TODAY = __import__('datetime').date.today().isoformat()
YESTERDAY = (__import__('datetime').date.today() - __import__('datetime').timedelta(days=1)).isoformat()
TOMORROW = (__import__('datetime').date.today() + __import__('datetime').timedelta(days=1)).isoformat()


# ── helpers ────────────────────────────────────────────────────────────────────

def post(path, body):
    r = client.post(path, json=body)
    assert r.status_code == 201, f"POST {path} → {r.status_code}: {r.text}"
    return r.json()

def put(path, body):
    r = client.put(path, json=body)
    assert r.status_code == 200, f"PUT {path} → {r.status_code}: {r.text}"
    return r.json()

def delete(path):
    r = client.delete(path)
    assert r.status_code == 200, f"DELETE {path} → {r.status_code}: {r.text}"

def patch(path):
    r = client.patch(path)
    assert r.status_code == 200, f"PATCH {path} → {r.status_code}: {r.text}"
    return r.json()

def get(path):
    r = client.get(path)
    assert r.status_code == 200, f"GET {path} → {r.status_code}: {r.text}"
    return r.json()


# ── EXAMS ──────────────────────────────────────────────────────────────────────

def test_exam_crud():
    # Create with course
    e = post("/api/planner/exams", {
        "title": "CSE221 Midterm", "course": "CSE221",
        "exam_type": "Midterm", "date": TOMORROW,
        "start_time": "09:00", "end_time": "11:00",
    })
    assert e["title"] == "CSE221 Midterm"
    assert e["course"] == "CSE221"
    assert e["exam_type"] == "Midterm"
    eid = e["id"]

    # Edit
    updated = put(f"/api/planner/exams/{eid}", {
        "title": "CSE221 Midterm Edited", "course": "CSE221",
        "exam_type": "Midterm", "date": TOMORROW,
    })
    assert updated["title"] == "CSE221 Midterm Edited"

    # List contains it
    lst = get("/api/planner/exams")
    ids = [x["id"] for x in lst["exams"]]
    assert eid in ids

    # Delete
    delete(f"/api/planner/exams/{eid}")
    lst2 = get("/api/planner/exams")
    assert eid not in [x["id"] for x in lst2["exams"]]
    print("✓ Exam CRUD")


# ── QUIZZES ────────────────────────────────────────────────────────────────────

def test_quiz_crud():
    q = post("/api/planner/quizzes", {
        "title": "CSE222 Quiz 1", "course": "CSE222",
        "date": TOMORROW, "topic": "Linked List", "syllabus": "Chapter 3",
    })
    qid = q["id"]
    assert q["topic"] == "Linked List"
    assert q["syllabus"] == "Chapter 3"

    put(f"/api/planner/quizzes/{qid}", {
        "title": "CSE222 Quiz 1 Updated", "course": "CSE222",
        "date": TOMORROW, "topic": "Trees",
    })

    delete(f"/api/planner/quizzes/{qid}")
    lst = get("/api/planner/quizzes")
    assert qid not in [x["id"] for x in lst["quizzes"]]
    print("✓ Quiz CRUD")


# ── ASSIGNMENTS ────────────────────────────────────────────────────────────────

def test_assignment_crud_and_complete():
    a = post("/api/planner/assignments", {
        "title": "CSE223 Assignment 1", "course": "CSE223",
        "deadline_date": TOMORROW, "status": "Pending",
    })
    aid = a["id"]
    assert a["status"] == "Pending"

    # Edit
    put(f"/api/planner/assignments/{aid}", {
        "title": "CSE223 Assignment 1", "course": "CSE223",
        "deadline_date": TOMORROW, "status": "In Progress",
    })

    # Toggle complete
    toggled = patch(f"/api/planner/assignments/{aid}/complete")
    assert toggled["status"] == "Completed"

    # Undo complete
    undone = patch(f"/api/planner/assignments/{aid}/complete")
    assert undone["status"] == "Pending"

    delete(f"/api/planner/assignments/{aid}")
    print("✓ Assignment CRUD + complete toggle")


def test_assignment_overdue():
    a = post("/api/planner/assignments", {
        "title": "Overdue Assignment", "deadline_date": YESTERDAY, "status": "Pending",
    })
    aid = a["id"]

    # Overdue endpoint should include it
    overdue = get("/api/planner/overdue")
    ids = [x["id"] for x in overdue["assignments"]]
    assert aid in ids

    # Complete it → no longer overdue
    patch(f"/api/planner/assignments/{aid}/complete")
    overdue2 = get("/api/planner/overdue")
    ids2 = [x["id"] for x in overdue2["assignments"]]
    assert aid not in ids2

    delete(f"/api/planner/assignments/{aid}")
    print("✓ Assignment overdue detection")


# ── TASKS ──────────────────────────────────────────────────────────────────────

def test_task_crud_and_complete():
    # Task WITHOUT course (general task)
    t = post("/api/planner/tasks", {
        "title": "Finish CSE223 report",
        "priority": "High", "status": "Pending",
        "due_date": TOMORROW,
    })
    tid = t["id"]
    assert t["course"] is None
    assert t["priority"] == "High"

    toggled = patch(f"/api/planner/tasks/{tid}/complete")
    assert toggled["status"] == "Completed"

    undone = patch(f"/api/planner/tasks/{tid}/complete")
    assert undone["status"] == "Pending"

    delete(f"/api/planner/tasks/{tid}")
    print("✓ Task CRUD + complete toggle (no course)")


def test_task_overdue():
    t = post("/api/planner/tasks", {
        "title": "Past Due Task", "due_date": YESTERDAY, "status": "Pending", "priority": "Medium",
    })
    tid = t["id"]
    overdue = get("/api/planner/overdue")
    ids = [x["id"] for x in overdue["tasks"]]
    assert tid in ids

    patch(f"/api/planner/tasks/{tid}/complete")
    overdue2 = get("/api/planner/overdue")
    assert tid not in [x["id"] for x in overdue2["tasks"]]

    delete(f"/api/planner/tasks/{tid}")
    print("✓ Task overdue detection")


# ── REMINDERS ──────────────────────────────────────────────────────────────────

def test_reminder_crud():
    r = post("/api/planner/reminders", {
        "title": "Study for CSE221", "date": TOMORROW, "time": "20:00", "repeat": "None",
    })
    rid = r["id"]
    assert r["title"] == "Study for CSE221"

    put(f"/api/planner/reminders/{rid}", {
        "title": "Study for CSE221 Updated", "date": TOMORROW, "time": "21:00", "repeat": "Weekly",
    })

    delete(f"/api/planner/reminders/{rid}")
    lst = get("/api/planner/reminders")
    assert rid not in [x["id"] for x in lst["reminders"]]
    print("✓ Reminder CRUD")


# ── OPTIONAL COURSE / NO COURSE ────────────────────────────────────────────────

def test_no_course_items():
    # Exam with no course
    e = post("/api/planner/exams", {"title": "General Test", "exam_type": "Other", "date": TOMORROW})
    assert e["course"] is None
    delete(f"/api/planner/exams/{e['id']}")

    # Task with no course and no due date
    t = post("/api/planner/tasks", {"title": "General Todo", "priority": "Low", "status": "Pending"})
    assert t["course"] is None
    assert t["due_date"] is None
    delete(f"/api/planner/tasks/{t['id']}")
    print("✓ No-course items work correctly")


# ── AGGREGATED VIEWS ──────────────────────────────────────────────────────────

def test_today_view():
    e = post("/api/planner/exams", {"title": "Today Exam", "exam_type": "Other", "date": TODAY})
    data = get("/api/planner/today")
    assert data["date"] == TODAY
    ids = [x["id"] for x in data["exams"]]
    assert e["id"] in ids
    delete(f"/api/planner/exams/{e['id']}")
    print("✓ Today view")


def test_upcoming_view():
    e = post("/api/planner/exams", {"title": "Upcoming Exam", "exam_type": "Final", "date": TOMORROW})
    data = get("/api/planner/upcoming")
    ids = [x["id"] for x in data["exams"]]
    assert e["id"] in ids
    delete(f"/api/planner/exams/{e['id']}")
    print("✓ Upcoming view")


def test_calendar_view():
    import datetime
    y, m = datetime.date.today().year, datetime.date.today().month
    e = post("/api/planner/exams", {"title": "Cal Exam", "exam_type": "Other", "date": TODAY})
    data = get(f"/api/planner/calendar?year={y}&month={m}")
    assert TODAY in data["events"]
    ids = [x["id"] for x in data["events"][TODAY]]
    assert e["id"] in ids
    delete(f"/api/planner/exams/{e['id']}")
    print("✓ Calendar view")


# ── REGRESSION: routine tables untouched ─────────────────────────────────────

def test_routine_tables_untouched():
    """Planner operations must not create/modify any routine records."""
    from db.database import connect
    from pathlib import Path
    conn = connect(Path("data/routine.db"))
    classes_before = conn.execute("SELECT COUNT(*) FROM classes").fetchone()[0]
    overrides_before = conn.execute("SELECT COUNT(*) FROM personal_overrides").fetchone()[0]

    # Add a bunch of planner items
    ids = []
    ids.append(post("/api/planner/exams", {"title": "R-Test Exam", "exam_type": "Other", "date": TOMORROW})["id"])
    ids.append(post("/api/planner/tasks", {"title": "R-Test Task", "priority": "Low", "status": "Pending"})["id"])

    classes_after = conn.execute("SELECT COUNT(*) FROM classes").fetchone()[0]
    overrides_after = conn.execute("SELECT COUNT(*) FROM personal_overrides").fetchone()[0]
    conn.close()

    assert classes_before == classes_after, "classes table was modified!"
    assert overrides_before == overrides_after, "personal_overrides was modified!"

    delete(f"/api/planner/exams/{ids[0]}")
    delete(f"/api/planner/tasks/{ids[1]}")
    print("✓ Routine tables untouched")


if __name__ == "__main__":
    test_exam_crud()
    test_quiz_crud()
    test_assignment_crud_and_complete()
    test_assignment_overdue()
    test_task_crud_and_complete()
    test_task_overdue()
    test_reminder_crud()
    test_no_course_items()
    test_today_view()
    test_upcoming_view()
    test_calendar_view()
    test_routine_tables_untouched()
    print("\n✅ All planner tests passed!")
