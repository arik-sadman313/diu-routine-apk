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
import type { PlannerTask, UpcomingResponse, OverdueResponse } from '../types/planner';
import { ClassDetailModal } from '../components/ClassDetailModal';
import { ClassEditorModal } from '../components/ClassEditorModal';
import { PlannerItemModal } from '../components/planner/PlannerItemModal';
import { parseRoutineTime } from '../utils/time';
import {
  Clock, ArrowRight, Loader2, Calendar, Plus, BookOpen,
  FileText, ClipboardList, CheckSquare, Bell,
  AlertTriangle, ChevronRight, Cloud, CloudRain, CloudLightning, Sun, CloudFog, MapPin,
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

  const getConditionIcon = (condition: string) => {
    if (condition.includes('Clear')) return '☀';
    if (condition.includes('Rain') || condition.includes('Drizzle') || condition.includes('Showers')) return '🌧';
    if (condition.includes('Thunderstorm')) return '⚡';
    if (condition.includes('Partly Cloudy')) return '🌤';
    return '☁';
  };

  const renderContent = () => {
    if (loading) return <div className="p-4 text-center text-xs text-slate-500 flex items-center justify-center gap-2"><Loader2 className="w-3 h-3 animate-spin" /> Loading weather...</div>;
    if (error || !data) {
      return (
        <div className="p-3 text-center flex items-center justify-center gap-2">
          <CloudFog className="w-4 h-4 text-slate-400 opacity-70" />
          <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Weather unavailable offline</p>
        </div>
      );
    }

    let Icon = Cloud;
    if (data.condition.includes('Clear')) Icon = Sun;
    if (data.condition.includes('Rain') || data.condition.includes('Drizzle') || data.condition.includes('Showers')) Icon = CloudRain;
    if (data.condition.includes('Thunderstorm')) Icon = CloudLightning;

    return (
      <div className="flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-slate-100 dark:divide-slate-800/60 w-full">
        <div className="p-4 flex-shrink-0 flex items-center justify-between md:flex-col md:items-start md:justify-center md:w-48 gap-2 relative">
          <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-purple-500/5 to-transparent rounded-bl-full pointer-events-none" />
          <div>
            <button 
              onClick={() => setIsOpen(true)}
              className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-slate-500 hover:text-purple-500 dark:text-slate-400 dark:hover:text-purple-400 transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500/50 rounded p-0.5 -ml-0.5"
            >
              <MapPin className="w-3 h-3" /> {data.locationName}
            </button>
            <div className="flex items-end gap-2 mt-1">
              <span className="text-3xl font-black text-slate-800 dark:text-slate-100 tracking-tighter leading-none">{data.temp}°</span>
              <span className="text-sm font-semibold text-slate-600 dark:text-slate-300 leading-snug">{data.condition}</span>
            </div>
          </div>
          <div className="flex flex-col items-end md:items-start gap-1">
            <Icon className="w-7 h-7 text-purple-500 dark:text-purple-400 drop-shadow-sm mb-1 hidden md:block" />
            <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-2">
              <span>H:{data.high}° L:{data.low}°</span>
              {data.precipProb > 0 && <span>💧 {data.precipProb}%</span>}
            </div>
          </div>
        </div>

        {/* Hourly Forecast */}
        <div className="flex-1 overflow-hidden">
          <div className="flex overflow-x-auto custom-scrollbar p-3 gap-3 md:gap-4 h-full items-center">
            {data.hourly?.map((h, i) => (
              <div key={i} className="flex flex-col items-center flex-shrink-0 min-w-[36px]">
                <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1.5">
                  {i === 0 ? 'Now' : format(h.time, 'h a')}
                </div>
                <div className="text-lg mb-1 drop-shadow-sm" title={h.condition}>
                  {getConditionIcon(h.condition)}
                </div>
                <div className="text-[11px] font-bold text-slate-700 dark:text-slate-200">
                  {h.temp}°
                </div>
                {h.precipProb > 0 ? (
                  <div className="text-[9px] font-bold text-blue-500 dark:text-blue-400 mt-0.5">
                    {h.precipProb}%
                  </div>
                ) : (
                  <div className="text-[9px] font-bold text-slate-300 dark:text-slate-600 mt-0.5">
                    --
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="relative flex flex-col justify-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-visible">
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

function DailyProgressWidget({ classes, now }: { classes: any[], now: Date }) {
  const total = classes.length;
  let completed = 0;
  let ongoing = 0;
  
  classes.forEach(c => {
    const e = parseRoutineTime(c.end_time, now);
    const s = parseRoutineTime(c.start_time, now);
    if (isBefore(e, now)) completed++;
    else if (isBefore(s, now) && isAfter(e, now)) ongoing++;
  });
  
  const upcoming = total - completed - ongoing;
  
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const endOfDay = startOfDay + 24 * 60 * 60 * 1000;
  const timeProgress = Math.min(100, Math.max(0, ((now.getTime() - startOfDay) / (endOfDay - startOfDay)) * 100));

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden p-4 md:p-5 flex flex-col sm:flex-row items-center gap-6">
      {/* Time Progress */}
      <div className="flex-1 w-full flex flex-col justify-center">
        <div className="flex justify-between items-end mb-2">
          <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Day Progress</div>
          <div className="text-sm font-black text-slate-800 dark:text-slate-100">{Math.round(timeProgress)}%</div>
        </div>
        <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden shadow-inner mb-4 sm:mb-0">
          <div className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full transition-all duration-1000 ease-linear" style={{ width: `${timeProgress}%` }} />
        </div>
      </div>
      
      {/* Class Stats */}
      <div className="flex items-center justify-between sm:justify-center w-full sm:w-auto gap-4 text-center">
        <div className="flex-1 sm:flex-none">
          <div className="text-xl font-black text-slate-800 dark:text-slate-100">{completed}</div>
          <div className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Done</div>
        </div>
        <div className="w-px h-6 bg-slate-200 dark:bg-slate-800" />
        <div className="flex-1 sm:flex-none">
          <div className="text-xl font-black text-purple-600 dark:text-purple-400">{ongoing}</div>
          <div className="text-[9px] font-bold uppercase tracking-widest text-purple-400/80">Now</div>
        </div>
        <div className="w-px h-6 bg-slate-200 dark:bg-slate-800" />
        <div className="flex-1 sm:flex-none">
          <div className="text-xl font-black text-slate-800 dark:text-slate-100">{upcoming}</div>
          <div className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Left</div>
        </div>
      </div>
    </div>
  );
}

// ── main ─────────────────────────────────────────────────────────────────────

export function Dashboard() {
  const navigate = useNavigate();
  const { batch, section } = usePreferences();
  const { selectedVersion, loading: appLoading, getCourseName } = useAppContext();
  const versionId = selectedVersion?.id;

  // routine
  const [classes, setClasses] = useState<ClassRecord[]>([]);
  const [routineLoading, setRoutineLoading] = useState(false);
  const [selectedClass, setSelectedClass] = useState<ClassRecord | null>(null);

  // planner
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
    const [u, o, ts] = await Promise.all([
      plannerApi.getUpcoming(14),
      plannerApi.getOverdue(),
      plannerApi.getTasks({ status: 'Pending' }),
    ]);
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

      {/* ── Main Layout ── */}
      <div className="flex flex-col gap-5 items-stretch w-full max-w-2xl mx-auto mt-4">
        {/* NEXT / CURRENT CLASS */}
        <div
          className={`px-5 py-5 md:px-6 rounded-3xl shadow-md relative overflow-hidden group text-white cursor-pointer ${
            currentClass
              ? 'bg-gradient-to-br from-emerald-500 to-teal-600 shadow-emerald-500/20'
              : 'bg-gradient-to-br from-purple-600 to-violet-700 shadow-purple-500/20'
          } ring-1 ring-white/10`}
          onClick={() => focusClass && setSelectedClass(focusClass)}
        >
          <div className="absolute -right-12 -top-12 w-48 h-48 bg-white/10 rounded-full blur-3xl group-hover:scale-110 group-hover:bg-white/20 transition-all duration-500" />
          
          {currentClass && (
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/20">
              <div 
                className="h-full bg-white/90 transition-all duration-1000 ease-linear"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          )}
          
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4 relative z-10">
            <div className="flex items-center gap-1.5 text-white/90 font-bold text-[10px] uppercase tracking-widest">
              <Clock className="w-3.5 h-3.5" />
              {currentClass ? 'Ongoing Now' : (nextClass && nextClassDay === 'Today') ? `Next Class` : 'No More Classes Today'}
            </div>
            
            {countdownStr && (
              <div className={`text-[9px] font-bold px-2 py-1 rounded-md backdrop-blur-md ${currentClass ? 'bg-black/20 text-white' : 'bg-white/20 text-white'} ring-1 ring-white/20 shadow-sm`}>
                {countdownStr}
              </div>
            )}
          </div>
          
          {focusClass ? (
            <div className="relative z-10">
              {(!currentClass && nextClassDay !== 'Today') && (
                <div className="mb-2">
                  <div className="text-sm font-black opacity-90 tracking-wide border-b border-white/20 pb-1 inline-block uppercase">No More Classes Today</div>
                </div>
              )}
              {(!currentClass && nextClassDay !== 'Today') && (
                <div className="text-[10px] font-bold text-white/70 uppercase tracking-widest mb-1">Next Class</div>
              )}
              <div className="text-3xl md:text-4xl font-black tracking-tight mb-1 drop-shadow-sm leading-none">{focusClass.course_code}</div>
              {getCourseName(focusClass.course_code) && (
                <div className="text-white/80 text-xs md:text-sm font-medium mb-3 leading-tight">
                  {getCourseName(focusClass.course_code)}
                </div>
              )}
              <div className="flex flex-col gap-1.5 mt-1">
                <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold">
                  <div className="bg-black/20 backdrop-blur-md px-2.5 py-1.5 rounded-lg border border-white/10 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 opacity-75" />
                    {nextClassDay !== 'Today' ? `${nextClassDay} · ` : ''}{focusClass.start_time} – {focusClass.end_time}
                  </div>
                  <div className="bg-white/20 backdrop-blur-md px-2.5 py-1.5 rounded-lg border border-white/20 flex items-center gap-1.5 drop-shadow-sm">
                    {focusClass.room}
                  </div>
                  <div className="text-white/90 text-[11px] font-medium flex items-center gap-2 ml-1">
                    <span className="opacity-90">{focusClass.teacher || 'TBA'}</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="relative z-10 py-2">
              <div className="text-2xl font-black mb-1 drop-shadow-sm">No classes today 🎉</div>
              <p className="text-white/80 text-xs font-medium">Enjoy your free time!</p>
            </div>
          )}
        </div>

        {/* TODAY'S SCHEDULE */}
        <SectionCard title="Today's Classes" icon={Calendar} action="Explore" onAction={() => navigate('/explore')}>
          {todayClasses.length === 0 ? (
            <EmptyState emoji="🎉" text="No classes today" />
          ) : (
            <div className="relative pl-3 space-y-2 py-1 border-l-2 border-slate-200 dark:border-slate-800 ml-2">
              {todayClasses.map((c, i) => {
                const s = parseRoutineTime(c.start_time, now);
                const e = parseRoutineTime(c.end_time, now);
                const isPast = isBefore(e, now);
                const isCur = isBefore(s, now) && isAfter(e, now);
                const isNext = c === nextClass;
                return (
                  <div key={i} onClick={() => setSelectedClass(c)} className="relative group cursor-pointer">
                    <div className="absolute -left-[20px] top-3.5 w-3 border-t-2 border-slate-200 dark:border-slate-800 transition-colors group-hover:border-purple-400" />
                    <div className={`absolute -left-[24px] top-2.5 w-2.5 h-2.5 rounded-full border-2 bg-white dark:bg-slate-900 transition-colors ${
                      isCur ? 'border-purple-500 scale-125 shadow-[0_0_8px_rgba(168,85,247,0.5)]' 
                      : isPast ? 'border-slate-300 dark:border-slate-600'
                      : isNext ? 'border-purple-400 dark:border-purple-500 scale-110'
                      : 'border-slate-400 dark:border-slate-500'
                    }`} />
                    
                    <div className={`pl-2 pr-2 py-2 rounded-xl transition-all flex flex-col md:flex-row md:items-center justify-between gap-1 md:gap-4 ${
                      isPast ? 'opacity-[0.7] hover:opacity-100 hover:bg-slate-50 dark:hover:bg-slate-800/50' 
                      : isCur ? 'bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-700/50 shadow-sm' 
                      : isNext ? 'bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                    }`}>
                      <div className="flex-1 min-w-0">
                        <div className={`font-black text-sm tracking-tight flex items-center gap-2 ${isCur ? 'text-purple-700 dark:text-purple-300' : isPast ? 'text-slate-600 dark:text-slate-400' : 'text-slate-800 dark:text-slate-100'}`}>
                          {c.course_code}
                          {isCur && <span className="text-[8px] px-1 py-0.5 bg-purple-600 text-white rounded uppercase tracking-wider leading-none shadow-sm">Now</span>}
                        </div>
                        {getCourseName(c.course_code) && (
                          <div className={`text-[10px] font-medium mt-0.5 truncate ${isCur ? 'text-purple-600/80 dark:text-purple-300/80' : isPast ? 'text-slate-500' : 'text-slate-600 dark:text-slate-400'}`}>
                            {getCourseName(c.course_code)}
                          </div>
                        )}
                      </div>
                      <div className="flex flex-row md:flex-col items-center md:items-end justify-between md:justify-center gap-2 md:gap-0 mt-1 md:mt-0 flex-shrink-0">
                        <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 whitespace-nowrap">{c.start_time} – {c.end_time}</div>
                        <div className="text-[10px] text-slate-600 dark:text-slate-400 font-bold whitespace-nowrap bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded mt-0.5">
                          {c.room}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </SectionCard>

        {/* WEATHER & DAILY PROGRESS */}
        <WeatherWidget />
        <DailyProgressWidget classes={todayClasses} now={now} />

        {/* UPCOMING EVENTS */}
        <SectionCard title="Upcoming (14 days)" icon={Calendar} action="Planner" onAction={() => navigate('/planner')}>
          {upcomingItems.length === 0 ? (
            <EmptyState emoji="📅" text="No upcoming events" />
          ) : (
            <div className="space-y-1">
              {upcomingItems.map((item, i) => {
                const meta = ITEM_TYPE_META[(item as any).item_type] || ITEM_TYPE_META.task;
                const Icon = meta.icon;
                const date = 'date' in item ? item.date
                  : 'deadline_date' in item ? item.deadline_date
                  : (item as any).due_date || '';
                return (
                  <div key={i} className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer" onClick={() => navigate('/planner')}>
                    <Icon className={`w-3.5 h-3.5 flex-shrink-0 ${meta.color}`} />
                    <div className="flex-1 min-w-0 flex items-center justify-between gap-2">
                      <div className="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate">{item.title}</div>
                      <div className="text-[10px] font-medium text-slate-400 flex-shrink-0">{date}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </SectionCard>

        {/* TASKS */}
        <SectionCard title="Active Tasks" icon={CheckSquare} action="Tasks" onAction={() => navigate('/planner/tasks')}>
          {allTasks.length === 0 ? (
            <EmptyState emoji="✅" text="You're all caught up!" />
          ) : (
            <div className="space-y-1">
              {allTasks.slice(0, 5).map(task => (
                <div key={task.id} className="flex items-center gap-2 py-1.5 px-2 -mx-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 group transition-colors">
                  <button
                    onClick={() => handleTaskToggle(task.id)}
                    className="w-4 h-4 flex-shrink-0 rounded border-2 border-slate-300 dark:border-slate-600 hover:border-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors">
                  </button>
                  <div className="flex-1 min-w-0 flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate">{task.title}</span>
                    <div className={`w-1.5 h-1.5 rounded-full ${PRIORITY_DOT[task.priority] || 'bg-slate-400'}`} title={task.priority} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        {/* DEADLINES */}
        <SectionCard title="Deadlines" icon={AlertTriangle} action="Assignments" onAction={() => navigate('/planner/assignments')}>
          {overdueTotal > 0 && (
            <div className="mb-2 flex items-center gap-1.5 p-2 bg-red-50 dark:bg-red-900/15 border border-red-200 dark:border-red-800/50 rounded-lg text-red-700 dark:text-red-400 text-[10px] font-bold uppercase tracking-wide">
              <AlertTriangle className="w-3.5 h-3.5" />
              {overdueTotal} overdue item{overdueTotal > 1 ? 's' : ''}
            </div>
          )}
          {allDeadlines.length === 0 ? (
            <EmptyState emoji="🎯" text="No upcoming deadlines" />
          ) : (
            <div className="space-y-1">
              {allDeadlines.map((a, i) => {
                const u = URGENCY_LABEL[(a as any)._urgency] || URGENCY_LABEL[2];
                return (
                  <div key={i} className="flex items-center justify-between gap-2 p-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer" onClick={() => navigate('/planner/assignments')}>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate">{a.title}</div>
                    </div>
                    <span className={`text-[10px] font-bold flex-shrink-0 ${u.color}`}>{u.label}</span>
                  </div>
                );
              })}
            </div>
          )}
        </SectionCard>

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
