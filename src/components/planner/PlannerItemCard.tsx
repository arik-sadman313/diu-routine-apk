import type { PlannerItem, PlannerAssignment, PlannerTask, PlannerExam } from '../../types/planner';
import { BookOpen, FileText, CheckSquare, Bell, ClipboardList, MapPin, Trash2, Edit2, MoreHorizontal, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';
import { useState, useRef, useEffect } from 'react';

const TYPE_META = {
  exam:       { label: 'Exam',       icon: BookOpen,      color: 'text-red-600 dark:text-red-400' },
  quiz:       { label: 'Quiz',       icon: FileText,      color: 'text-blue-600 dark:text-blue-400' },
  assignment: { label: 'Assignment', icon: ClipboardList, color: 'text-amber-600 dark:text-amber-500' },
  task:       { label: 'Task',       icon: CheckSquare,   color: 'text-emerald-600 dark:text-emerald-400' },
  reminder:   { label: 'Reminder',   icon: Bell,          color: 'text-purple-600 dark:text-purple-400' },
} as const;

const PRIORITY_COLOR = {
  High:   'text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30',
  Medium: 'text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30',
  Low:    'text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/30',
};

interface PlannerItemCardProps {
  item: PlannerItem;
  onEdit?: (item: PlannerItem) => void;
  onDelete?: (item: PlannerItem) => void;
  onToggleComplete?: (item: PlannerItem) => void;
  isOverdue?: boolean;
}

function getItemDate(item: PlannerItem): string | null {
  if (item.item_type === 'exam' || item.item_type === 'quiz' || item.item_type === 'reminder') return item.date;
  if (item.item_type === 'assignment') return item.deadline_date;
  if (item.item_type === 'task') return item.due_date;
  return null;
}

function getItemTime(item: PlannerItem): string | null {
  if (item.item_type === 'exam' || item.item_type === 'quiz') return item.start_time;
  if (item.item_type === 'reminder') return item.time;
  if (item.item_type === 'assignment') return item.deadline_time;
  if (item.item_type === 'task') return item.due_time;
  return null;
}

function isCompleted(item: PlannerItem): boolean {
  if (item.item_type === 'assignment' || item.item_type === 'task') {
    return (item as PlannerAssignment | PlannerTask).status === 'Completed';
  }
  return false;
}

export function PlannerItemCard({ item, onEdit, onDelete, onToggleComplete, isOverdue }: PlannerItemCardProps) {
  const meta = TYPE_META[item.item_type as keyof typeof TYPE_META];
  
  if (!meta) {
    return (
      <div className="p-4 rounded-2xl border border-red-200 bg-red-50 dark:bg-red-900/10 text-red-600 dark:text-red-400 text-sm flex justify-between items-center shadow-sm">
        <span className="font-bold flex items-center gap-2">
          <Trash2 className="w-4 h-4" /> Malformed Item
        </span>
        {onDelete && (
          <button onClick={(e) => { e.stopPropagation(); onDelete(item); }} className="px-3 py-1 bg-red-100 dark:bg-red-900/30 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors font-semibold">
            Delete
          </button>
        )}
      </div>
    );
  }

  const completed = isCompleted(item);
  const date = getItemDate(item);
  const time = getItemTime(item);
  const canComplete = item.item_type === 'assignment' || item.item_type === 'task';
  const course = 'course' in item ? item.course : null;
  const priority = 'priority' in item ? item.priority : null;
  const location = item.item_type === 'exam' ? (item as PlannerExam).room : null;

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    if (menuOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  // Relative Date Logic
  const today = format(new Date(), 'yyyy-MM-dd');
  let relativeLabel = '';
  if (date) {
    if (isOverdue) relativeLabel = 'Overdue';
    else if (date === today) relativeLabel = 'Due today';
    else {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      if (date === format(tomorrow, 'yyyy-MM-dd')) relativeLabel = 'Due tomorrow';
      else {
        const d = new Date(date);
        const diff = Math.ceil((d.getTime() - new Date().getTime()) / (1000 * 3600 * 24));
        if (diff > 1 && diff <= 7) relativeLabel = `Due in ${diff} days`;
      }
    }
  }

  let formattedDate = '';
  if (date) {
    try {
      formattedDate = format(new Date(date), 'MMM d');
    } catch {
      formattedDate = date;
    }
  }

  return (
    <div className={`group flex flex-col p-4 rounded-2xl border transition-all relative ${
      completed
        ? 'bg-slate-50 dark:bg-slate-900/30 border-slate-200 dark:border-slate-800/50 opacity-60'
        : isOverdue
        ? 'bg-white dark:bg-slate-900 border-red-300 dark:border-red-800 shadow-sm shadow-red-500/10'
        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 shadow-sm'
    }`}>
      
      {/* Type Badge */}
      <div className="flex items-center justify-between mb-2">
        <span className={`text-[10px] font-black uppercase tracking-widest ${
          completed ? 'text-slate-400' : isOverdue ? 'text-red-500' : meta.color.split(' ')[0]
        }`}>
          {meta.label}
        </span>
        
        {/* Actions Menu */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen); }}
            className={`p-1 rounded-lg transition-colors ${
              menuOpen 
                ? 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200' 
                : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 opacity-0 group-hover:opacity-100'
            }`}
            title="Options"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>
          
          {menuOpen && (
            <div className="absolute right-0 top-full mt-1 w-40 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-100 dark:border-slate-700 z-50 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
              <div className="p-1 flex flex-col gap-0.5">
                {onEdit && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onEdit(item); }}
                    className="flex items-center gap-2.5 px-3 py-2 w-full text-left rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors text-slate-700 dark:text-slate-300 text-xs font-semibold"
                  >
                    <Edit2 className="w-3.5 h-3.5" /> Edit
                  </button>
                )}
                {canComplete && onToggleComplete && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onToggleComplete(item); }}
                    className="flex items-center gap-2.5 px-3 py-2 w-full text-left rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors text-slate-700 dark:text-slate-300 text-xs font-semibold"
                  >
                    <CheckCircle2 className={`w-3.5 h-3.5 ${completed ? 'text-emerald-500' : ''}`} /> 
                    {completed ? 'Mark Incomplete' : 'Mark Complete'}
                  </button>
                )}
                {onDelete && (
                  <button
                    onClick={(e) => { 
                      e.stopPropagation(); 
                      setMenuOpen(false);
                      onDelete(item);
                    }}
                    className="flex items-center gap-2.5 px-3 py-2 w-full text-left rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-red-600 dark:text-red-400 text-xs font-semibold"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Delete
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Title */}
      <div className={`text-base font-bold mb-1 leading-snug ${completed ? 'text-slate-500 line-through decoration-slate-300 dark:decoration-slate-600' : 'text-slate-800 dark:text-slate-100'}`}>
        {item.title}
      </div>

      {/* Course & Location */}
      {(course || location) && (
        <div className="flex items-center gap-3 mb-2 flex-wrap">
          {course && (
            <div className={`text-xs font-semibold ${completed ? 'text-slate-400' : 'text-purple-600 dark:text-purple-400'}`}>
              {course}
            </div>
          )}
          {location && (
            <div className="flex items-center gap-1 text-xs font-medium text-slate-500">
              <MapPin className="w-3 h-3" /> {location}
            </div>
          )}
        </div>
      )}

      {/* Footer: Date & Priority */}
      <div className="mt-auto pt-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {(formattedDate || time) && (
            <span className={`text-[11px] font-bold flex items-center gap-1.5 ${
              isOverdue && !completed ? 'text-red-600 dark:text-red-400' : 'text-slate-500 dark:text-slate-400'
            }`}>
              {relativeLabel ? <span className="mr-1">{relativeLabel} ·</span> : null}
              {formattedDate} {time && time !== '23:59' && `· ${time}`}
            </span>
          )}
        </div>

        {priority && (
          <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded ${PRIORITY_COLOR[priority as 'High'|'Medium'|'Low']}`}>
            {priority}
          </span>
        )}
      </div>

    </div>
  );
}
