import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { dbService } from './databaseService';
import type {
  PlannerExam, PlannerQuiz, PlannerAssignment, PlannerTask, PlannerReminder,
  ExamInput, QuizInput, AssignmentInput, TaskInput, ReminderInput,
  TodayResponse, UpcomingResponse, OverdueResponse, CalendarResponse,
} from '../types/planner';

function nowUtc() {
  return new Date().toISOString().replace('T', ' ').substring(0, 19);
}
function todayStr() {
  return new Date().toISOString().split('T')[0];
}

async function scheduleNotification(id: number, title: string, date: string, time: string) {
  if (!Capacitor.isNativePlatform()) return;
  try {
    const perm = await LocalNotifications.checkPermissions();
    if (perm.display !== 'granted') {
      await LocalNotifications.requestPermissions();
    }
    
    // Parse date and time to Date object
    // Assuming date is YYYY-MM-DD and time is HH:MM
    const scheduleDate = new Date(`${date}T${time}:00`);
    if (scheduleDate.getTime() > Date.now()) {
      await LocalNotifications.schedule({
        notifications: [
          {
            id: id,
            title: 'DIU Routine Reminder',
            body: title,
            schedule: { at: scheduleDate },
            sound: undefined,
            attachments: undefined,
            actionTypeId: '',
            extra: null
          }
        ]
      });
    }
  } catch (e) {
    console.warn('Failed to schedule local notification', e);
  }
}

async function cancelNotification(id: number) {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await LocalNotifications.cancel({ notifications: [{ id }] });
  } catch (e) {
    console.warn('Failed to cancel local notification', e);
  }
}

