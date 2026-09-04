import React, { useState } from 'react';
import { X, Save, AlertCircle } from 'lucide-react';
import type {
  PlannerItem, PlannerItemType,
  ExamInput, QuizInput, AssignmentInput, TaskInput, ReminderInput,
} from '../../types/planner';
import { plannerApi } from '../../services/plannerApi';

type AnyInput = ExamInput | QuizInput | AssignmentInput | TaskInput | ReminderInput;

interface PlannerItemModalProps {
  mode: 'add' | 'edit';
  itemType: PlannerItemType;
  initialData?: PlannerItem | null;
  onClose: () => void;
  onSaved: () => void;
}


const FIELD_LABELS: Record<string, string> = {
  course: 'Course (optional)',
  title: 'Title *',
  exam_type: 'Exam Type',
  date: 'Date *',
  deadline_date: 'Deadline Date *',
  due_date: 'Due Date',
  start_time: 'Start Time',
  end_time: 'End Time',
  deadline_time: 'Deadline Time',
  due_time: 'Due Time',
  time: 'Time *',
  room: 'Room',
  topic: 'Topic',
  syllabus: 'Syllabus',
  description: 'Description',
  notes: 'Notes',
  status: 'Status',
  priority: 'Priority',
  repeat: 'Repeat',
};

// Fields per item type
const TYPE_FIELDS: Record<PlannerItemType, string[]> = {
  exam: ['course', 'title', 'exam_type', 'date', 'start_time', 'end_time', 'room', 'syllabus', 'notes'],
  quiz: ['course', 'title', 'date', 'start_time', 'end_time', 'topic', 'syllabus', 'notes'],
  assignment: ['course', 'title', 'topic', 'description', 'deadline_date', 'deadline_time', 'status', 'notes'],
  task: ['course', 'title', 'description', 'due_date', 'due_time', 'priority', 'status', 'notes'],
  reminder: ['title', 'date', 'time', 'notes', 'repeat'],
};

const SELECT_OPTIONS: Record<string, string[]> = {
  exam_type: ['Midterm', 'Final', 'Other'],
  status: ['Pending', 'In Progress', 'Completed'],
  priority: ['Low', 'Medium', 'High'],
  repeat: ['None', 'Daily', 'Weekly', 'Monthly'],
};

const TEXTAREA_FIELDS = new Set(['syllabus', 'description', 'notes', 'topic']);
const TIME_FIELDS = new Set(['start_time', 'end_time', 'deadline_time', 'due_time', 'time']);
const DATE_FIELDS = new Set(['date', 'deadline_date', 'due_date']);

function defaultValues(_itemType: PlannerItemType, initialData?: PlannerItem | null): Record<string, string> {
  const base: Record<string, string> = {
    course: '', title: '', exam_type: 'Other', date: '', deadline_date: '',
    due_date: '', start_time: '', end_time: '', deadline_time: '', due_time: '',
    time: '', room: '', topic: '', syllabus: '', description: '', notes: '',
    status: 'Pending', priority: 'Medium', repeat: 'None',
  };
  if (initialData) {
    Object.keys(initialData).forEach(k => {
      if (k in base) base[k] = (initialData as any)[k] ?? '';
    });
  }
  return base;
}

const TYPE_TITLE: Record<PlannerItemType, string> = {
  exam: 'Exam', quiz: 'Quiz', assignment: 'Assignment', task: 'Task', reminder: 'Reminder',
};

