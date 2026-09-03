import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, isAfter, isBefore, differenceInMinutes } from 'date-fns';
import { usePreferences } from '../hooks/usePreferences';
import { useLiveTime } from '../hooks/useLiveTime';
import { useWeather } from '../hooks/useWeather';
import { useAppContext } from '../context/AppContext';
import { api } from '../services/api';
import { plannerApi } from '../services/plannerApi';
import type { ClassRecord } from '../types/api';
import type { PlannerTask, TodayResponse, UpcomingResponse, OverdueResponse } from '../types/planner';
import { ClassDetailModal } from '../components/ClassDetailModal';
import { ClassEditorModal } from '../components/ClassEditorModal';
import { PlannerItemModal } from '../components/planner/PlannerItemModal';
import { parseRoutineTime } from '../utils/time';
import {
  Clock, ArrowRight, Loader2, Calendar, Plus, BookOpen,
  FileText, ClipboardList, CheckSquare, Bell,
  AlertTriangle, ChevronRight, Zap, Cloud, CloudRain, CloudLightning, Sun, CloudFog, MapPin,
  Search, X
} from 'lucide-react';

// ── helpers ─────────────────────────────────────────────────────────────────

function greeting(now: Date): string {
  const h = now.getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

const PRIORITY_DOT: Record<string, string> = {
  High: 'bg-red-500', Medium: 'bg-amber-400', Low: 'bg-emerald-400',
};

// ── sub-components ────────────────────────────────────────────────────────────

function SectionCard({ title, icon: Icon, children, action, onAction }: {
  title: string; icon: any; children: React.ReactNode;
  action?: string; onAction?: () => void;
}) {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800/80 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-slate-100 dark:border-slate-800/60">
        <h3 className="font-bold text-[13px] text-slate-800 dark:text-slate-200 flex items-center gap-2 tracking-wide">
          <Icon className="w-4 h-4 text-slate-400 dark:text-slate-500" />{title}
        </h3>
        {action && onAction && (
          <button onClick={onAction} className="text-[11px] font-bold text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 transition-colors flex items-center gap-0.5">
            {action}<ChevronRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function EmptyState({ emoji, text }: { emoji: string; text: string }) {
  return (
    <div className="flex items-center gap-3 py-1.5 px-1">
      <span className="text-lg opacity-80">{emoji}</span>
      <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">
        {text}
      </p>
    </div>
  );
}

// ── smart widgets ────────────────────────────────────────────────────────────

function WeatherWidget() {
  const { weatherLocation, setWeatherLocation } = usePreferences();
  const { data, loading, error } = useWeather(weatherLocation);
  
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState(false);
  const [recentLocations, setRecentLocations] = useState<any[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('diu_recent_weather_locations') || '[]');
    } catch {
      return [];
    }
  });

  // Debounced Search
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setSearchError(false);
      return;
    }
    const timer = setTimeout(async () => {
      setSearching(true);
      setSearchError(false);
      try {
        const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=5&language=en&format=json`);
        const json = await res.json();
        setResults(json.results || []);
      } catch (err) {
        setSearchError(true);
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [query]);

  // Handle Escape Key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const handleSelect = (loc: any) => {
    const val = `${loc.latitude},${loc.longitude},${loc.name}`;
    setWeatherLocation(val);
    
    // Save to recents
    const newRecents = [loc, ...recentLocations.filter(r => r.id !== loc.id)].slice(0, 3);
    setRecentLocations(newRecents);
    localStorage.setItem('diu_recent_weather_locations', JSON.stringify(newRecents));
    
    setIsOpen(false);
    setQuery('');
  };

  const renderContent = () => {
    if (loading) return <div className="h-full flex items-center justify-center p-4"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>;
    if (error || !data) {
      return (
        <div className="h-full flex flex-col items-center justify-center p-4 text-center">
          <CloudFog className="w-6 h-6 text-slate-400 mb-2 opacity-50" />
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Weather unavailable</p>
          <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">Check connection</p>
          <button 
            onClick={() => setIsOpen(true)}
            className="mt-3 text-[10px] px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded-md font-semibold text-slate-500 dark:text-slate-400"
          >
            Change Location
          </button>
        </div>
      );
    }

    let Icon = Cloud;
    if (data.condition.includes('Clear')) Icon = Sun;
    if (data.condition.includes('Rain') || data.condition.includes('Drizzle') || data.condition.includes('Showers')) Icon = CloudRain;
    if (data.condition.includes('Thunderstorm')) Icon = CloudLightning;

    return (
      <>
        <div className="absolute right-0 top-0 w-32 h-32 bg-gradient-to-br from-purple-500/10 to-transparent rounded-bl-full pointer-events-none" />
        <div className="flex justify-between items-start mb-2 relative z-10">
          <button 
            onClick={() => setIsOpen(true)}
            className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-slate-500 hover:text-purple-500 dark:text-slate-400 dark:hover:text-purple-400 transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500/50 rounded p-0.5 -ml-0.5"
          >
            <MapPin className="w-3 h-3" /> {data.locationName}
          </button>
          <Icon className="w-6 h-6 text-purple-500 dark:text-purple-400 drop-shadow-sm" />
        </div>
        <div className="relative z-10">
          <div className="text-3xl font-black text-slate-800 dark:text-slate-100 tracking-tighter mb-1">
            {data.temp}°
          </div>
          <div className="text-sm font-semibold text-slate-600 dark:text-slate-300">
            {data.condition}
          </div>
          <div className="flex items-center gap-3 mt-3 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
            <span>H:{data.high}° L:{data.low}°</span>
            {data.precipProb > 0 && <span>💧 {data.precipProb}%</span>}
          </div>
        </div>
      </>
    );
  };

  return (
    <div className="h-full relative flex flex-col justify-between p-5 overflow-visible">
      {renderContent()}

      {/* Popover */}
      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute top-10 left-4 w-64 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-2 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
              <Search className="w-4 h-4 text-slate-400 ml-1" />
              <input
                autoFocus
                type="text"
                placeholder="Search city or location..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full bg-transparent text-sm text-slate-800 dark:text-slate-200 focus:outline-none placeholder-slate-400"
              />
              {query && (
                <button onClick={() => setQuery('')} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md">
                  <X className="w-3.5 h-3.5 text-slate-400" />
                </button>
              )}
            </div>
            <div className="max-h-48 overflow-y-auto p-1.5">
              {searching ? (
                <div className="p-4 flex justify-center"><Loader2 className="w-4 h-4 animate-spin text-purple-500" /></div>
              ) : searchError ? (
                <div className="p-3 text-center text-xs text-red-500">Unable to find locations</div>
              ) : results.length > 0 ? (
                <div className="space-y-0.5">
                  {results.map(r => (
                    <button
                      key={r.id}
                      onClick={() => handleSelect(r)}
                      className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors focus:outline-none focus:bg-purple-50 dark:focus:bg-purple-900/20"
                    >
                      <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">{r.name}</div>
                      {(r.admin1 || r.country) && (
                        <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                          {[r.admin1, r.country].filter(Boolean).join(', ')}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              ) : query ? (
                <div className="p-3 text-center text-xs text-slate-500 dark:text-slate-400">No results found</div>
              ) : recentLocations.length > 0 ? (
                <div>
                  <div className="px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Recent Locations</div>
                  <div className="space-y-0.5">
                    {recentLocations.map(r => (
                      <button
                        key={r.id}
                        onClick={() => handleSelect(r)}
                        className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors focus:outline-none"
                      >
                        <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">{r.name}</div>
                        {(r.admin1 || r.country) && (
                          <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                            {[r.admin1, r.country].filter(Boolean).join(', ')}
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="p-3 text-center text-xs text-slate-400">Search for a city...</div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function DateTimeWidget({ now }: { now: Date }) {
  return (
    <div className="h-full flex flex-col justify-center p-5 md:p-6">
      <div className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1">
        {format(now, 'EEEE')}
      </div>
      <div className="text-xl font-black text-slate-800 dark:text-slate-100 tracking-tight mb-2">
        {format(now, 'MMMM d, yyyy')}
      </div>
      <div className="text-3xl font-black text-purple-600 dark:text-purple-400 tracking-tighter">
        {format(now, 'h:mm a')}
      </div>
    </div>
  );
}

function DayProgressWidget({ now }: { now: Date }) {
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const endOfDay = startOfDay + 24 * 60 * 60 * 1000;
  const progress = Math.min(100, Math.max(0, ((now.getTime() - startOfDay) / (endOfDay - startOfDay)) * 100));
  
  return (
    <div className="h-full flex flex-col justify-center p-5 md:p-6">
      <div className="flex justify-between items-end mb-3">
        <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
          Day Progress
        </div>
        <div className="text-lg font-black text-slate-800 dark:text-slate-100">
          {Math.round(progress)}%
        </div>
      </div>
      <div className="h-2.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden shadow-inner">
        <div 
          className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full transition-all duration-1000 ease-linear"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

function TodaySummaryWidget({ classes, now }: { classes: any[], now: Date }) {
  const total = classes.length;
  let completed = 0;
  let ongoing = 0;
  let remaining = 0;

  classes.forEach(c => {
    const s = parseRoutineTime(c.start_time, now);
    const e = parseRoutineTime(c.end_time, now);
    if (isBefore(e, now)) completed++;
    else if (isBefore(s, now) && isAfter(e, now)) ongoing++;
    else remaining++;
  });

  return (
    <div className="h-full flex flex-col justify-center p-5 md:p-6">
      <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-3">
        Today Summary
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className="text-2xl font-black text-slate-800 dark:text-slate-100">{total}</div>
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total</div>
        </div>
        <div>
          <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{completed}</div>
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Completed</div>
        </div>
        <div>
          <div className="text-2xl font-black text-purple-600 dark:text-purple-400">{ongoing}</div>
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Ongoing</div>
        </div>
        <div>
          <div className="text-2xl font-black text-blue-600 dark:text-blue-400">{remaining}</div>
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Remaining</div>
        </div>
      </div>
    </div>
  );
}

// ── main ─────────────────────────────────────────────────────────────────────

export function Dashboard() {
  const navigate = useNavigate();
  const { batch, section } = usePreferences();
  const { selectedVersion, loading: appLoading } = useAppContext();
  const versionId = selectedVersion?.id;

  // routine
  const [classes, setClasses] = useState<ClassRecord[]>([]);
  const [routineLoading, setRoutineLoading] = useState(false);
  const [selectedClass, setSelectedClass] = useState<ClassRecord | null>(null);

  // planner
  const [todayPlanner, setTodayPlanner] = useState<TodayResponse | null>(null);
  const [upcoming, setUpcoming] = useState<UpcomingResponse | null>(null);
  const [overdue, setOverdue] = useState<OverdueResponse | null>(null);
  const [allTasks, setAllTasks] = useState<PlannerTask[]>([]);

  // quick-add modals
  const [addingClass, setAddingClass] = useState(false);
  const [addingType, setAddingType] = useState<'exam'|'quiz'|'assignment'|'task'|'reminder'|null>(null);

  // live clock
  const now = useLiveTime(1000);

  const loadRoutine = useCallback(async () => {
    if (!batch || !section || !versionId) return;
    setRoutineLoading(true);
    try {
      const d = await api.getRoutine(batch, section, versionId);
      setClasses(d.classes);
    } finally { setRoutineLoading(false); }
  }, [batch, section, versionId]);

  const loadPlanner = useCallback(async () => {
    const [t, u, o, ts] = await Promise.all([
      plannerApi.getToday(),
      plannerApi.getUpcoming(14),
      plannerApi.getOverdue(),
      plannerApi.getTasks({ status: 'Pending' }),
    ]);
    setTodayPlanner(t);
    setUpcoming(u);
    setOverdue(o);
    setAllTasks(ts.tasks);
  }, []);

  const refresh = useCallback(() => {
    loadRoutine();
    loadPlanner();
  }, [loadRoutine, loadPlanner]);

  useEffect(() => { loadRoutine(); }, [loadRoutine]);
  useEffect(() => { loadPlanner(); }, [loadPlanner]);


  if (appLoading) return null;

  if (!batch || !section) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4 animate-in fade-in zoom-in duration-300">
        <div className="w-20 h-20 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-full flex items-center justify-center mb-6">
          <Calendar className="w-10 h-10" />
        </div>
        <h2 className="text-2xl font-bold mb-3 text-slate-800 dark:text-slate-100">Welcome to DIU Routine</h2>
        <p className="text-slate-500 dark:text-slate-400 mb-8 max-w-md text-lg leading-relaxed">
          Set your batch and section to see your personalised dashboard.
        </p>
        <button onClick={() => navigate('/settings')}
          className="bg-purple-600 hover:bg-purple-700 text-white px-8 py-3.5 rounded-xl font-bold shadow-lg shadow-purple-500/30 transition-all flex items-center gap-2 hover:-translate-y-0.5">
          Setup My Routine <ArrowRight className="w-5 h-5" />
        </button>
      </div>
    );
  }

  // ── next-class logic ────────────────────────────────────────────────────────
  const visible = classes.filter(c => c.record_type !== 'hidden');
  const todayName = format(now, 'EEEE');
  const DAYS = ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

  const todayClasses = visible
    .filter(c => c.day.toLowerCase() === todayName.toLowerCase())
    .sort((a, b) => parseRoutineTime(a.start_time).getTime() - parseRoutineTime(b.start_time).getTime());

  let currentClass: ClassRecord | null = null;
  let nextClass: ClassRecord | null = null;
  let nextClassDay = 'Today';

  for (const c of todayClasses) {
    const s = parseRoutineTime(c.start_time, now);
    const e = parseRoutineTime(c.end_time, now);
    if (isBefore(s, now) && isAfter(e, now)) { currentClass = c; }
    else if (isAfter(s, now) && !nextClass) { nextClass = c; }
  }

  if (!nextClass && visible.length > 0) {
    // Search forward up to 7 days
    const todayIdx = DAYS.indexOf(todayName);
    for (let offset = 1; offset <= 7; offset++) {
      const searchDayIdx = (todayIdx + offset) % 7;
      if (searchDayIdx === -1) continue;
      const searchDayName = DAYS[searchDayIdx];
      const dayClasses = visible
        .filter(c => c.day === searchDayName)
        .sort((a, b) => parseRoutineTime(a.start_time).getTime() - parseRoutineTime(b.start_time).getTime());
        
      if (dayClasses.length > 0) {
        nextClass = dayClasses[0];
        nextClassDay = offset === 1 ? 'Tomorrow' : searchDayName;
        break;
      }
    }
  }

  const focusClass = currentClass || nextClass;
  
  let progressPercent = 0;
  let countdownStr = '';

  if (currentClass) {
    const s = parseRoutineTime(currentClass.start_time, now).getTime();
    const e = parseRoutineTime(currentClass.end_time, now).getTime();
    const curr = now.getTime();
    progressPercent = Math.max(0, Math.min(100, ((curr - s) / (e - s)) * 100));
    
    const remMins = Math.floor((e - curr) / 60000);
    const h = Math.floor(remMins / 60);
    const m = remMins % 60;
    countdownStr = h > 0 ? `${h}h ${m}m remaining` : `${m}m remaining`;
  } else if (nextClass) {
    if (nextClassDay === 'Today') {
      const s = parseRoutineTime(nextClass.start_time, now);
      const remMins = differenceInMinutes(s, now);
      if (remMins < 60) {
        countdownStr = `Starts in ${remMins} min`;
      } else {
        const h = Math.floor(remMins / 60);
        const m = remMins % 60;
        countdownStr = `Starts in ${h}h ${m}m`;
      }
    } else {
      countdownStr = `Starts ${nextClassDay}`;
    }
  }

  // ── planner aggregates ──────────────────────────────────────────────────────
  const today = now.toISOString().slice(0, 10);
  const tomorrow = new Date(now.getTime() + 86400000).toISOString().slice(0, 10);

  const todayPlannerItems = todayPlanner
    ? [...todayPlanner.exams, ...todayPlanner.quizzes, ...todayPlanner.assignments, ...todayPlanner.tasks, ...todayPlanner.reminders]
    : [];

  const upcomingItems = upcoming
    ? [...upcoming.exams, ...upcoming.quizzes, ...upcoming.assignments, ...upcoming.tasks, ...upcoming.reminders]
        .sort((a, b) => {
          const da = 'date' in a ? a.date : 'deadline_date' in a ? a.deadline_date : (a as any).due_date || '';
          const db = 'date' in b ? b.date : 'deadline_date' in b ? b.deadline_date : (b as any).due_date || '';
          return (da || '').localeCompare(db || '');
        })
        .slice(0, 6)
    : [];

  const overdueAssignments = overdue?.assignments || [];
  const overdueTotal = overdue?.total || 0;

  const allDeadlines = [
    ...overdueAssignments.map(a => ({ ...a, _urgency: 0 })),
    ...(upcoming?.assignments || [])
      .filter(a => a.deadline_date === today || a.deadline_date === tomorrow)
      .map(a => ({ ...a, _urgency: a.deadline_date === today ? 1 : 2 })),
  ].slice(0, 5);

  const URGENCY_LABEL: Record<number, { label: string; color: string }> = {
    0: { label: 'Overdue', color: 'text-red-600 dark:text-red-400' },
    1: { label: 'Today', color: 'text-amber-600 dark:text-amber-500' },
    2: { label: 'Tomorrow', color: 'text-blue-600 dark:text-blue-400' },
  };

  const ITEM_TYPE_META: Record<string, { label: string; icon: any; color: string }> = {
    exam:       { label: 'Exam',       icon: BookOpen,     color: 'text-red-600 dark:text-red-400' },
    quiz:       { label: 'Quiz',       icon: FileText,     color: 'text-blue-600 dark:text-blue-400' },
    assignment: { label: 'Assignment', icon: ClipboardList, color: 'text-amber-600 dark:text-amber-500' },
    task:       { label: 'Task',       icon: CheckSquare,  color: 'text-emerald-600 dark:text-emerald-400' },
    reminder:   { label: 'Reminder',   icon: Bell,         color: 'text-purple-600 dark:text-purple-400' },
  };

  const handleTaskToggle = async (id: number) => {
    await plannerApi.toggleTaskComplete(id);
    loadPlanner();
  };

  const QUICK_ACTIONS: { label: string; icon: any; onClick: () => void }[] = [
    { label: 'Add Class',      icon: Calendar,     onClick: () => setAddingClass(true) },
    { label: 'Assignment', icon: ClipboardList, onClick: () => setAddingType('assignment') },
    { label: 'Quiz',       icon: FileText,     onClick: () => setAddingType('quiz') },
    { label: 'Task',       icon: CheckSquare,  onClick: () => setAddingType('task') },
    { label: 'Exam',       icon: BookOpen,     onClick: () => setAddingType('exam') },
    { label: 'Reminder',   icon: Bell,         onClick: () => setAddingType('reminder') },
  ];

  // ── render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-10 animate-in fade-in duration-300">

      {/* ── Header ── */}
      <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight mb-1.5 flex items-center gap-2">
            Batch {batch} <span className="text-slate-300 dark:text-slate-600 font-normal mx-1">•</span> Section {section}
          </h1>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
            <span>{greeting(now)} 👋</span>
            <span className="hidden sm:inline text-slate-300 dark:text-slate-700">•</span>
            <span>{format(now, 'EEEE, MMM d, yyyy')}</span>
            <span className="hidden sm:inline text-slate-300 dark:text-slate-700">•</span>
            <span className="w-16">{format(now, 'h:mm a')}</span>
            <span className="hidden sm:inline text-slate-300 dark:text-slate-700">•</span>
            <span className="text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20 px-1.5 py-0.5 rounded-md">
              {selectedVersion?.name || `Version ${selectedVersion?.id}`}
              {routineLoading && <span className="ml-1 inline-flex items-center"><Loader2 className="w-3 h-3 animate-spin ml-1" /></span>}
            </span>
          </div>
        </div>

        {/* Quick actions bar */}
        <div className="flex flex-wrap gap-1.5">
          {QUICK_ACTIONS.map(qa => (
            <button key={qa.label} onClick={qa.onClick}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-purple-300 hover:bg-purple-50 hover:text-purple-700 dark:hover:border-purple-500/50 dark:hover:bg-purple-900/20 dark:hover:text-purple-300 text-slate-600 dark:text-slate-300 rounded-lg transition-all shadow-sm focus:ring-2 focus:ring-purple-500/50 outline-none">
              <Plus className="w-3 h-3" />{qa.label.replace('Add ', '')}
            </button>
          ))}
        </div>
      </header>

      {/* ── Main Grid ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 xl:gap-6 items-start">

        {/* ── Column 1: Hero & Today ── */}
        <div className="space-y-5">
          {/* NEXT / CURRENT CLASS */}
          <div
            className={`p-6 rounded-3xl shadow-lg relative overflow-hidden group text-white cursor-pointer ${
              currentClass
                ? 'bg-gradient-to-br from-emerald-500 to-teal-600 shadow-emerald-500/30'
                : 'bg-gradient-to-br from-purple-600 to-violet-700 shadow-purple-500/30'
            } ring-1 ring-white/10`}
            onClick={() => focusClass && setSelectedClass(focusClass)}
          >
            <div className="absolute -right-12 -top-12 w-48 h-48 bg-white/10 rounded-full blur-3xl group-hover:scale-110 group-hover:bg-white/20 transition-all duration-500" />
            
            {/* Progress Bar (if ongoing) */}
            {currentClass && (
              <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-black/20">
                <div 
                  className="h-full bg-white/90 transition-all duration-1000 ease-linear"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            )}
            
            <div className="flex flex-wrap items-center justify-between gap-3 mb-5 relative z-10">
              <div className="flex items-center gap-2 text-white/90 font-bold text-[10px] uppercase tracking-widest">
                <Clock className="w-4 h-4" />
                {currentClass ? 'Ongoing Now' : (nextClass && nextClassDay === 'Today') ? `Next Class` : 'No More Classes Today'}
              </div>
              
              {countdownStr && (
                <div className={`text-[10px] font-bold px-2.5 py-1 rounded-md backdrop-blur-md ${currentClass ? 'bg-black/20 text-white' : 'bg-white/20 text-white'} ring-1 ring-white/20 shadow-sm`}>
                  {countdownStr}
                </div>
              )}
            </div>
            
            {focusClass ? (
              <div className="relative z-10 pb-2">
                {(!currentClass && nextClassDay !== 'Today') && (
                  <div className="mb-4">
                    <div className="text-lg font-black opacity-90 tracking-wide border-b border-white/20 pb-1 inline-block uppercase">No More Classes Today</div>
                  </div>
                )}
                {(!currentClass && nextClassDay !== 'Today') && (
                  <div className="text-[10px] font-bold text-white/70 uppercase tracking-widest mb-1.5">Next Class</div>
                )}
                <div className="text-5xl font-black tracking-tight mb-2 drop-shadow-sm">{focusClass.course_code}</div>
                <div className="flex flex-col gap-1.5">
                  <div className="text-white/90 text-sm font-medium flex items-center gap-2">
                    <span className="opacity-90">{focusClass.teacher || 'TBA'}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-sm font-bold mt-2">
                    <div className="bg-black/20 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/10 flex items-center gap-1.5">
                      <Calendar className="w-4 h-4 opacity-75" />
                      {nextClassDay !== 'Today' ? `${nextClassDay} · ` : ''}{focusClass.start_time} – {focusClass.end_time}
                    </div>
                    <div className="bg-white/20 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/20 flex items-center gap-1.5 drop-shadow-sm">
                      {focusClass.room}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="relative z-10 py-4">
                <div className="text-3xl font-black mb-2 drop-shadow-sm">No classes today 🎉</div>
                <p className="text-white/80 font-medium">Enjoy your free time!</p>
              </div>
            )}
          </div>

          {/* TODAY'S SCHEDULE */}
          <SectionCard title="Today's Classes" icon={Calendar} action="Explore" onAction={() => navigate('/explore')}>
            {todayClasses.length === 0 ? (
              <EmptyState emoji="🎉" text="No classes today" />
            ) : (
              <div className="relative pl-4 space-y-4 py-2 border-l-2 border-slate-200 dark:border-slate-800 ml-3">
                {todayClasses.map((c, i) => {
                  const s = parseRoutineTime(c.start_time, now);
                  const e = parseRoutineTime(c.end_time, now);
                  const isPast = isBefore(e, now);
                  const isCur = isBefore(s, now) && isAfter(e, now);
                  const isNext = c === nextClass;
                  return (
                    <div key={i} onClick={() => setSelectedClass(c)} className="relative group cursor-pointer">
                      {/* Timeline dot & line connector */}
                      <div className="absolute -left-[23px] top-3.5 w-4 border-t-2 border-slate-200 dark:border-slate-800 transition-colors group-hover:border-purple-400" />
                      <div className={`absolute -left-[29px] top-2 w-3 h-3 rounded-full border-2 bg-white dark:bg-slate-900 transition-colors ${
                        isCur ? 'border-purple-500 scale-125 shadow-[0_0_8px_rgba(168,85,247,0.5)]' 
                        : isPast ? 'border-slate-300 dark:border-slate-600'
                        : isNext ? 'border-purple-400 dark:border-purple-500 scale-110'
                        : 'border-slate-400 dark:border-slate-500'
                      }`} />
                      
                      <div className={`pl-3 pr-3 py-2.5 rounded-xl transition-all ${
                        isPast ? 'opacity-[0.65] hover:opacity-100 hover:bg-slate-50 dark:hover:bg-slate-800/50' 
                        : isCur ? 'bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-700/50 -mt-1 -mb-1 shadow-sm' 
                        : isNext ? 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                      }`}>
                        <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-0.5">{c.start_time} – {c.end_time}</div>
                        <div className={`font-black text-base tracking-tight flex items-center gap-2 ${isCur ? 'text-purple-700 dark:text-purple-300' : isPast ? 'text-slate-600 dark:text-slate-400' : 'text-slate-800 dark:text-slate-100'}`}>
                          {c.course_code}
                          {isCur && <span className="text-[9px] px-1.5 py-0.5 bg-purple-600 text-white rounded uppercase tracking-wider leading-none shadow-sm">Ongoing</span>}
                        </div>
                        <div className="text-xs text-slate-600 dark:text-slate-400 mt-1 flex items-center gap-2">
                          <span className="font-bold">{c.room}</span>
                          <span className="opacity-50">•</span>
                          <span className="font-medium">{c.teacher || 'TBA'}</span>
                          {c.group_code && (
                            <>
                              <span className="opacity-50">•</span>
                              <span className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-[10px] font-bold text-slate-500">{c.group_code}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </SectionCard>
        </div>

        {/* ── Column 2: Widgets & Events ── */}
        <div className="space-y-5">
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden min-h-[160px] aspect-square flex flex-col">
              <WeatherWidget />
            </div>
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden min-h-[160px] aspect-square flex flex-col">
              <TodaySummaryWidget classes={todayClasses} now={now} />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden min-h-[160px] aspect-square flex flex-col">
              <DateTimeWidget now={now} />
            </div>
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden min-h-[160px] aspect-square flex flex-col">
              <DayProgressWidget now={now} />
            </div>
          </div>

          {/* UPCOMING EVENTS */}
          <SectionCard title="Upcoming (14 days)" icon={Calendar} action="View All" onAction={() => navigate('/planner')}>
            {upcomingItems.length === 0 ? (
              <EmptyState emoji="📅" text="No upcoming academic events" />
            ) : (
              <div className="space-y-2">
                {upcomingItems.map((item, i) => {
                  const meta = ITEM_TYPE_META[(item as any).item_type] || ITEM_TYPE_META.task;
                  const Icon = meta.icon;
                  const course = 'course' in item ? item.course : null;
                  const date = 'date' in item ? item.date
                    : 'deadline_date' in item ? item.deadline_date
                    : (item as any).due_date || '';
                  return (
                    <div key={i} className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer" onClick={() => navigate('/planner')}>
                      <Icon className={`w-4 h-4 flex-shrink-0 ${meta.color}`} />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">{item.title}</div>
                        <div className={`text-xs font-semibold ${meta.color}`}>{meta.label}{course ? ` · ${course}` : ''}</div>
                      </div>
                      <div className="text-xs text-slate-400 flex-shrink-0">{date}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </SectionCard>
        </div>

        {/* ── Column 3: Tasks & Deadlines ── */}
        <div className="space-y-5">
          {/* TASKS */}
          <SectionCard title="Active Tasks" icon={CheckSquare} action="View All" onAction={() => navigate('/planner/tasks')}>
            {allTasks.length === 0 ? (
              <EmptyState emoji="✅" text="You're all caught up!" />
            ) : (
              <div className="space-y-2">
                {allTasks.slice(0, 7).map(task => (
                  <div key={task.id} className="flex items-center gap-3 py-1.5 px-2 -mx-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 group transition-colors">
                    <button
                      onClick={() => handleTaskToggle(task.id)}
                      title="Mark complete"
                      className="w-5 h-5 flex-shrink-0 rounded-full border-2 border-slate-300 dark:border-slate-600 hover:border-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors flex items-center justify-center">
                    </button>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate block">{task.title}</span>
                      {task.course && <span className="text-xs text-purple-600 dark:text-purple-400">{task.course}</span>}
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <div className={`w-2 h-2 rounded-full ${PRIORITY_DOT[task.priority] || 'bg-slate-400'}`} title={task.priority} />
                      {task.due_date && task.due_date < today && (
                        <span title="Overdue"><AlertTriangle className="w-3.5 h-3.5 text-red-500" /></span>
                      )}
                    </div>
                  </div>
                ))}
                {allTasks.length > 7 && (
                  <p className="text-xs text-slate-400 text-center pt-1">+{allTasks.length - 7} more tasks</p>
                )}
              </div>
            )}
          </SectionCard>

          {/* DEADLINES */}
          <SectionCard title="Deadlines" icon={AlertTriangle} action="Assignments" onAction={() => navigate('/planner/assignments')}>
            {overdueTotal > 0 && (
              <div className="mb-3 flex items-center gap-2 p-2.5 bg-red-50 dark:bg-red-900/15 border border-red-200 dark:border-red-800/50 rounded-xl text-red-700 dark:text-red-400 text-xs font-semibold">
                <AlertTriangle className="w-4 h-4" />
                {overdueTotal} overdue item{overdueTotal > 1 ? 's' : ''}
              </div>
            )}
            {allDeadlines.length === 0 ? (
              <EmptyState emoji="🎯" text="No upcoming deadlines" />
            ) : (
              <div className="space-y-2.5">
                {allDeadlines.map((a, i) => {
                  const u = URGENCY_LABEL[(a as any)._urgency] || URGENCY_LABEL[2];
                  return (
                    <div key={i} className="flex items-center justify-between gap-3 p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer" onClick={() => navigate('/planner/assignments')}>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">{a.title}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">{a.course || 'No course'} · {a.deadline_date}</div>
                      </div>
                      <span className={`text-xs font-bold flex-shrink-0 ${u.color}`}>{u.label}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </SectionCard>

          {/* PLANNER EVENTS TODAY */}
          <SectionCard title="Events Today" icon={Zap} action="Planner" onAction={() => navigate('/planner')}>
            {todayPlannerItems.length === 0 ? (
              <EmptyState emoji="✨" text="No academic events today" />
            ) : (
              <div className="space-y-2">
                {todayPlannerItems.map((item, i) => {
                  const meta = ITEM_TYPE_META[(item as any).item_type] || ITEM_TYPE_META.task;
                  const Icon = meta.icon;
                  const course = 'course' in item ? item.course : null;
                  return (
                    <div key={i} className="flex items-start gap-2.5 p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors">
                      <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${meta.color}`} />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">{item.title}</div>
                        <div className={`text-xs font-medium ${meta.color}`}>{meta.label}{course ? ` · ${course}` : ''}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </SectionCard>
        </div>
      </div>

      {/* ── Modals ── */}
      <ClassDetailModal classRecord={selectedClass} onClose={() => setSelectedClass(null)} onRefresh={refresh} />

      {addingClass && (
        <ClassEditorModal mode="add" initialData={{ batch, section } as any}
          onClose={() => setAddingClass(false)}
          onSaved={() => { setAddingClass(false); loadRoutine(); }} />
      )}

      {addingType && (
        <PlannerItemModal mode="add" itemType={addingType}
          onClose={() => setAddingType(null)}
          onSaved={() => { setAddingType(null); loadPlanner(); }} />
      )}
    </div>
  );
}
