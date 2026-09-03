"""Personal Academic Planner API router.

Completely isolated from routine data. Mounted on the main FastAPI app.
All planner data lives in planner_* tables — never touches classes/personal_overrides.
"""
from __future__ import annotations

from datetime import date, datetime
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from db.database import connect
from pathlib import Path
import os

router = APIRouter(prefix="/api/planner", tags=["planner"])

BASE_DIR = Path(__file__).resolve().parents[1]
DEFAULT_DB = BASE_DIR / "data" / "routine.db"


def db_path() -> Path:
    return Path(os.environ.get("ROUTINE_DB", str(DEFAULT_DB)))


def get_conn():
    return connect(db_path())


def row_to_dict(row):
    if not row:
        return None
    d = dict(row)
    for k in ['created_at', 'updated_at']:
        if k in d and isinstance(d[k], str) and ' ' in d[k] and not d[k].endswith('Z'):
            d[k] = d[k].replace(' ', 'T') + 'Z'
    return d




# ── Pydantic models ────────────────────────────────────────────────────────────

class ExamIn(BaseModel):
    course: Optional[str] = None
    title: str
    exam_type: str = "Other"
    date: str
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    room: Optional[str] = None
    syllabus: Optional[str] = None
    notes: Optional[str] = None


class QuizIn(BaseModel):
    course: Optional[str] = None
    title: str
    date: str
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    topic: Optional[str] = None
    syllabus: Optional[str] = None
    notes: Optional[str] = None


class AssignmentIn(BaseModel):
    course: Optional[str] = None
    title: str
    topic: Optional[str] = None
    description: Optional[str] = None
    deadline_date: str
    deadline_time: Optional[str] = None
    status: str = "Pending"
    notes: Optional[str] = None


class TaskIn(BaseModel):
    course: Optional[str] = None
    title: str
    description: Optional[str] = None
    due_date: Optional[str] = None
    due_time: Optional[str] = None
    priority: str = "Medium"
    status: str = "Pending"
    notes: Optional[str] = None


class ReminderIn(BaseModel):
    title: str
    date: str
    time: str
    notes: Optional[str] = None
    repeat: str = "None"


# ── Helpers ────────────────────────────────────────────────────────────────────

def _now() -> str:
    # Explicitly use UTC timezone for the backend timestamps
    from datetime import timezone
    return datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")


def _today() -> str:
    return date.today().isoformat()


def _validate_status(status: str, allowed: list[str]):
    if status not in allowed:
        raise HTTPException(status_code=422, detail=f"status must be one of {allowed}")


def _validate_priority(priority: str):
    if priority not in ("Low", "Medium", "High"):
        raise HTTPException(status_code=422, detail="priority must be Low, Medium or High")


def _validate_exam_type(exam_type: str):
    if exam_type not in ("Midterm", "Final", "Other"):
        raise HTTPException(status_code=422, detail="exam_type must be Midterm, Final or Other")


def _validate_repeat(repeat: str):
    if repeat not in ("None", "Daily", "Weekly", "Monthly"):
        raise HTTPException(status_code=422, detail="repeat must be None, Daily, Weekly or Monthly")


# ── EXAMS ─────────────────────────────────────────────────────────────────────

@router.get("/exams")
def list_exams(course: Optional[str] = None, from_date: Optional[str] = None):
    conn = get_conn()
    try:
        clauses, params = [], []
        if course:
            clauses.append("UPPER(course)=UPPER(?)")
            params.append(course)
        if from_date:
            clauses.append("date >= ?")
            params.append(from_date)
        where = ("WHERE " + " AND ".join(clauses)) if clauses else ""
        rows = conn.execute(
            f"SELECT * FROM planner_exams {where} ORDER BY date, start_time", params
        ).fetchall()
        return {"exams": [row_to_dict(r) for r in rows]}
    finally:
        conn.close()


@router.post("/exams", status_code=201)
def create_exam(body: ExamIn):
    _validate_exam_type(body.exam_type)
    conn = get_conn()
    try:
        now = _now()
        cur = conn.execute(
            """INSERT INTO planner_exams
               (course, title, exam_type, date, start_time, end_time, room, syllabus, notes, created_at, updated_at)
               VALUES (?,?,?,?,?,?,?,?,?,?,?)""",
            (body.course, body.title, body.exam_type, body.date,
             body.start_time, body.end_time, body.room, body.syllabus, body.notes, now, now),
        )
        conn.commit()
        row = conn.execute("SELECT * FROM planner_exams WHERE id=?", (cur.lastrowid,)).fetchone()
        return row_to_dict(row)
    finally:
        conn.close()