class LocalPlannerRepository {
  // ── EXAMS ────────────────────────────────────────────────────────────────────
  async getExams(params?: { course?: string; from_date?: string }): Promise<{ exams: PlannerExam[] }> {
    const db = dbService.getDb();
    let q = 'SELECT * FROM planner_exams';
    const clauses: string[] = [];
    const vals: any[] = [];
    if (params?.course) { clauses.push('UPPER(course)=UPPER(?)'); vals.push(params.course); }
    if (params?.from_date) { clauses.push('date >= ?'); vals.push(params.from_date); }
    if (clauses.length > 0) q += ' WHERE ' + clauses.join(' AND ');
    q += ' ORDER BY date, start_time';
    const res = await db.query(q, vals);
    return { exams: (res.values || []) as PlannerExam[] };
  }
  async createExam(body: ExamInput): Promise<PlannerExam> {
    const db = dbService.getDb();
    const now = nowUtc();
    const res = await db.run(
      `INSERT INTO planner_exams (course, title, exam_type, date, start_time, end_time, room, syllabus, notes, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [body.course, body.title, body.exam_type || 'Other', body.date, body.start_time, body.end_time, body.room, body.syllabus, body.notes, now, now]
    );
    const row = await db.query('SELECT * FROM planner_exams WHERE id=?', [res.changes?.lastId]);
    return row.values![0] as PlannerExam;
  }
  async updateExam(id: number, body: ExamInput): Promise<PlannerExam> {
    const db = dbService.getDb();
    const now = nowUtc();
    await db.run(
      `UPDATE planner_exams SET course=?,title=?,exam_type=?,date=?,start_time=?,end_time=?,room=?,syllabus=?,notes=?,updated_at=? WHERE id=?`,
      [body.course, body.title, body.exam_type || 'Other', body.date, body.start_time, body.end_time, body.room, body.syllabus, body.notes, now, id]
    );
    const row = await db.query('SELECT * FROM planner_exams WHERE id=?', [id]);
    return row.values![0] as PlannerExam;
  }
  async deleteExam(id: number): Promise<{ status: string }> {
    await dbService.getDb().run('DELETE FROM planner_exams WHERE id=?', [id]);
    return { status: 'deleted' };
  }

  // ── QUIZZES ──────────────────────────────────────────────────────────────────
  async getQuizzes(params?: { course?: string; from_date?: string }): Promise<{ quizzes: PlannerQuiz[] }> {
    const db = dbService.getDb();
    let q = 'SELECT * FROM planner_quizzes';
    const clauses: string[] = [];
    const vals: any[] = [];
    if (params?.course) { clauses.push('UPPER(course)=UPPER(?)'); vals.push(params.course); }
    if (params?.from_date) { clauses.push('date >= ?'); vals.push(params.from_date); }
    if (clauses.length > 0) q += ' WHERE ' + clauses.join(' AND ');
    q += ' ORDER BY date, start_time';
    const res = await db.query(q, vals);
    return { quizzes: (res.values || []) as PlannerQuiz[] };
  }
  async createQuiz(body: QuizInput): Promise<PlannerQuiz> {
    const db = dbService.getDb();
    const now = nowUtc();
    const res = await db.run(
      `INSERT INTO planner_quizzes (course, title, date, start_time, end_time, topic, syllabus, notes, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [body.course, body.title, body.date, body.start_time, body.end_time, body.topic, body.syllabus, body.notes, now, now]
    );
    const row = await db.query('SELECT * FROM planner_quizzes WHERE id=?', [res.changes?.lastId]);
    return row.values![0] as PlannerQuiz;
  }
  async updateQuiz(id: number, body: QuizInput): Promise<PlannerQuiz> {
    const db = dbService.getDb();
    const now = nowUtc();
    await db.run(
      `UPDATE planner_quizzes SET course=?,title=?,date=?,start_time=?,end_time=?,topic=?,syllabus=?,notes=?,updated_at=? WHERE id=?`,
      [body.course, body.title, body.date, body.start_time, body.end_time, body.topic, body.syllabus, body.notes, now, id]
    );
    const row = await db.query('SELECT * FROM planner_quizzes WHERE id=?', [id]);
    return row.values![0] as PlannerQuiz;
  }
  async deleteQuiz(id: number): Promise<{ status: string }> {
    await dbService.getDb().run('DELETE FROM planner_quizzes WHERE id=?', [id]);
    return { status: 'deleted' };
  }

  // ── ASSIGNMENTS ──────────────────────────────────────────────────────────────
  async getAssignments(params?: { course?: string; status?: string; from_date?: string }): Promise<{ assignments: PlannerAssignment[] }> {
    const db = dbService.getDb();
    let q = 'SELECT * FROM planner_assignments';
    const clauses: string[] = [];
    const vals: any[] = [];
    if (params?.course) { clauses.push('UPPER(course)=UPPER(?)'); vals.push(params.course); }
    if (params?.status) { clauses.push('status=?'); vals.push(params.status); }
    if (params?.from_date) { clauses.push('deadline_date >= ?'); vals.push(params.from_date); }
    if (clauses.length > 0) q += ' WHERE ' + clauses.join(' AND ');
    q += ' ORDER BY deadline_date, deadline_time';
    const res = await db.query(q, vals);
    return { assignments: (res.values || []) as PlannerAssignment[] };
  }
  async createAssignment(body: AssignmentInput): Promise<PlannerAssignment> {
    const db = dbService.getDb();
    const now = nowUtc();
    const res = await db.run(
      `INSERT INTO planner_assignments (course, title, topic, description, deadline_date, deadline_time, status, notes, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [body.course, body.title, body.topic, body.description, body.deadline_date, body.deadline_time, body.status || 'Pending', body.notes, now, now]
    );
    const row = await db.query('SELECT * FROM planner_assignments WHERE id=?', [res.changes?.lastId]);
    return row.values![0] as PlannerAssignment;
  }
  async updateAssignment(id: number, body: AssignmentInput): Promise<PlannerAssignment> {
    const db = dbService.getDb();
    const now = nowUtc();
    await db.run(
      `UPDATE planner_assignments SET course=?,title=?,topic=?,description=?,deadline_date=?,deadline_time=?,status=?,notes=?,updated_at=? WHERE id=?`,
      [body.course, body.title, body.topic, body.description, body.deadline_date, body.deadline_time, body.status || 'Pending', body.notes, now, id]
    );
    const row = await db.query('SELECT * FROM planner_assignments WHERE id=?', [id]);
    return row.values![0] as PlannerAssignment;
  }
  async toggleAssignmentComplete(id: number): Promise<PlannerAssignment> {
    const db = dbService.getDb();
    const current = await db.query('SELECT status FROM planner_assignments WHERE id=?', [id]);
    if (!current.values || current.values.length === 0) throw new Error('Not found');
    const newStatus = current.values[0].status === 'Completed' ? 'Pending' : 'Completed';
    await db.run('UPDATE planner_assignments SET status=?, updated_at=? WHERE id=?', [newStatus, nowUtc(), id]);
    const row = await db.query('SELECT * FROM planner_assignments WHERE id=?', [id]);
    return row.values![0] as PlannerAssignment;
  }
  async deleteAssignment(id: number): Promise<{ status: string }> {
    await dbService.getDb().run('DELETE FROM planner_assignments WHERE id=?', [id]);
    return { status: 'deleted' };
  }

  // ── TASKS ────────────────────────────────────────────────────────────────────
  async getTasks(params?: { course?: string; status?: string; priority?: string }): Promise<{ tasks: PlannerTask[] }> {
    const db = dbService.getDb();
    let q = 'SELECT * FROM planner_tasks';
    const clauses: string[] = [];
    const vals: any[] = [];
    if (params?.course) { clauses.push('UPPER(course)=UPPER(?)'); vals.push(params.course); }
    if (params?.status) { clauses.push('status=?'); vals.push(params.status); }
    if (params?.priority) { clauses.push('priority=?'); vals.push(params.priority); }
    if (clauses.length > 0) q += ' WHERE ' + clauses.join(' AND ');
    q += ' ORDER BY due_date NULLS LAST, due_time';
    const res = await db.query(q, vals);
    return { tasks: (res.values || []) as PlannerTask[] };
  }
  async createTask(body: TaskInput): Promise<PlannerTask> {
    const db = dbService.getDb();
    const now = nowUtc();
    const res = await db.run(
      `INSERT INTO planner_tasks (course, title, description, due_date, due_time, priority, status, notes, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [body.course, body.title, body.description, body.due_date, body.due_time, body.priority || 'Medium', body.status || 'Pending', body.notes, now, now]
    );
    const row = await db.query('SELECT * FROM planner_tasks WHERE id=?', [res.changes?.lastId]);
    return row.values![0] as PlannerTask;
  }
  async updateTask(id: number, body: TaskInput): Promise<PlannerTask> {
    const db = dbService.getDb();
    const now = nowUtc();
    await db.run(
      `UPDATE planner_tasks SET course=?,title=?,description=?,due_date=?,due_time=?,priority=?,status=?,notes=?,updated_at=? WHERE id=?`,
      [body.course, body.title, body.description, body.due_date, body.due_time, body.priority || 'Medium', body.status || 'Pending', body.notes, now, id]
    );
    const row = await db.query('SELECT * FROM planner_tasks WHERE id=?', [id]);
    return row.values![0] as PlannerTask;
  }
  async toggleTaskComplete(id: number): Promise<PlannerTask> {
    const db = dbService.getDb();
    const current = await db.query('SELECT status FROM planner_tasks WHERE id=?', [id]);
    if (!current.values || current.values.length === 0) throw new Error('Not found');
    const newStatus = current.values[0].status === 'Completed' ? 'Pending' : 'Completed';
    await db.run('UPDATE planner_tasks SET status=?, updated_at=? WHERE id=?', [newStatus, nowUtc(), id]);
    const row = await db.query('SELECT * FROM planner_tasks WHERE id=?', [id]);
    return row.values![0] as PlannerTask;
  }
  async deleteTask(id: number): Promise<{ status: string }> {
    await dbService.getDb().run('DELETE FROM planner_tasks WHERE id=?', [id]);
    return { status: 'deleted' };
  }

  // ── REMINDERS ────────────────────────────────────────────────────────────────
  async getReminders(params?: { from_date?: string }): Promise<{ reminders: PlannerReminder[] }> {
    const db = dbService.getDb();
    let q = 'SELECT * FROM planner_reminders';
    const clauses: string[] = [];
    const vals: any[] = [];
    if (params?.from_date) { clauses.push('date >= ?'); vals.push(params.from_date); }
    if (clauses.length > 0) q += ' WHERE ' + clauses.join(' AND ');
    q += ' ORDER BY date, time';
    const res = await db.query(q, vals);
    return { reminders: (res.values || []) as PlannerReminder[] };
  }
  async createReminder(body: ReminderInput): Promise<PlannerReminder> {
    const db = dbService.getDb();
    const now = nowUtc();
    const res = await db.run(
      `INSERT INTO planner_reminders (title, date, time, notes, repeat, created_at, updated_at) VALUES (?,?,?,?,?,?,?)`,
      [body.title, body.date, body.time, body.notes, body.repeat || 'None', now, now]
    );
    const row = await db.query('SELECT * FROM planner_reminders WHERE id=?', [res.changes?.lastId]);
    const reminder = row.values![0] as PlannerReminder;
    await scheduleNotification(reminder.id, reminder.title, reminder.date, reminder.time);
    return reminder;
  }
  async updateReminder(id: number, body: ReminderInput): Promise<PlannerReminder> {
    const db = dbService.getDb();
    const now = nowUtc();
    await db.run(
      `UPDATE planner_reminders SET title=?,date=?,time=?,notes=?,repeat=?,updated_at=? WHERE id=?`,
      [body.title, body.date, body.time, body.notes, body.repeat || 'None', now, id]
    );
    const row = await db.query('SELECT * FROM planner_reminders WHERE id=?', [id]);
    const reminder = row.values![0] as PlannerReminder;
    await cancelNotification(id);
    await scheduleNotification(reminder.id, reminder.title, reminder.date, reminder.time);
    return reminder;
  }
  async deleteReminder(id: number): Promise<{ status: string }> {
    await dbService.getDb().run('DELETE FROM planner_reminders WHERE id=?', [id]);
    await cancelNotification(id);
    return { status: 'deleted' };
  }

  // ── AGGREGATED ───────────────────────────────────────────────────────────────
  async getToday(): Promise<TodayResponse> {
    const db = dbService.getDb();
    const today = todayStr();
    const [exams, quizzes, assignments, tasks, reminders] = await Promise.all([
      db.query('SELECT * FROM planner_exams WHERE date=? ORDER BY start_time', [today]),
      db.query('SELECT * FROM planner_quizzes WHERE date=? ORDER BY start_time', [today]),
      db.query("SELECT * FROM planner_assignments WHERE deadline_date=? AND status != 'Completed' ORDER BY deadline_time", [today]),
      db.query("SELECT * FROM planner_tasks WHERE due_date=? AND status != 'Completed' ORDER BY due_time", [today]),
      db.query('SELECT * FROM planner_reminders WHERE date=? ORDER BY time', [today])
    ]);
    return {
      date: today,
      exams: (exams.values || []).map(r => ({ ...r, item_type: 'exam' })),
      quizzes: (quizzes.values || []).map(r => ({ ...r, item_type: 'quiz' })),
      assignments: (assignments.values || []).map(r => ({ ...r, item_type: 'assignment' })),
      tasks: (tasks.values || []).map(r => ({ ...r, item_type: 'task' })),
      reminders: (reminders.values || []).map(r => ({ ...r, item_type: 'reminder' }))
    };
  }

  async getUpcoming(days = 14): Promise<UpcomingResponse> {
    const db = dbService.getDb();
    const today = todayStr();
    const d = new Date();
    d.setDate(d.getDate() + days);
    const end = d.toISOString().split('T')[0];
    
    const [exams, quizzes, assignments, tasks, reminders] = await Promise.all([
      db.query('SELECT * FROM planner_exams WHERE date > ? AND date <= ? ORDER BY date, start_time', [today, end]),
      db.query('SELECT * FROM planner_quizzes WHERE date > ? AND date <= ? ORDER BY date, start_time', [today, end]),
      db.query("SELECT * FROM planner_assignments WHERE deadline_date > ? AND deadline_date <= ? AND status != 'Completed' ORDER BY deadline_date, deadline_time", [today, end]),
      db.query("SELECT * FROM planner_tasks WHERE due_date > ? AND due_date <= ? AND status != 'Completed' ORDER BY due_date, due_time", [today, end]),
      db.query('SELECT * FROM planner_reminders WHERE date > ? AND date <= ? ORDER BY date, time', [today, end])
    ]);
    return {
      date: today,
      from: today,
      to: end,
      exams: (exams.values || []).map(r => ({ ...r, item_type: 'exam' })),
      quizzes: (quizzes.values || []).map(r => ({ ...r, item_type: 'quiz' })),
      assignments: (assignments.values || []).map(r => ({ ...r, item_type: 'assignment' })),
      tasks: (tasks.values || []).map(r => ({ ...r, item_type: 'task' })),
      reminders: (reminders.values || []).map(r => ({ ...r, item_type: 'reminder' }))
    };
  }

  async getOverdue(): Promise<OverdueResponse> {
    const db = dbService.getDb();
    const today = todayStr();
    
    const [assignments, tasks] = await Promise.all([
      db.query("SELECT * FROM planner_assignments WHERE deadline_date < ? AND status != 'Completed' ORDER BY deadline_date", [today]),
      db.query("SELECT * FROM planner_tasks WHERE due_date IS NOT NULL AND due_date < ? AND status != 'Completed' ORDER BY due_date", [today])
    ]);
    
    const aVals = assignments.values || [];
    const tVals = tasks.values || [];
    
    return {
      as_of: today,
      assignments: aVals.map(r => ({ ...r, item_type: 'assignment' })),
      tasks: tVals.map(r => ({ ...r, item_type: 'task' })),
      total: aVals.length + tVals.length
    };
  }

  async getCalendar(year: number, month: number): Promise<CalendarResponse> {
    const db = dbService.getDb();
    const start = `${year}-${month.toString().padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const end = `${year}-${month.toString().padStart(2, '0')}-${lastDay.toString().padStart(2, '0')}`;
    
    const [exams, quizzes, assignments, tasks, reminders] = await Promise.all([
      db.query('SELECT * FROM planner_exams WHERE date BETWEEN ? AND ?', [start, end]),
      db.query('SELECT * FROM planner_quizzes WHERE date BETWEEN ? AND ?', [start, end]),
      db.query('SELECT * FROM planner_assignments WHERE deadline_date BETWEEN ? AND ?', [start, end]),
      db.query('SELECT * FROM planner_tasks WHERE due_date BETWEEN ? AND ?', [start, end]),
      db.query('SELECT * FROM planner_reminders WHERE date BETWEEN ? AND ?', [start, end])
    ]);
    
    const events: Record<string, any[]> = {};
    
    const add = (rows: any[], type: string, dateField: string) => {
      rows.forEach(r => {
        const key = r[dateField];
        if (key) {
          if (!events[key]) events[key] = [];
          events[key].push({ ...r, item_type: type });
        }
      });
    };
    
    add(exams.values || [], 'exam', 'date');
    add(quizzes.values || [], 'quiz', 'date');
    add(assignments.values || [], 'assignment', 'deadline_date');
    add(tasks.values || [], 'task', 'due_date');
    add(reminders.values || [], 'reminder', 'date');
    
    return { year, month, events };
  }
}

export const localPlannerRepository = new LocalPlannerRepository();
