import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { PlannerItem } from '../../types/planner';
import { useLiveTime } from '../../hooks/useLiveTime';

interface CalendarViewProps {
  events: Record<string, PlannerItem[]>;  // key = "YYYY-MM-DD"
  onDayClick?: (date: string, items: PlannerItem[]) => void;
  year: number;
  month: number;                          // 1-12
  selectedDate?: string | null;
  onNavigate: (year: number, month: number) => void;
}

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];
const DAY_NAMES = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

const TYPE_DOT: Record<string, string> = {
  exam: 'bg-red-500', quiz: 'bg-blue-500', assignment: 'bg-amber-500',
  task: 'bg-emerald-500', reminder: 'bg-purple-500',
};

function pad(n: number) { return String(n).padStart(2, '0'); }

export function CalendarView({ events, onDayClick, year, month, selectedDate, onNavigate }: CalendarViewProps) {
  const now = useLiveTime(60000);
  const today = now.toISOString().slice(0, 10);

  // First day of month (0=Sun..6=Sat)
  const firstDay = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();

  const prev = () => month === 1 ? onNavigate(year - 1, 12) : onNavigate(year, month - 1);
  const next = () => month === 12 ? onNavigate(year + 1, 1) : onNavigate(year, month + 1);

  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  // pad to complete grid
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800/50 bg-slate-50/50 dark:bg-slate-900/50">
        <button onClick={prev} className="p-2 rounded-xl hover:bg-white dark:hover:bg-slate-800 hover:shadow-sm border border-transparent hover:border-slate-200 dark:hover:border-slate-700 transition-all">
          <ChevronLeft className="w-5 h-5 text-slate-600 dark:text-slate-400" />
        </button>
        <span className="font-extrabold text-lg text-slate-800 dark:text-slate-100 tracking-tight">
          {MONTH_NAMES[month - 1]} {year}
        </span>
        <button onClick={next} className="p-2 rounded-xl hover:bg-white dark:hover:bg-slate-800 hover:shadow-sm border border-transparent hover:border-slate-200 dark:hover:border-slate-700 transition-all">
          <ChevronRight className="w-5 h-5 text-slate-600 dark:text-slate-400" />
        </button>
      </div>

      {/* Day names */}
      <div className="grid grid-cols-7 border-b border-slate-100 dark:border-slate-800/50 bg-slate-50/30 dark:bg-slate-900/30">
        {DAY_NAMES.map(d => (
          <div key={d} className="py-3 text-center text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
            {d}
          </div>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-7 bg-white dark:bg-slate-900 p-2 gap-1">
        {cells.map((day, idx) => {
          if (!day) return <div key={`empty-${idx}`} className="h-20 sm:h-24 rounded-2xl bg-transparent" />;
          const iso = `${year}-${pad(month)}-${pad(day)}`;
          const dayEvents = events[iso] || [];
          const isToday = iso === today;
          const isSelected = iso === selectedDate;

          return (
            <div
              key={iso}
              onClick={() => onDayClick?.(iso, dayEvents)}
              className={`h-20 sm:h-24 p-2 rounded-2xl cursor-pointer transition-all border-2 relative overflow-hidden group
                ${isSelected 
                  ? 'border-purple-500 bg-purple-50/50 dark:bg-purple-900/10 dark:border-purple-500/50' 
                  : isToday
                  ? 'border-transparent bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/40 dark:hover:bg-slate-800/80'
                  : 'border-transparent hover:bg-slate-50 dark:hover:bg-slate-800/40'}
              `}
            >
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold ml-auto transition-colors
                ${isToday && !isSelected ? 'bg-slate-800 text-white dark:bg-slate-100 dark:text-slate-900' 
                : isSelected ? 'bg-purple-600 text-white shadow-md shadow-purple-500/30'
                : 'text-slate-700 dark:text-slate-300 group-hover:bg-slate-200 dark:group-hover:bg-slate-700'}
              `}>
                {day}
              </div>

              {dayEvents.length > 0 && (
                <div className="absolute bottom-2 left-2 right-2 flex flex-wrap gap-1">
                  {dayEvents.slice(0, 5).map((ev, i) => (
                    <div key={i} className={`w-2 h-2 rounded-full shadow-sm ${TYPE_DOT[ev.item_type] || 'bg-slate-400'}`} />
                  ))}
                  {dayEvents.length > 5 && (
                    <span className="text-[10px] font-bold text-slate-400 leading-none">+{dayEvents.length - 5}</span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