@router.put("/exams/{exam_id}")
def update_exam(exam_id: int, body: ExamIn):
    _validate_exam_type(body.exam_type)
    conn = get_conn()
    try:
        exists = conn.execute("SELECT 1 FROM planner_exams WHERE id=?", (exam_id,)).fetchone()
        if not exists:
            raise HTTPException(status_code=404, detail="Exam not found")
        now = _now()
        conn.execute(
            """UPDATE planner_exams SET course=?,title=?,exam_type=?,date=?,start_time=?,
               end_time=?,room=?,syllabus=?,notes=?,updated_at=? WHERE id=?""",
            (body.course, body.title, body.exam_type, body.date,
             body.start_time, body.end_time, body.room, body.syllabus, body.notes, now, exam_id),
        )
        conn.commit()
        row = conn.execute("SELECT * FROM planner_exams WHERE id=?", (exam_id,)).fetchone()
        return row_to_dict(row)
    finally:
        conn.close()


@router.delete("/exams/{exam_id}")
def delete_exam(exam_id: int):
    conn = get_conn()
    try:
        exists = conn.execute("SELECT 1 FROM planner_exams WHERE id=?", (exam_id,)).fetchone()
        if not exists:
            raise HTTPException(status_code=404, detail="Exam not found")
        conn.execute("DELETE FROM planner_exams WHERE id=?", (exam_id,))
        conn.commit()
        return {"status": "deleted"}
    finally:
        conn.close()


# ── QUIZZES ───────────────────────────────────────────────────────────────────

@router.get("/quizzes")
def list_quizzes(course: Optional[str] = None, from_date: Optional[str] = None):
    conn = get_conn()
    try:
        clauses, params = [], []
        if course:
            clauses.append("UPPER(course)=UPPER(?)")
            params.append(course)
        if from_date:
            clauses.append("date >= ?")
            params.append(from_date)
        where = ("WHERE " + " AND ".join(clauses)) if clauses else ""
        rows = conn.execute(
            f"SELECT * FROM planner_quizzes {where} ORDER BY date, start_time", params
        ).fetchall()
        return {"quizzes": [row_to_dict(r) for r in rows]}
    finally:
        conn.close()


@router.post("/quizzes", status_code=201)
def create_quiz(body: QuizIn):
    conn = get_conn()
    try:
        now = _now()
        cur = conn.execute(
            """INSERT INTO planner_quizzes
               (course, title, date, start_time, end_time, topic, syllabus, notes, created_at, updated_at)
               VALUES (?,?,?,?,?,?,?,?,?,?)""",
            (body.course, body.title, body.date, body.start_time, body.end_time,
             body.topic, body.syllabus, body.notes, now, now),
        )
        conn.commit()
        row = conn.execute("SELECT * FROM planner_quizzes WHERE id=?", (cur.lastrowid,)).fetchone()
        return row_to_dict(row)
    finally:
        conn.close()


@router.put("/quizzes/{quiz_id}")
def update_quiz(quiz_id: int, body: QuizIn):
    conn = get_conn()
    try:
        exists = conn.execute("SELECT 1 FROM planner_quizzes WHERE id=?", (quiz_id,)).fetchone()
        if not exists:
            raise HTTPException(status_code=404, detail="Quiz not found")
        now = _now()
        conn.execute(
            """UPDATE planner_quizzes SET course=?,title=?,date=?,start_time=?,
               end_time=?,topic=?,syllabus=?,notes=?,updated_at=? WHERE id=?""",
            (body.course, body.title, body.date, body.start_time, body.end_time,
             body.topic, body.syllabus, body.notes, now, quiz_id),
        )
        conn.commit()
        row = conn.execute("SELECT * FROM planner_quizzes WHERE id=?", (quiz_id,)).fetchone()
        return row_to_dict(row)
    finally:
        conn.close()


