import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { 
  CalendarDays, BookOpen, FileText, ClipboardList, 
  CheckSquare, Bell, Plus, ChevronDown, List
} from 'lucide-react';
import { PlannerItemModal } from '../../components/planner/PlannerItemModal';
import { PlannerUnified } from './PlannerUnified';
import { PlannerCalendar } from './PlannerCalendar';

export function PlannerLayout() {
  const [addingType, setAddingType] = useState<'exam'|'quiz'|'assignment'|'task'|'reminder' | null>(null);
  const [editingItem, setEditingItem] = useState<any | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  
  const location = useLocation();
  const navigate = useNavigate();

  const isCalendar = location.pathname.includes('/calendar');
  
  // Extract initial filter from path if it exists
  const pathParts = location.pathname.split('/').filter(Boolean);
  const lastPart = pathParts[pathParts.length - 1];
  const initialFilter = ['tasks', 'assignments', 'quizzes', 'exams', 'reminders'].includes(lastPart) 
    ? lastPart 
    : 'all';

  const handleAdded = () => {
    setAddingType(null);
    setMenuOpen(false);
    setRefreshKey(prev => prev + 1);
  };

  const actions = [
    { type: 'assignment' as const, label: 'Assignment', icon: ClipboardList, color: 'text-amber-500' },
    { type: 'task' as const,       label: 'Task',       icon: CheckSquare,  color: 'text-emerald-500' },
    { type: 'quiz' as const,       label: 'Quiz',       icon: FileText,     color: 'text-blue-500' },
    { type: 'exam' as const,       label: 'Exam',       icon: BookOpen,     color: 'text-red-500' },
    { type: 'reminder' as const,   label: 'Reminder',   icon: Bell,         color: 'text-purple-500' },
  ];

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-in fade-in duration-300 pb-10">
      
      {/* Header Area */}
      <div className="page-header border-b border-slate-200 dark:border-slate-800 pb-6">
        <div className="page-header-content">
          <div className="page-header-icon">
            <CalendarDays />
          </div>
          <div className="page-header-text">
            <h2>Planner</h2>
            <p>Plan your classes, assignments, exams and tasks.</p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-3 self-end sm:self-auto">
          
          {/* View Toggle */}
          <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-xl">
            <button
              onClick={() => navigate('/planner')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-bold transition-colors ${
                !isCalendar 
                  ? 'bg-white dark:bg-slate-800 text-purple-600 dark:text-purple-400 shadow-sm' 
                  : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              <List className="w-4 h-4" /> <span className="hidden sm:inline">List</span>
            </button>
            <button
              onClick={() => navigate('/planner/calendar')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-bold transition-colors ${
                isCalendar 
                  ? 'bg-white dark:bg-slate-800 text-purple-600 dark:text-purple-400 shadow-sm' 
                  : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              <CalendarDays className="w-4 h-4" /> <span className="hidden sm:inline">Calendar</span>
            </button>
          </div>

          <div className="relative">
            <button 
              onClick={() => setMenuOpen(!menuOpen)}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold text-sm shadow-md hover:shadow-lg transition-all active:scale-95"
            >
              <Plus className="w-4 h-4" /> Add <ChevronDown className="w-4 h-4 opacity-70" />
            </button>
            
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-100 dark:border-slate-700 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="p-1.5 flex flex-col gap-0.5">
                    {actions.map(a => (
                      <button
                        key={a.type}
                        onClick={() => { setAddingType(a.type); setMenuOpen(false); }}
                        className="flex items-center gap-2.5 px-3 py-2 w-full text-left rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                      >
                        <a.icon className={`w-4 h-4 ${a.color}`} />
                        <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{a.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Page Content */}
      <div>
        {isCalendar ? (
          <PlannerCalendar onEdit={setEditingItem} refreshTrigger={refreshKey} />
        ) : (
          <PlannerUnified initialFilter={initialFilter} onEdit={setEditingItem} refreshTrigger={refreshKey} />
        )}
      </div>

      {addingType && (
        <PlannerItemModal
          mode="add"
          itemType={addingType}
          onClose={() => setAddingType(null)}
          onSaved={handleAdded}
        />
      )}

      {editingItem && (
        <PlannerItemModal
          mode="edit"
          itemType={editingItem.item_type}
          initialData={editingItem}
          onClose={() => setEditingItem(null)}
          onSaved={() => { setEditingItem(null); setRefreshKey(prev => prev + 1); }}
        />
      )}
    </div>
  );
}
