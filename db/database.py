from __future__ import annotations
import sqlite3
from pathlib import Path
from typing import Iterable

SCHEMA = """
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS routine_versions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    source_filename TEXT NOT NULL,
    semester TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    pages_processed INTEGER NOT NULL,
    record_count INTEGER NOT NULL,
    warning_count INTEGER NOT NULL DEFAULT 0,
    repair_count INTEGER NOT NULL DEFAULT 0,
    file_hash TEXT
);

CREATE TABLE IF NOT EXISTS classes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    routine_version_id INTEGER NOT NULL REFERENCES routine_versions(id) ON DELETE CASCADE,
    source_record_id TEXT NOT NULL,
    page INTEGER NOT NULL,
    day TEXT NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    room TEXT NOT NULL DEFAULT '',
    course_code TEXT NOT NULL,
    group_code TEXT NOT NULL DEFAULT '',
    batch TEXT,
    section TEXT,
    subgroup TEXT,
    special_group TEXT,
    teacher TEXT NOT NULL DEFAULT '',
    UNIQUE(routine_version_id, source_record_id)
);

CREATE INDEX IF NOT EXISTS idx_classes_version_day_time
    ON classes(routine_version_id, day, start_time);
CREATE INDEX IF NOT EXISTS idx_classes_batch_section
    ON classes(routine_version_id, batch, section);
CREATE INDEX IF NOT EXISTS idx_classes_course
    ON classes(routine_version_id, course_code);
CREATE INDEX IF NOT EXISTS idx_classes_teacher
    ON classes(routine_version_id, teacher);
CREATE INDEX IF NOT EXISTS idx_classes_room
    ON classes(routine_version_id, room);
CREATE INDEX IF NOT EXISTS idx_classes_group
    ON classes(routine_version_id, group_code);

CREATE TABLE IF NOT EXISTS personal_overrides (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    routine_version_id INTEGER NOT NULL REFERENCES routine_versions(id) ON DELETE CASCADE,
    target_class_id INTEGER REFERENCES classes(id) ON DELETE CASCADE,
    override_type TEXT NOT NULL,
    day TEXT,
    start_time TEXT,
    end_time TEXT,
    room TEXT,
    course_code TEXT,
    group_code TEXT,
    batch TEXT,
    section TEXT,
    subgroup TEXT,
    special_group TEXT,
    teacher TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(routine_version_id, target_class_id)
);

CREATE VIEW IF NOT EXISTS effective_classes AS
-- 1. Original classes that HAVE NO OVERRIDES
SELECT 
    c.id as id,
    c.routine_version_id,
    'original' as record_type,
    c.page,
    c.day,
    c.start_time,
    c.end_time,
    c.room,
    c.course_code,
    c.group_code,
    c.batch,
    c.section,
    c.subgroup,
    c.special_group,
    c.teacher
FROM classes c
WHERE NOT EXISTS (
    SELECT 1 FROM personal_overrides o WHERE o.target_class_id = c.id
)

UNION ALL

-- 2. Classes that HAVE OVERRIDES (edited or hidden)
SELECT 
    c.id as id,
    c.routine_version_id,
    o.override_type as record_type,
    c.page,
    COALESCE(o.day, c.day) as day,
    COALESCE(o.start_time, c.start_time) as start_time,
    COALESCE(o.end_time, c.end_time) as end_time,
    COALESCE(o.room, c.room) as room,
    COALESCE(o.course_code, c.course_code) as course_code,
    COALESCE(o.group_code, c.group_code) as group_code,
    COALESCE(o.batch, c.batch) as batch,
    COALESCE(o.section, c.section) as section,
    COALESCE(o.subgroup, c.subgroup) as subgroup,
    COALESCE(o.special_group, c.special_group) as special_group,
    COALESCE(o.teacher, c.teacher) as teacher
FROM classes c
INNER JOIN personal_overrides o ON c.id = o.target_class_id

UNION ALL

-- 3. Manually added classes
SELECT 
    -o.id as id,
    o.routine_version_id,
    o.override_type as record_type,
    0 as page,
    o.day,
    o.start_time,
    o.end_time,
    o.room,
    o.course_code,
    o.group_code,
    o.batch,
    o.section,
    o.subgroup,
    o.special_group,
    o.teacher
FROM personal_overrides o
WHERE o.override_type = 'manually_added';

-- ============================================================
--  PERSONAL ACADEMIC PLANNER  (completely separate from routine)
-- ============================================================

CREATE TABLE IF NOT EXISTS planner_exams (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    course      TEXT,
    title       TEXT NOT NULL,
    exam_type   TEXT NOT NULL DEFAULT 'Other',
    date        TEXT NOT NULL,
    start_time  TEXT,
    end_time    TEXT,
    room        TEXT,
    syllabus    TEXT,
    notes       TEXT,
    created_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS planner_quizzes (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    course      TEXT,
    title       TEXT NOT NULL,
    date        TEXT NOT NULL,
    start_time  TEXT,
    end_time    TEXT,
    topic       TEXT,
    syllabus    TEXT,
    notes       TEXT,
    created_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS planner_assignments (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    course          TEXT,
    title           TEXT NOT NULL,
    topic           TEXT,
    description     TEXT,
    deadline_date   TEXT NOT NULL,
    deadline_time   TEXT,
    status          TEXT NOT NULL DEFAULT 'Pending',
    notes           TEXT,
    created_at      TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS planner_tasks (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    course      TEXT,
    title       TEXT NOT NULL,
    description TEXT,
    due_date    TEXT,
    due_time    TEXT,
    priority    TEXT NOT NULL DEFAULT 'Medium',
    status      TEXT NOT NULL DEFAULT 'Pending',
    notes       TEXT,
    created_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS planner_reminders (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    title       TEXT NOT NULL,
    date        TEXT NOT NULL,
    time        TEXT NOT NULL,
    notes       TEXT,
    repeat      TEXT NOT NULL DEFAULT 'None',
    created_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
"""


def connect(db_path: str | Path) -> sqlite3.Connection:
    Path(db_path).parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.executescript(SCHEMA)
    try:
        conn.execute("ALTER TABLE routine_versions ADD COLUMN file_hash TEXT")
    except sqlite3.OperationalError:
        pass  # Column already exists
    return conn


def import_records(conn: sqlite3.Connection, *, name: str, source_filename: str,
                   semester: str | None, pages_processed: int,
                   warning_count: int, repair_count: int, records: Iterable,
                   file_hash: str | None = None) -> int:
    records = list(records)
    with conn:
        cur = conn.execute(
            """INSERT INTO routine_versions
               (name, source_filename, semester, pages_processed, record_count, warning_count, repair_count, file_hash)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (name, source_filename, semester, pages_processed, len(records), warning_count, repair_count, file_hash),
        )
        version_id = cur.lastrowid
        conn.executemany(
            """INSERT INTO classes
               (routine_version_id, source_record_id, page, day, start_time, end_time,
                room, course_code, group_code, batch, section, subgroup, special_group, teacher)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            [(
                version_id, r.id, r.page, r.day, r.start_time, r.end_time,
                r.room, r.course_code, r.group_code, r.batch, r.section,
                r.subgroup, r.special_group, r.teacher,
            ) for r in records],
        )
    return int(version_id)


def latest_version_id(conn: sqlite3.Connection) -> int | None:
    row = conn.execute("SELECT id FROM routine_versions ORDER BY id DESC LIMIT 1").fetchone()
    return int(row[0]) if row else None
