import { useState, useEffect } from 'react';
import { Loader2, Calendar } from 'lucide-react';
import { plannerApi } from '../../services/plannerApi';
import type { PlannerItem, CalendarResponse } from '../../types/planner';
import { CalendarView } from '../../components/planner/CalendarView';
import { PlannerItemCard } from '../../components/planner/PlannerItemCard';
import { ErrorBoundary } from '../../components/ErrorBoundary';
import { plannerApi as pa } from '../../services/plannerApi';

export function PlannerCalendar({ onEdit, refreshTrigger = 0 }: { onEdit?: (item: any) => void; refreshTrigger?: number }) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [data, setData] = useState<CalendarResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [selectedItems, setSelectedItems] = useState<PlannerItem[]>([]);

  const load = async () => {
    setLoading(true);
    try {
      const res = await plannerApi.getCalendar(year, month);
      setData(res);
      // Auto-update selected day items if they changed
      if (selectedDay && res.events[selectedDay]) {
        setSelectedItems(res.events[selectedDay]);
      } else if (selectedDay) {
        setSelectedItems([]);
      }
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [year, month, refreshTrigger]);

  const handleDayClick = (date: string, items: PlannerItem[]) => {
    setSelectedDay(date);
    setSelectedItems(items);
  };

  const handleToggleComplete = async (item: PlannerItem) => {
    if (item.item_type === 'assignment') await pa.toggleAssignmentComplete(item.id);
    if (item.item_type === 'task') await pa.toggleTaskComplete(item.id);
    load();
  };

  const handleDelete = async (item: PlannerItem) => {
    if (!window.confirm(`Delete ${item.item_type}? This cannot be undone.`)) return;
    if (item.item_type === 'exam') await pa.deleteExam(item.id);
    if (item.item_type === 'quiz') await pa.deleteQuiz(item.id);
    if (item.item_type === 'assignment') await pa.deleteAssignment(item.id);
    if (item.item_type === 'task') await pa.deleteTask(item.id);
    if (item.item_type === 'reminder') await pa.deleteReminder(item.id);
    load();
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-2">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Calendar</h2>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-purple-500" /></div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          <div className="lg:col-span-2">
            <CalendarView
              events={data?.events || {}}
              year={year} month={month}
              selectedDate={selectedDay}
              onNavigate={(y, m) => { setYear(y); setMonth(m); setSelectedDay(null); }}
              onDayClick={handleDayClick}
            />
          </div>

          <div className="space-y-4">
            {selectedDay ? (
              <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm animate-in fade-in slide-in-from-right-2 duration-200">
                <h3 className="font-extrabold text-lg text-slate-800 dark:text-slate-100 mb-4 pb-4 border-b border-slate-100 dark:border-slate-800/50">
                  {new Date(selectedDay + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                </h3>
                {selectedItems.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <div className="text-3xl mb-2">🏖️</div>
                    <p className="font-bold text-slate-700 dark:text-slate-300">Nothing scheduled</p>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Enjoy your free day.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {selectedItems.map((item, i) => (
                      <ErrorBoundary key={`${item.item_type}-${item.id}-${i}`}>
                        <PlannerItemCard item={item} onToggleComplete={handleToggleComplete} onEdit={onEdit} onDelete={handleDelete} />
                      </ErrorBoundary>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-slate-50/50 dark:bg-slate-900/30 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-800 p-8 flex flex-col items-center justify-center text-center h-full min-h-[250px]">
                <div className="w-12 h-12 bg-white dark:bg-slate-800 rounded-2xl flex items-center justify-center shadow-sm mb-3">
                  <Calendar className="w-6 h-6 text-slate-400" />
                </div>
                <p className="font-bold text-slate-700 dark:text-slate-300">Select a date</p>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Click a day on the calendar to see events.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
