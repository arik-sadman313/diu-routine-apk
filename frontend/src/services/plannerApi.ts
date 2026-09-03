import type {
  PlannerExam, PlannerQuiz, PlannerAssignment, PlannerTask, PlannerReminder,
  ExamInput, QuizInput, AssignmentInput, TaskInput, ReminderInput,
  TodayResponse, UpcomingResponse, OverdueResponse, CalendarResponse,
} from '../types/planner';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';

class ApiError extends Error {
  public status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = 'ApiError';
  }
}

async function fetchPlanner<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  const response = await fetch(url, options);
  if (!response.ok) {
    let detail = response.statusText;
    try { const d = await response.json(); detail = d.detail || detail; } catch {}
    throw new ApiError(response.status, typeof detail === 'string' ? detail : JSON.stringify(detail));
  }
  return response.json();
}

function jsonOpts(method: string, body: unknown): RequestInit {
  return {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

export const plannerApi = {
  // ── EXAMS ────────────────────────────────────────────────────────────────────
  getExams: (params?: { course?: string; from_date?: string }) => {
    const q = new URLSearchParams();
    if (params?.course) q.append('course', params.course);
    if (params?.from_date) q.append('from_date', params.from_date);
    const qs = q.toString();
    return fetchPlanner<{ exams: PlannerExam[] }>(`/planner/exams${qs ? '?' + qs : ''}`);
  },
  createExam: (body: ExamInput) =>
    fetchPlanner<PlannerExam>('/planner/exams', jsonOpts('POST', body)),
  updateExam: (id: number, body: ExamInput) =>
    fetchPlanner<PlannerExam>(`/planner/exams/${id}`, jsonOpts('PUT', body)),
  deleteExam: (id: number) =>
    fetchPlanner<{ status: string }>(`/planner/exams/${id}`, { method: 'DELETE' }),

  // ── QUIZZES ──────────────────────────────────────────────────────────────────
  getQuizzes: (params?: { course?: string; from_date?: string }) => {
    const q = new URLSearchParams();
    if (params?.course) q.append('course', params.course);
    if (params?.from_date) q.append('from_date', params.from_date);
    const qs = q.toString();
    return fetchPlanner<{ quizzes: PlannerQuiz[] }>(`/planner/quizzes${qs ? '?' + qs : ''}`);
  },
  createQuiz: (body: QuizInput) =>
    fetchPlanner<PlannerQuiz>('/planner/quizzes', jsonOpts('POST', body)),
  updateQuiz: (id: number, body: QuizInput) =>
    fetchPlanner<PlannerQuiz>(`/planner/quizzes/${id}`, jsonOpts('PUT', body)),
  deleteQuiz: (id: number) =>
    fetchPlanner<{ status: string }>(`/planner/quizzes/${id}`, { method: 'DELETE' }),

  // ── ASSIGNMENTS ──────────────────────────────────────────────────────────────
  getAssignments: (params?: { course?: string; status?: string; from_date?: string }) => {
    const q = new URLSearchParams();
    if (params?.course) q.append('course', params.course);
    if (params?.status) q.append('status', params.status);
    if (params?.from_date) q.append('from_date', params.from_date);
    const qs = q.toString();
    return fetchPlanner<{ assignments: PlannerAssignment[] }>(`/planner/assignments${qs ? '?' + qs : ''}`);
  },
  createAssignment: (body: AssignmentInput) =>
    fetchPlanner<PlannerAssignment>('/planner/assignments', jsonOpts('POST', body)),
  updateAssignment: (id: number, body: AssignmentInput) =>
    fetchPlanner<PlannerAssignment>(`/planner/assignments/${id}`, jsonOpts('PUT', body)),
  toggleAssignmentComplete: (id: number) =>
    fetchPlanner<PlannerAssignment>(`/planner/assignments/${id}/complete`, { method: 'PATCH' }),
  deleteAssignment: (id: number) =>
    fetchPlanner<{ status: string }>(`/planner/assignments/${id}`, { method: 'DELETE' }),

  // ── TASKS ────────────────────────────────────────────────────────────────────
  getTasks: (params?: { course?: string; status?: string; priority?: string }) => {
    const q = new URLSearchParams();
    if (params?.course) q.append('course', params.course);
    if (params?.status) q.append('status', params.status);
    if (params?.priority) q.append('priority', params.priority);
    const qs = q.toString();
    return fetchPlanner<{ tasks: PlannerTask[] }>(`/planner/tasks${qs ? '?' + qs : ''}`);
  },
  createTask: (body: TaskInput) =>
    fetchPlanner<PlannerTask>('/planner/tasks', jsonOpts('POST', body)),
  updateTask: (id: number, body: TaskInput) =>
    fetchPlanner<PlannerTask>(`/planner/tasks/${id}`, jsonOpts('PUT', body)),
  toggleTaskComplete: (id: number) =>
    fetchPlanner<PlannerTask>(`/planner/tasks/${id}/complete`, { method: 'PATCH' }),
  deleteTask: (id: number) =>
    fetchPlanner<{ status: string }>(`/planner/tasks/${id}`, { method: 'DELETE' }),

  // ── REMINDERS ────────────────────────────────────────────────────────────────
  getReminders: (params?: { from_date?: string }) => {
    const q = new URLSearchParams();
    if (params?.from_date) q.append('from_date', params.from_date);
    const qs = q.toString();
    return fetchPlanner<{ reminders: PlannerReminder[] }>(`/planner/reminders${qs ? '?' + qs : ''}`);
  },
  createReminder: (body: ReminderInput) =>
    fetchPlanner<PlannerReminder>('/planner/reminders', jsonOpts('POST', body)),
  updateReminder: (id: number, body: ReminderInput) =>
    fetchPlanner<PlannerReminder>(`/planner/reminders/${id}`, jsonOpts('PUT', body)),
  deleteReminder: (id: number) =>
    fetchPlanner<{ status: string }>(`/planner/reminders/${id}`, { method: 'DELETE' }),

  // ── AGGREGATED ───────────────────────────────────────────────────────────────
  getToday: () => fetchPlanner<TodayResponse>('/planner/today'),
  getUpcoming: (days = 14) => fetchPlanner<UpcomingResponse>(`/planner/upcoming?days=${days}`),
  getOverdue: () => fetchPlanner<OverdueResponse>('/planner/overdue'),
  getCalendar: (year: number, month: number) =>
    fetchPlanner<CalendarResponse>(`/planner/calendar?year=${year}&month=${month}`),
};
