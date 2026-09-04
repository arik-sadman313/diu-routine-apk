import { Capacitor } from '@capacitor/core';
import { CapacitorSQLite, SQLiteConnection, SQLiteDBConnection } from '@capacitor-community/sqlite';

const DB_NAME = "routine_db";

export const SCHEMA = `
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
CREATE TABLE IF NOT EXISTS custom_courses (
    course_code TEXT PRIMARY KEY,
    course_name TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
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
`;

class DatabaseService {
  private sqlite: SQLiteConnection;
  private db!: SQLiteDBConnection;
  private isInitialized = false;

  constructor() {
    this.sqlite = new SQLiteConnection(CapacitorSQLite);
  }

  async init() {
    if (this.isInitialized) return;
    if (!Capacitor.isNativePlatform()) return;

    try {
      // Create or open the database
      this.db = await this.sqlite.createConnection(DB_NAME, false, "no-encryption", 1, false);
      await this.db.open();

      // Execute schema
      await this.db.execute(SCHEMA);

      // Add missing column safely if we ever need migrations
      try {
        await this.db.execute("ALTER TABLE routine_versions ADD COLUMN file_hash TEXT");
      } catch (e) {
        // Column probably already exists
      }

      this.isInitialized = true;
      console.log('Database initialized successfully');
    } catch (error) {
      console.error('Failed to initialize local SQLite database:', error);
      throw error;
    }
  }

  getDb(): SQLiteDBConnection {
    if (!this.isInitialized) {
      throw new Error('Database not initialized yet');
    }
    return this.db;
  }
}

export const dbService = new DatabaseService();