@router.delete("/quizzes/{quiz_id}")
def delete_quiz(quiz_id: int):
    conn = get_conn()
    try:
        exists = conn.execute("SELECT 1 FROM planner_quizzes WHERE id=?", (quiz_id,)).fetchone()
        if not exists:
            raise HTTPException(status_code=404, detail="Quiz not found")
        conn.execute("DELETE FROM planner_quizzes WHERE id=?", (quiz_id,))
        conn.commit()
        return {"status": "deleted"}
    finally:
        conn.close()


# ── ASSIGNMENTS ───────────────────────────────────────────────────────────────

ASSIGNMENT_STATUSES = ["Pending", "In Progress", "Completed"]


@router.get("/assignments")
def list_assignments(
    course: Optional[str] = None,
    status: Optional[str] = None,
    from_date: Optional[str] = None,
):
    conn = get_conn()
    try:
        clauses, params = [], []
        if course:
            clauses.append("UPPER(course)=UPPER(?)")
            params.append(course)
        if status:
            clauses.append("status=?")
            params.append(status)
        if from_date:
            clauses.append("deadline_date >= ?")
            params.append(from_date)
        where = ("WHERE " + " AND ".join(clauses)) if clauses else ""
        rows = conn.execute(
            f"SELECT * FROM planner_assignments {where} ORDER BY deadline_date, deadline_time", params
        ).fetchall()
        return {"assignments": [row_to_dict(r) for r in rows]}
    finally:
        conn.close()


@router.post("/assignments", status_code=201)
def create_assignment(body: AssignmentIn):
    _validate_status(body.status, ASSIGNMENT_STATUSES)
    conn = get_conn()
    try:
        now = _now()
        cur = conn.execute(
            """INSERT INTO planner_assignments
               (course, title, topic, description, deadline_date, deadline_time, status, notes, created_at, updated_at)
               VALUES (?,?,?,?,?,?,?,?,?,?)""",
            (body.course, body.title, body.topic, body.description,
             body.deadline_date, body.deadline_time, body.status, body.notes, now, now),
        )
        conn.commit()
        row = conn.execute("SELECT * FROM planner_assignments WHERE id=?", (cur.lastrowid,)).fetchone()
        return row_to_dict(row)
    finally:
        conn.close()


@router.put("/assignments/{assignment_id}")
def update_assignment(assignment_id: int, body: AssignmentIn):
    _validate_status(body.status, ASSIGNMENT_STATUSES)
    conn = get_conn()
    try:
        exists = conn.execute("SELECT 1 FROM planner_assignments WHERE id=?", (assignment_id,)).fetchone()
        if not exists:
            raise HTTPException(status_code=404, detail="Assignment not found")
        now = _now()
        conn.execute(
            """UPDATE planner_assignments SET course=?,title=?,topic=?,description=?,
               deadline_date=?,deadline_time=?,status=?,notes=?,updated_at=? WHERE id=?""",
            (body.course, body.title, body.topic, body.description,
             body.deadline_date, body.deadline_time, body.status, body.notes, now, assignment_id),
        )
        conn.commit()
        row = conn.execute("SELECT * FROM planner_assignments WHERE id=?", (assignment_id,)).fetchone()
        return row_to_dict(row)
    finally:
        conn.close()


@router.patch("/assignments/{assignment_id}/complete")
def toggle_assignment_complete(assignment_id: int):
    conn = get_conn()
    try:
        row = conn.execute(
            "SELECT status FROM planner_assignments WHERE id=?", (assignment_id,)
        ).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Assignment not found")
        new_status = "Pending" if row["status"] == "Completed" else "Completed"
        conn.execute(
            "UPDATE planner_assignments SET status=?, updated_at=? WHERE id=?",
            (new_status, _now(), assignment_id),
        )
        conn.commit()
        row = conn.execute("SELECT * FROM planner_assignments WHERE id=?", (assignment_id,)).fetchone()
        return row_to_dict(row)
    finally:
        conn.close()


@router.delete("/assignments/{assignment_id}")
def delete_assignment(assignment_id: int):
    conn = get_conn()
    try:
        exists = conn.execute("SELECT 1 FROM planner_assignments WHERE id=?", (assignment_id,)).fetchone()
        if not exists:
            raise HTTPException(status_code=404, detail="Assignment not found")
        conn.execute("DELETE FROM planner_assignments WHERE id=?", (assignment_id,))
        conn.commit()
        return {"status": "deleted"}
    finally:
        conn.close()