export function PlannerItemModal({ mode, itemType, initialData, onClose, onSaved }: PlannerItemModalProps) {
  const [form, setForm] = useState<Record<string, string>>(() => defaultValues(itemType, initialData));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handle = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const validate = (): string | null => {
    const fields = TYPE_FIELDS[itemType];
    if (fields.includes('title') && !form.title.trim()) return 'Title is required.';
    if (fields.includes('date') && !form.date) return 'Date is required.';
    if (fields.includes('deadline_date') && !form.deadline_date) return 'Deadline date is required.';
    if (fields.includes('time') && !form.time) return 'Time is required.';
    if (form.start_time && form.end_time && form.start_time >= form.end_time)
      return 'Start time must be before end time.';
    return null;
  };

  const buildPayload = (): AnyInput => {
    const fields = TYPE_FIELDS[itemType];
    const payload: Record<string, string | null> = {};
    fields.forEach(f => {
      payload[f] = form[f]?.trim() || null;
    });
    // required fields must be non-null
    if ('title' in payload) payload.title = form.title.trim();
    if ('exam_type' in payload) payload.exam_type = form.exam_type || 'Other';
    if ('status' in payload) payload.status = form.status || 'Pending';
    if ('priority' in payload) payload.priority = form.priority || 'Medium';
    if ('repeat' in payload) payload.repeat = form.repeat || 'None';
    return payload as unknown as AnyInput;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const err = validate();
    if (err) { setError(err); return; }
    setLoading(true);
    setError(null);
    try {
      const payload = buildPayload();
      if (mode === 'add') {
        if (itemType === 'exam') await plannerApi.createExam(payload as ExamInput);
        else if (itemType === 'quiz') await plannerApi.createQuiz(payload as QuizInput);
        else if (itemType === 'assignment') await plannerApi.createAssignment(payload as AssignmentInput);
        else if (itemType === 'task') await plannerApi.createTask(payload as TaskInput);
        else await plannerApi.createReminder(payload as ReminderInput);
      } else {
        const id = initialData!.id;
        if (itemType === 'exam') await plannerApi.updateExam(id, payload as ExamInput);
        else if (itemType === 'quiz') await plannerApi.updateQuiz(id, payload as QuizInput);
        else if (itemType === 'assignment') await plannerApi.updateAssignment(id, payload as AssignmentInput);
        else if (itemType === 'task') await plannerApi.updateTask(id, payload as TaskInput);
        else await plannerApi.updateReminder(id, payload as ReminderInput);
      }
      onSaved();
    } catch (err: any) {
      setError(err.message || 'Failed to save');
    } finally {
      setLoading(false);
    }
  };

  const fields = TYPE_FIELDS[itemType];

  const renderField = (name: string) => {
    const label = FIELD_LABELS[name] || name;
    const value = form[name] ?? '';

    if (SELECT_OPTIONS[name]) {
      return (
        <div key={name} className="space-y-1">
          <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">{label}</label>
          <select
            name={name} value={value} onChange={handle}
            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500 outline-none"
          >
            {SELECT_OPTIONS[name].map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
      );
    }
    if (TEXTAREA_FIELDS.has(name)) {
      return (
        <div key={name} className="space-y-1">
          <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">{label}</label>
          <textarea
            name={name} value={value} onChange={handle} rows={3}
            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500 outline-none resize-y"
          />
        </div>
      );
    }
    if (TIME_FIELDS.has(name)) {
      return (
        <div key={name} className="space-y-1">
          <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">{label}</label>
          <input
            type="time" name={name} value={value} onChange={handle}
            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500 outline-none"
          />
        </div>
      );
    }
    if (DATE_FIELDS.has(name)) {
      return (
        <div key={name} className="space-y-1">
          <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">{label}</label>
          <input
            type="date" name={name} value={value} onChange={handle}
            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500 outline-none"
          />
        </div>
      );
    }
    return (
      <div key={name} className="space-y-1">
        <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">{label}</label>
        <input
          type="text" name={name} value={value} onChange={handle}
          required={label.includes('*')}
          className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500 outline-none"
        />
      </div>
    );
  };

  // Group fields into columns
  const PAIR_FIELDS = new Set(['start_time', 'end_time', 'deadline_time', 'due_time']);
  const rendered: React.ReactNode[] = [];
  let i = 0;
  while (i < fields.length) {
    const f = fields[i];
    const next = fields[i + 1];
    if (PAIR_FIELDS.has(f) && next && PAIR_FIELDS.has(next)) {
      rendered.push(
        <div key={f + next} className="grid grid-cols-2 gap-4">
          {renderField(f)}
          {renderField(next)}
        </div>
      );
      i += 2;
    } else {
      rendered.push(renderField(f));
      i++;
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div
        className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-between items-center p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex-shrink-0">
          <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100">
            {mode === 'add' ? `Add ${TYPE_TITLE[itemType]}` : `Edit ${TYPE_TITLE[itemType]}`}
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col overflow-hidden">
          <div className="p-6 overflow-y-auto custom-scrollbar space-y-4">
            {error && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-2 text-red-600 dark:text-red-400 text-sm">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}
            {rendered}
          </div>

          <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex-shrink-0 flex justify-end gap-3">
            <button type="button" onClick={onClose} disabled={loading}
              className="px-4 py-2 font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={loading}
              className="flex items-center gap-2 px-5 py-2 font-semibold text-white bg-purple-600 hover:bg-purple-700 rounded-lg shadow-lg shadow-purple-500/30 transition-all disabled:opacity-50">
              <Save className="w-4 h-4" />
              {loading ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
