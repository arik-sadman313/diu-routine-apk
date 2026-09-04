import type {
  PlannerExam, PlannerQuiz, PlannerAssignment, PlannerTask, PlannerReminder,
  ExamInput, QuizInput, AssignmentInput, TaskInput, ReminderInput,
  TodayResponse, UpcomingResponse, OverdueResponse, CalendarResponse,
} from '../types/planner';
import { Capacitor } from '@capacitor/core';
import { localPlannerRepository } from './localPlannerRepository';

const API_BASE = import.meta.env.VITE_API_BASE_URL || `http://${window.location.hostname}:8000/api`;

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
    if (Capacitor.isNativePlatform()) return localPlannerRepository.getExams(params);
    const q = new URLSearchParams();
    if (params?.course) q.append('course', params.course);
    if (params?.from_date) q.append('from_date', params.from_date);
    const qs = q.toString();
    return fetchPlanner<{ exams: PlannerExam[] }>(`/planner/exams${qs ? '?' + qs : ''}`);
  },
  createExam: (body: ExamInput) => {
    if (Capacitor.isNativePlatform()) return localPlannerRepository.createExam(body);
    return fetchPlanner<PlannerExam>('/planner/exams', jsonOpts('POST', body));
  },
  updateExam: (id: number, body: ExamInput) => {
    if (Capacitor.isNativePlatform()) return localPlannerRepository.updateExam(id, body);
    return fetchPlanner<PlannerExam>(`/planner/exams/${id}`, jsonOpts('PUT', body));
  },
  deleteExam: (id: number) => {
    if (Capacitor.isNativePlatform()) return localPlannerRepository.deleteExam(id);
    return fetchPlanner<{ status: string }>(`/planner/exams/${id}`, { method: 'DELETE' });
  },

  // ── QUIZZES ──────────────────────────────────────────────────────────────────
  getQuizzes: (params?: { course?: string; from_date?: string }) => {
    if (Capacitor.isNativePlatform()) return localPlannerRepository.getQuizzes(params);
    const q = new URLSearchParams();
    if (params?.course) q.append('course', params.course);
    if (params?.from_date) q.append('from_date', params.from_date);
    const qs = q.toString();
    return fetchPlanner<{ quizzes: PlannerQuiz[] }>(`/planner/quizzes${qs ? '?' + qs : ''}`);
  },
  createQuiz: (body: QuizInput) => {
    if (Capacitor.isNativePlatform()) return localPlannerRepository.createQuiz(body);
    return fetchPlanner<PlannerQuiz>('/planner/quizzes', jsonOpts('POST', body));
  },
  updateQuiz: (id: number, body: QuizInput) => {
    if (Capacitor.isNativePlatform()) return localPlannerRepository.updateQuiz(id, body);
    return fetchPlanner<PlannerQuiz>(`/planner/quizzes/${id}`, jsonOpts('PUT', body));
  },
  deleteQuiz: (id: number) => {
    if (Capacitor.isNativePlatform()) return localPlannerRepository.deleteQuiz(id);
    return fetchPlanner<{ status: string }>(`/planner/quizzes/${id}`, { method: 'DELETE' });
  },

  // ── ASSIGNMENTS ──────────────────────────────────────────────────────────────
  getAssignments: (params?: { course?: string; status?: string; from_date?: string }) => {
    if (Capacitor.isNativePlatform()) return localPlannerRepository.getAssignments(params);
    const q = new URLSearchParams();
    if (params?.course) q.append('course', params.course);
    if (params?.status) q.append('status', params.status);
    if (params?.from_date) q.append('from_date', params.from_date);
    const qs = q.toString();
    return fetchPlanner<{ assignments: PlannerAssignment[] }>(`/planner/assignments${qs ? '?' + qs : ''}`);
  },
  createAssignment: (body: AssignmentInput) => {
    if (Capacitor.isNativePlatform()) return localPlannerRepository.createAssignment(body);
    return fetchPlanner<PlannerAssignment>('/planner/assignments', jsonOpts('POST', body));
  },
  updateAssignment: (id: number, body: AssignmentInput) => {
    if (Capacitor.isNativePlatform()) return localPlannerRepository.updateAssignment(id, body);
    return fetchPlanner<PlannerAssignment>(`/planner/assignments/${id}`, jsonOpts('PUT', body));
  },
  toggleAssignmentComplete: (id: number) => {
    if (Capacitor.isNativePlatform()) return localPlannerRepository.toggleAssignmentComplete(id);
    return fetchPlanner<PlannerAssignment>(`/planner/assignments/${id}/complete`, { method: 'PATCH' });
  },
  deleteAssignment: (id: number) => {
    if (Capacitor.isNativePlatform()) return localPlannerRepository.deleteAssignment(id);
    return fetchPlanner<{ status: string }>(`/planner/assignments/${id}`, { method: 'DELETE' });
  },

  // ── TASKS ────────────────────────────────────────────────────────────────────
  getTasks: (params?: { course?: string; status?: string; priority?: string }) => {
    if (Capacitor.isNativePlatform()) return localPlannerRepository.getTasks(params);
    const q = new URLSearchParams();
    if (params?.course) q.append('course', params.course);
    if (params?.status) q.append('status', params.status);
    if (params?.priority) q.append('priority', params.priority);
    const qs = q.toString();
    return fetchPlanner<{ tasks: PlannerTask[] }>(`/planner/tasks${qs ? '?' + qs : ''}`);
  },
  createTask: (body: TaskInput) => {
    if (Capacitor.isNativePlatform()) return localPlannerRepository.createTask(body);
    return fetchPlanner<PlannerTask>('/planner/tasks', jsonOpts('POST', body));
  },
  updateTask: (id: number, body: TaskInput) => {
    if (Capacitor.isNativePlatform()) return localPlannerRepository.updateTask(id, body);
    return fetchPlanner<PlannerTask>(`/planner/tasks/${id}`, jsonOpts('PUT', body));
  },
  toggleTaskComplete: (id: number) => {
    if (Capacitor.isNativePlatform()) return localPlannerRepository.toggleTaskComplete(id);
    return fetchPlanner<PlannerTask>(`/planner/tasks/${id}/complete`, { method: 'PATCH' });
  },
  deleteTask: (id: number) => {
    if (Capacitor.isNativePlatform()) return localPlannerRepository.deleteTask(id);
    return fetchPlanner<{ status: string }>(`/planner/tasks/${id}`, { method: 'DELETE' });
  },

  // ── REMINDERS ────────────────────────────────────────────────────────────────
  getReminders: (params?: { from_date?: string }) => {
    if (Capacitor.isNativePlatform()) return localPlannerRepository.getReminders(params);
    const q = new URLSearchParams();
    if (params?.from_date) q.append('from_date', params.from_date);
    const qs = q.toString();
    return fetchPlanner<{ reminders: PlannerReminder[] }>(`/planner/reminders${qs ? '?' + qs : ''}`);
  },
  createReminder: (body: ReminderInput) => {
    if (Capacitor.isNativePlatform()) return localPlannerRepository.createReminder(body);
    return fetchPlanner<PlannerReminder>('/planner/reminders', jsonOpts('POST', body));
  },
  updateReminder: (id: number, body: ReminderInput) => {
    if (Capacitor.isNativePlatform()) return localPlannerRepository.updateReminder(id, body);
    return fetchPlanner<PlannerReminder>(`/planner/reminders/${id}`, jsonOpts('PUT', body));
  },
  deleteReminder: (id: number) => {
    if (Capacitor.isNativePlatform()) return localPlannerRepository.deleteReminder(id);
    return fetchPlanner<{ status: string }>(`/planner/reminders/${id}`, { method: 'DELETE' });
  },

  // ── AGGREGATED ───────────────────────────────────────────────────────────────
  getToday: () => {
    if (Capacitor.isNativePlatform()) return localPlannerRepository.getToday();
    return fetchPlanner<TodayResponse>('/planner/today');
  },
  getUpcoming: (days = 14) => {
    if (Capacitor.isNativePlatform()) return localPlannerRepository.getUpcoming(days);
    return fetchPlanner<UpcomingResponse>(`/planner/upcoming?days=${days}`);
  },
  getOverdue: () => {
    if (Capacitor.isNativePlatform()) return localPlannerRepository.getOverdue();
    return fetchPlanner<OverdueResponse>('/planner/overdue');
  },
  getCalendar: (year: number, month: number) => {
    if (Capacitor.isNativePlatform()) return localPlannerRepository.getCalendar(year, month);
    return fetchPlanner<CalendarResponse>(`/planner/calendar?year=${year}&month=${month}`);
  },
};