# ── TASKS ─────────────────────────────────────────────────────────────────────

TASK_STATUSES = ["Pending", "In Progress", "Completed"]


@router.get("/tasks")
def list_tasks(
    course: Optional[str] = None,
    status: Optional[str] = None,
    priority: Optional[str] = None,
):
    conn = get_conn()
    try:
        clauses, params = [], []
        if course:
            clauses.append("UPPER(course)=UPPER(?)")
            params.append(course)
        if status:
            clauses.append("status=?")
            params.append(status)
        if priority:
            clauses.append("priority=?")
            params.append(priority)
        where = ("WHERE " + " AND ".join(clauses)) if clauses else ""
        rows = conn.execute(
            f"SELECT * FROM planner_tasks {where} ORDER BY due_date NULLS LAST, due_time", params
        ).fetchall()
        return {"tasks": [row_to_dict(r) for r in rows]}
    finally:
        conn.close()


@router.post("/tasks", status_code=201)
def create_task(body: TaskIn):
    _validate_status(body.status, TASK_STATUSES)
    _validate_priority(body.priority)
    conn = get_conn()
    try:
        now = _now()
        cur = conn.execute(
            """INSERT INTO planner_tasks
               (course, title, description, due_date, due_time, priority, status, notes, created_at, updated_at)
               VALUES (?,?,?,?,?,?,?,?,?,?)""",
            (body.course, body.title, body.description, body.due_date,
             body.due_time, body.priority, body.status, body.notes, now, now),
        )
        conn.commit()
        row = conn.execute("SELECT * FROM planner_tasks WHERE id=?", (cur.lastrowid,)).fetchone()
        return row_to_dict(row)
    finally:
        conn.close()


@router.put("/tasks/{task_id}")
def update_task(task_id: int, body: TaskIn):
    _validate_status(body.status, TASK_STATUSES)
    _validate_priority(body.priority)
    conn = get_conn()
    try:
        exists = conn.execute("SELECT 1 FROM planner_tasks WHERE id=?", (task_id,)).fetchone()
        if not exists:
            raise HTTPException(status_code=404, detail="Task not found")
        now = _now()
        conn.execute(
            """UPDATE planner_tasks SET course=?,title=?,description=?,due_date=?,
               due_time=?,priority=?,status=?,notes=?,updated_at=? WHERE id=?""",
            (body.course, body.title, body.description, body.due_date,
             body.due_time, body.priority, body.status, body.notes, now, task_id),
        )
        conn.commit()
        row = conn.execute("SELECT * FROM planner_tasks WHERE id=?", (task_id,)).fetchone()
        return row_to_dict(row)
    finally:
        conn.close()


