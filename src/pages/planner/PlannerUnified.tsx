import { useState, useEffect, useMemo } from 'react';
import { plannerApi } from '../../services/plannerApi';
import type { PlannerItem } from '../../types/planner';
import { PlannerItemCard } from '../../components/planner/PlannerItemCard';
import { ErrorBoundary } from '../../components/ErrorBoundary';
import { Loader2, Search, CheckCircle2 } from 'lucide-react';
import { useLiveTime } from '../../hooks/useLiveTime';
import { parseISO, isBefore, isAfter, isSameDay, addDays, startOfDay } from 'date-fns';
import { parseRoutineTime } from '../../utils/time';

const FILTER_TABS = [
  { id: 'all', label: 'All' },
  { id: 'tasks', label: 'Tasks' },
  { id: 'assignments', label: 'Assignments' },
  { id: 'quizzes', label: 'Quizzes' },
  { id: 'exams', label: 'Exams' },
  { id: 'reminders', label: 'Reminders' },
];

export function PlannerUnified({ initialFilter = 'all', onEdit, refreshTrigger = 0 }: { initialFilter?: string; onEdit?: (item: any) => void; refreshTrigger?: number }) {
  const now = useLiveTime();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<PlannerItem[]>([]);
  
  const [activeTab, setActiveTab] = useState(initialFilter);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'completed'>('all');

  const load = async () => {
    setLoading(true);
    try {
      const [e, q, a, t, r] = await Promise.all([
        plannerApi.getExams(),
        plannerApi.getQuizzes(),
        plannerApi.getAssignments(),
        plannerApi.getTasks(),
        plannerApi.getReminders(),
      ]);
      setItems([
        ...(e.exams || []).map(x => ({ ...x, item_type: 'exam' as const })),
        ...(q.quizzes || []).map(x => ({ ...x, item_type: 'quiz' as const })),
        ...(a.assignments || []).map(x => ({ ...x, item_type: 'assignment' as const })),
        ...(t.tasks || []).map(x => ({ ...x, item_type: 'task' as const })),
        ...(r.reminders || []).map(x => ({ ...x, item_type: 'reminder' as const })),
      ] as PlannerItem[]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [refreshTrigger]);

  const handleToggleComplete = async (item: PlannerItem) => {
    if (item.item_type === 'assignment') await plannerApi.toggleAssignmentComplete(item.id);
    if (item.item_type === 'task') await plannerApi.toggleTaskComplete(item.id);
    load(); // Refresh to ensure data consistency
  };
  
  const handleDelete = async (item: PlannerItem) => {
    if (!window.confirm(`Delete ${item.item_type}? This cannot be undone.`)) return;
    if (item.item_type === 'exam') await plannerApi.deleteExam(item.id);
    if (item.item_type === 'quiz') await plannerApi.deleteQuiz(item.id);
    if (item.item_type === 'assignment') await plannerApi.deleteAssignment(item.id);
    if (item.item_type === 'task') await plannerApi.deleteTask(item.id);
    if (item.item_type === 'reminder') await plannerApi.deleteReminder(item.id);
    load();
  };

  // Grouping Logic
  const groupedItems = useMemo(() => {
    const groups = {
      overdue: [] as PlannerItem[],
      today: [] as PlannerItem[],
      tomorrow: [] as PlannerItem[],
      thisWeek: [] as PlannerItem[],
      later: [] as PlannerItem[],
      noDate: [] as PlannerItem[],
      completed: [] as PlannerItem[],
    };

    const todayStart = startOfDay(now);
    const tomorrowStart = addDays(todayStart, 1);
    const weekEnd = addDays(todayStart, 7);

    // Apply Filters First
    let filtered = items.filter(item => {
      // Tab Filter
      if (activeTab !== 'all' && item.item_type !== activeTab.replace(/s$/, '')) {
        if (!(activeTab === 'quizzes' && item.item_type === 'quiz')) { // Handle plural exception
          return false;
        }
      }
      
      // Search Filter
      if (search) {
        const query = search.toLowerCase();
        const titleMatch = item.title.toLowerCase().includes(query);
        const courseMatch = 'course' in item && item.course?.toLowerCase().includes(query);
        if (!titleMatch && !courseMatch) return false;
      }
      
      // Status Filter
      if (statusFilter !== 'all') {
        const isComp = (item as any).status === 'Completed';
        if (statusFilter === 'completed' && !isComp) return false;
        if (statusFilter === 'pending' && isComp) return false;
      }
      
      return true;
    });

    // Bucket into chronological groups
    filtered.forEach(item => {
      let dStr = '';
      let tStr = '23:59';
      
      if (item.item_type === 'exam' || item.item_type === 'quiz') { dStr = item.date; tStr = item.start_time || tStr; }
      else if (item.item_type === 'reminder') { dStr = item.date; tStr = item.time || tStr; }
      else if (item.item_type === 'assignment') { dStr = item.deadline_date; tStr = item.deadline_time || tStr; }
      else if (item.item_type === 'task') { dStr = item.due_date || ''; tStr = item.due_time || tStr; }

      const isCompleted = (item as any).status === 'Completed';

      if (isCompleted) {
        groups.completed.push(item);
        return;
      }

      if (!dStr) {
        groups.noDate.push(item);
        return;
      }

      const itemDate = parseISO(dStr);
      const itemDateTime = parseRoutineTime(tStr, itemDate);

      if (isBefore(itemDateTime, now)) {
        groups.overdue.push(item);
      } else if (isSameDay(itemDate, todayStart)) {
        groups.today.push(item);
      } else if (isSameDay(itemDate, tomorrowStart)) {
        groups.tomorrow.push(item);
      } else if (isAfter(itemDate, tomorrowStart) && isBefore(itemDate, weekEnd)) {
        groups.thisWeek.push(item);
      } else {
        groups.later.push(item);
      }
    });

    // Sort sections chronologically
    const sorter = (a: PlannerItem, b: PlannerItem) => {
      let da = '', db = '', ta = '23:59', tb = '23:59';
      
      if (a.item_type === 'exam' || a.item_type === 'quiz') { da = a.date; ta = a.start_time || ta; }
      else if (a.item_type === 'reminder') { da = a.date; ta = a.time || ta; }
      else if (a.item_type === 'assignment') { da = a.deadline_date; ta = a.deadline_time || ta; }
      else if (a.item_type === 'task') { da = a.due_date || ''; ta = a.due_time || ta; }

      if (b.item_type === 'exam' || b.item_type === 'quiz') { db = b.date; tb = b.start_time || tb; }
      else if (b.item_type === 'reminder') { db = b.date; tb = b.time || tb; }
      else if (b.item_type === 'assignment') { db = b.deadline_date; tb = b.deadline_time || tb; }
      else if (b.item_type === 'task') { db = b.due_date || ''; tb = b.due_time || tb; }

      if (da !== db) return da.localeCompare(db);
      return ta.localeCompare(tb);
    };

    const completedSorter = (a: PlannerItem, b: PlannerItem) => {
      const ua = a.updated_at || '';
      const ub = b.updated_at || '';
      // descending
      return ub.localeCompare(ua);
    };

    groups.overdue.sort(sorter);
    groups.today.sort(sorter);
    groups.tomorrow.sort(sorter);
    groups.thisWeek.sort(sorter);
    groups.later.sort(sorter);
    groups.noDate.sort(sorter);
    groups.completed.sort(completedSorter);

    return groups;
  }, [items, activeTab, search, statusFilter, now]);

  if (loading) return (
    <div className="flex justify-center py-20">
      <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
    </div>
  );

  const hasAnyItems = 
    groupedItems.overdue.length > 0 || 
    groupedItems.today.length > 0 || 
    groupedItems.tomorrow.length > 0 || 
    groupedItems.thisWeek.length > 0 || 
    groupedItems.later.length > 0 ||
    groupedItems.noDate.length > 0 ||
    groupedItems.completed.length > 0;

  return (
    <div className="space-y-6 animate-in fade-in duration-300 pb-10">
      
      {/* Filters Bar */}
      <div className="space-y-4 sticky top-[60px] md:top-0 z-20 bg-slate-50/80 dark:bg-slate-950/80 backdrop-blur-md pt-2 pb-4 -mx-4 px-4 sm:mx-0 sm:px-0">
        
        {/* Quick Tabs */}
        <div className="flex overflow-x-auto custom-scrollbar pb-2 -mb-2 px-1">
          <div className="flex gap-2">
            {FILTER_TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-1.5 rounded-full text-xs font-bold transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'bg-purple-600 text-white shadow-md shadow-purple-500/20'
                    : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Secondary Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search items, courses..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50"
            />
          </div>
          <select 
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-semibold text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-purple-500/50 appearance-none"
          >
            <option value="all">All Status</option>
            <option value="pending">Todo / Pending</option>
            <option value="completed">Completed</option>
          </select>
        </div>
      </div>

      {/* Content List */}
      {!hasAnyItems ? (
        <div className="py-20 flex flex-col items-center justify-center text-center px-4">
          <div className="w-16 h-16 bg-purple-100 dark:bg-purple-900/20 rounded-full flex items-center justify-center mb-4">
            <CheckCircle2 className="w-8 h-8 text-purple-500" />
          </div>
          <h3 className="text-xl font-extrabold text-slate-900 dark:text-white mb-2">You're all caught up 🎉</h3>
          <p className="text-slate-500 dark:text-slate-400 max-w-sm">
            No tasks, assignments, quizzes, exams or reminders here. Enjoy your free time!
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          
          {groupedItems.overdue.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-bold text-red-500 flex items-center gap-2 border-b border-red-200 dark:border-red-900/30 pb-2 uppercase tracking-widest">
                Overdue
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {groupedItems.overdue.map(item => (
                  <ErrorBoundary key={`${item.item_type}-${item.id}`}>
                    <PlannerItemCard 
                      item={item} 
                      onToggleComplete={handleToggleComplete}
                      onDelete={handleDelete}
                      onEdit={onEdit}
                      isOverdue={true} 
                    />
                  </ErrorBoundary>
                ))}
              </div>
            </section>
          )}

          {groupedItems.today.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2 uppercase tracking-widest">
                Today
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {groupedItems.today.map(item => (
                  <ErrorBoundary key={`${item.item_type}-${item.id}`}>
                    <PlannerItemCard 
                      item={item} 
                      onToggleComplete={handleToggleComplete} 
                      onDelete={handleDelete}
                      onEdit={onEdit}
                    />
                  </ErrorBoundary>
                ))}
              </div>
            </section>
          )}

          {groupedItems.tomorrow.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2 uppercase tracking-widest">
                Tomorrow
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {groupedItems.tomorrow.map(item => (
                  <ErrorBoundary key={`${item.item_type}-${item.id}`}>
                    <PlannerItemCard 
                      item={item} 
                      onToggleComplete={handleToggleComplete} 
                      onDelete={handleDelete}
                      onEdit={onEdit}
                    />
                  </ErrorBoundary>
                ))}
              </div>
            </section>
          )}

          {groupedItems.thisWeek.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2 uppercase tracking-widest">
                This Week
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {groupedItems.thisWeek.map(item => (
                  <ErrorBoundary key={`${item.item_type}-${item.id}`}>
                    <PlannerItemCard 
                      item={item} 
                      onToggleComplete={handleToggleComplete} 
                      onDelete={handleDelete}
                      onEdit={onEdit}
                    />
                  </ErrorBoundary>
                ))}
              </div>
            </section>
          )}

          {groupedItems.later.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2 uppercase tracking-widest">
                Later
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {groupedItems.later.map(item => (
                  <ErrorBoundary key={`${item.item_type}-${item.id}`}>
                    <PlannerItemCard 
                      item={item} 
                      onToggleComplete={handleToggleComplete}
                      onDelete={handleDelete}
                      onEdit={onEdit}
                    />
                  </ErrorBoundary>
                ))}
              </div>
            </section>
          )}

          {groupedItems.noDate.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2 uppercase tracking-widest">
                No Date
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {groupedItems.noDate.map(item => (
                  <ErrorBoundary key={`${item.item_type}-${item.id}`}>
                    <PlannerItemCard 
                      item={item} 
                      onToggleComplete={handleToggleComplete}
                      onDelete={handleDelete}
                      onEdit={onEdit}
                    />
                  </ErrorBoundary>
                ))}
              </div>
            </section>
          )}

          {groupedItems.completed.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2 uppercase tracking-widest">
                Completed
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {groupedItems.completed.map(item => (
                  <ErrorBoundary key={`${item.item_type}-${item.id}`}>
                    <PlannerItemCard 
                      item={item} 
                      onToggleComplete={handleToggleComplete}
                      onDelete={handleDelete}
                      onEdit={onEdit}
                    />
                  </ErrorBoundary>
                ))}
              </div>
            </section>
          )}
          
        </div>
      )}
    </div>
  );
}
