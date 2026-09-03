// Planner-specific TypeScript types
// Completely separate from routine/class types

export type ExamType = 'Midterm' | 'Final' | 'Other';
export type AssignmentStatus = 'Pending' | 'In Progress' | 'Completed';
export type TaskStatus = 'Pending' | 'In Progress' | 'Completed';
export type TaskPriority = 'Low' | 'Medium' | 'High';
export type RepeatType = 'None' | 'Daily' | 'Weekly' | 'Monthly';
export type PlannerItemType = 'exam' | 'quiz' | 'assignment' | 'task' | 'reminder';

export interface PlannerExam {
  id: number;
  course: string | null;
  title: string;
  exam_type: ExamType;
  date: string;           // ISO date YYYY-MM-DD
  start_time: string | null;
  end_time: string | null;
  room: string | null;
  syllabus: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  item_type?: 'exam';
}

export interface PlannerQuiz {
  id: number;
  course: string | null;
  title: string;
  date: string;
  start_time: string | null;
  end_time: string | null;
  topic: string | null;
  syllabus: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  item_type?: 'quiz';
}

export interface PlannerAssignment {
  id: number;
  course: string | null;
  title: string;
  topic: string | null;
  description: string | null;
  deadline_date: string;
  deadline_time: string | null;
  status: AssignmentStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
  item_type?: 'assignment';
}

export interface PlannerTask {
  id: number;
  course: string | null;
  title: string;
  description: string | null;
  due_date: string | null;
  due_time: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
  item_type?: 'task';
}

export interface PlannerReminder {
  id: number;
  title: string;
  date: string;
  time: string;
  notes: string | null;
  repeat: RepeatType;
  created_at: string;
  updated_at: string;
  item_type?: 'reminder';
}

export type PlannerItem =
  | (PlannerExam & { item_type: 'exam' })
  | (PlannerQuiz & { item_type: 'quiz' })
  | (PlannerAssignment & { item_type: 'assignment' })
  | (PlannerTask & { item_type: 'task' })
  | (PlannerReminder & { item_type: 'reminder' });

// API response shapes
export interface TodayResponse {
  date: string;
  exams: (PlannerExam & { item_type: 'exam' })[];
  quizzes: (PlannerQuiz & { item_type: 'quiz' })[];
  assignments: (PlannerAssignment & { item_type: 'assignment' })[];
  tasks: (PlannerTask & { item_type: 'task' })[];
  reminders: (PlannerReminder & { item_type: 'reminder' })[];
}

export interface UpcomingResponse extends TodayResponse {
  from: string;
  to: string;
}

export interface OverdueResponse {
  as_of: string;
  assignments: (PlannerAssignment & { item_type: 'assignment' })[];
  tasks: (PlannerTask & { item_type: 'task' })[];
  total: number;
}

export interface CalendarResponse {
  year: number;
  month: number;
  events: Record<string, PlannerItem[]>;
}

// Form input types (omit auto-fields)
export type ExamInput = Omit<PlannerExam, 'id' | 'created_at' | 'updated_at' | 'item_type'>;
export type QuizInput = Omit<PlannerQuiz, 'id' | 'created_at' | 'updated_at' | 'item_type'>;
export type AssignmentInput = Omit<PlannerAssignment, 'id' | 'created_at' | 'updated_at' | 'item_type'>;
export type TaskInput = Omit<PlannerTask, 'id' | 'created_at' | 'updated_at' | 'item_type'>;
export type ReminderInput = Omit<PlannerReminder, 'id' | 'created_at' | 'updated_at' | 'item_type'>;