@router.patch("/tasks/{task_id}/complete")
def toggle_task_complete(task_id: int):
    conn = get_conn()
    try:
        row = conn.execute("SELECT status FROM planner_tasks WHERE id=?", (task_id,)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Task not found")
        new_status = "Pending" if row["status"] == "Completed" else "Completed"
        conn.execute(
            "UPDATE planner_tasks SET status=?, updated_at=? WHERE id=?",
            (new_status, _now(), task_id),
        )
        conn.commit()
        row = conn.execute("SELECT * FROM planner_tasks WHERE id=?", (task_id,)).fetchone()
        return row_to_dict(row)
    finally:
        conn.close()


@router.delete("/tasks/{task_id}")
def delete_task(task_id: int):
    conn = get_conn()
    try:
        exists = conn.execute("SELECT 1 FROM planner_tasks WHERE id=?", (task_id,)).fetchone()
        if not exists:
            raise HTTPException(status_code=404, detail="Task not found")
        conn.execute("DELETE FROM planner_tasks WHERE id=?", (task_id,))
        conn.commit()
        return {"status": "deleted"}
    finally:
        conn.close()


# ── REMINDERS ─────────────────────────────────────────────────────────────────

@router.get("/reminders")
def list_reminders(from_date: Optional[str] = None):
    conn = get_conn()
    try:
        clauses, params = [], []
        if from_date:
            clauses.append("date >= ?")
            params.append(from_date)
        where = ("WHERE " + " AND ".join(clauses)) if clauses else ""
        rows = conn.execute(
            f"SELECT * FROM planner_reminders {where} ORDER BY date, time", params
        ).fetchall()
        return {"reminders": [row_to_dict(r) for r in rows]}
    finally:
        conn.close()


@router.post("/reminders", status_code=201)
def create_reminder(body: ReminderIn):
    _validate_repeat(body.repeat)
    conn = get_conn()
    try:
        now = _now()
        cur = conn.execute(
            """INSERT INTO planner_reminders
               (title, date, time, notes, repeat, created_at, updated_at)
               VALUES (?,?,?,?,?,?,?)""",
            (body.title, body.date, body.time, body.notes, body.repeat, now, now),
        )
        conn.commit()
        row = conn.execute("SELECT * FROM planner_reminders WHERE id=?", (cur.lastrowid,)).fetchone()
        return row_to_dict(row)
    finally:
        conn.close()


@router.put("/reminders/{reminder_id}")
def update_reminder(reminder_id: int, body: ReminderIn):
    _validate_repeat(body.repeat)
    conn = get_conn()
    try:
        exists = conn.execute("SELECT 1 FROM planner_reminders WHERE id=?", (reminder_id,)).fetchone()
        if not exists:
            raise HTTPException(status_code=404, detail="Reminder not found")
        now = _now()
        conn.execute(
            """UPDATE planner_reminders SET title=?,date=?,time=?,notes=?,repeat=?,updated_at=? WHERE id=?""",
            (body.title, body.date, body.time, body.notes, body.repeat, now, reminder_id),
        )
        conn.commit()
        row = conn.execute("SELECT * FROM planner_reminders WHERE id=?", (reminder_id,)).fetchone()
        return row_to_dict(row)
    finally:
        conn.close()


@router.delete("/reminders/{reminder_id}")
def delete_reminder(reminder_id: int):
    conn = get_conn()
    try:
        exists = conn.execute("SELECT 1 FROM planner_reminders WHERE id=?", (reminder_id,)).fetchone()
        if not exists:
            raise HTTPException(status_code=404, detail="Reminder not found")
        conn.execute("DELETE FROM planner_reminders WHERE id=?", (reminder_id,))
        conn.commit()
        return {"status": "deleted"}
    finally:
        conn.close()


# ── AGGREGATED VIEWS ──────────────────────────────────────────────────────────

@router.get("/today")
def today_view():
    """All planner events for today, sorted by time."""
    conn = get_conn()
    today = _today()
    try:
        exams = [
            {**row_to_dict(r), "item_type": "exam"}
            for r in conn.execute(
                "SELECT * FROM planner_exams WHERE date=? ORDER BY start_time", (today,)
            ).fetchall()
        ]
        quizzes = [
            {**row_to_dict(r), "item_type": "quiz"}
            for r in conn.execute(
                "SELECT * FROM planner_quizzes WHERE date=? ORDER BY start_time", (today,)
            ).fetchall()
        ]
        assignments = [
            {**row_to_dict(r), "item_type": "assignment"}
            for r in conn.execute(
                "SELECT * FROM planner_assignments WHERE deadline_date=? AND status != 'Completed' ORDER BY deadline_time",
                (today,),
            ).fetchall()
        ]
        tasks = [
            {**row_to_dict(r), "item_type": "task"}
            for r in conn.execute(
                "SELECT * FROM planner_tasks WHERE due_date=? AND status != 'Completed' ORDER BY due_time",
                (today,),
            ).fetchall()
        ]
        reminders = [
            {**row_to_dict(r), "item_type": "reminder"}
            for r in conn.execute(
                "SELECT * FROM planner_reminders WHERE date=? ORDER BY time", (today,)
            ).fetchall()
        ]
        return {
            "date": today,
            "exams": exams,
            "quizzes": quizzes,
            "assignments": assignments,
            "tasks": tasks,
            "reminders": reminders,
        }
    finally:
        conn.close()


@router.get("/upcoming")
def upcoming_view(days: int = 14):
    """Items in the next N days (default 14), excluding today."""
    from datetime import timedelta
    conn = get_conn()
    today = _today()
    end = (date.today() + timedelta(days=days)).isoformat()
    try:
        exams = [
            {**row_to_dict(r), "item_type": "exam"}
            for r in conn.execute(
                "SELECT * FROM planner_exams WHERE date > ? AND date <= ? ORDER BY date, start_time",
                (today, end),
            ).fetchall()
        ]
        quizzes = [
            {**row_to_dict(r), "item_type": "quiz"}
            for r in conn.execute(
                "SELECT * FROM planner_quizzes WHERE date > ? AND date <= ? ORDER BY date, start_time",
                (today, end),
            ).fetchall()
        ]
        assignments = [
            {**row_to_dict(r), "item_type": "assignment"}
            for r in conn.execute(
                """SELECT * FROM planner_assignments
                   WHERE deadline_date > ? AND deadline_date <= ? AND status != 'Completed'
                   ORDER BY deadline_date, deadline_time""",
                (today, end),
            ).fetchall()
        ]
        tasks = [
            {**row_to_dict(r), "item_type": "task"}
            for r in conn.execute(
                """SELECT * FROM planner_tasks
                   WHERE due_date > ? AND due_date <= ? AND status != 'Completed'
                   ORDER BY due_date, due_time""",
                (today, end),
            ).fetchall()
        ]
        reminders = [
            {**row_to_dict(r), "item_type": "reminder"}
            for r in conn.execute(
                "SELECT * FROM planner_reminders WHERE date > ? AND date <= ? ORDER BY date, time",
                (today, end),
            ).fetchall()
        ]
        return {
            "from": today,
            "to": end,
            "exams": exams,
            "quizzes": quizzes,
            "assignments": assignments,
            "tasks": tasks,
            "reminders": reminders,
        }
    finally:
        conn.close()


@router.get("/overdue")
def overdue_view():
    """Incomplete assignments and tasks with past due dates."""
    conn = get_conn()
    today = _today()
    try:
        assignments = [
            {**row_to_dict(r), "item_type": "assignment"}
            for r in conn.execute(
                """SELECT * FROM planner_assignments
                   WHERE deadline_date < ? AND status != 'Completed'
                   ORDER BY deadline_date""",
                (today,),
            ).fetchall()
        ]
        tasks = [
            {**row_to_dict(r), "item_type": "task"}
            for r in conn.execute(
                """SELECT * FROM planner_tasks
                   WHERE due_date IS NOT NULL AND due_date < ? AND status != 'Completed'
                   ORDER BY due_date""",
                (today,),
            ).fetchall()
        ]
        return {
            "as_of": today,
            "assignments": assignments,
            "tasks": tasks,
            "total": len(assignments) + len(tasks),
        }
    finally:
        conn.close()


@router.get("/calendar")
def calendar_view(year: int, month: int):
    """All events for a given year-month, keyed by ISO date."""
    from calendar import monthrange
    conn = get_conn()
    start = f"{year:04d}-{month:02d}-01"
    _, last_day = monthrange(year, month)
    end = f"{year:04d}-{month:02d}-{last_day:02d}"
    try:
        events: dict[str, list] = {}

        def add(rows, item_type: str, date_field: str):
            for r in rows:
                d = dict(r)
                key = d[date_field]
                if key:
                    events.setdefault(key, []).append({**d, "item_type": item_type})

        add(
            conn.execute("SELECT * FROM planner_exams WHERE date BETWEEN ? AND ?", (start, end)).fetchall(),
            "exam", "date",
        )
        add(
            conn.execute("SELECT * FROM planner_quizzes WHERE date BETWEEN ? AND ?", (start, end)).fetchall(),
            "quiz", "date",
        )
        add(
            conn.execute(
                "SELECT * FROM planner_assignments WHERE deadline_date BETWEEN ? AND ?", (start, end)
            ).fetchall(),
            "assignment", "deadline_date",
        )
        add(
            conn.execute(
                "SELECT * FROM planner_tasks WHERE due_date BETWEEN ? AND ?", (start, end)
            ).fetchall(),
            "task", "due_date",
        )
        add(
            conn.execute(
                "SELECT * FROM planner_reminders WHERE date BETWEEN ? AND ?", (start, end)
            ).fetchall(),
            "reminder", "date",
        )
        return {"year": year, "month": month, "events": events}
    finally:
        conn.close()
