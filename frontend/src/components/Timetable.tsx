import { useState } from 'react';
import type { ClassRecord } from '../types/api';
import { ClassCard } from './ClassCard';
import { ClassDetailModal } from './ClassDetailModal';
import { parseRoutineTime } from '../utils/time';
import { format, startOfWeek, addDays } from 'date-fns';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { useLiveTime } from '../hooks/useLiveTime';

interface TimetableProps {
  classes: ClassRecord[];
  showHidden?: boolean;
  onRefresh?: () => void;
  viewMode?: 'week' | 'list';
}

const pad = (n: number) => String(n).padStart(2, '0');
const DAYS = ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

export function Timetable({ classes, showHidden = false, onRefresh = () => {}, viewMode = 'week' }: TimetableProps) {
  const [selectedClass, setSelectedClass] = useState<ClassRecord | null>(null);
  
  const now = useLiveTime(60000); // update every minute
  const todayStr = format(now, 'EEEE');
  const weekStart = startOfWeek(now, { weekStartsOn: 6 });

  // Mobile/list day navigation
  const [currentDayIndex, setCurrentDayIndex] = useState(() => {
    const idx = DAYS.indexOf(todayStr);
    return idx !== -1 ? idx : 0;
  });

  // Keep navigation in sync with actual today if user hasn't explicitly navigated away recently? 
  // For simplicity, we just allow manual navigation but "Today" uses the live `now`.


  const visibleClasses = showHidden ? classes : classes.filter(c => c.record_type !== 'hidden');

  if (visibleClasses.length === 0) {
    return (
      <div className="text-center py-16 px-4">
        <div className="text-4xl mb-3">📭</div>
        <p className="text-slate-500 dark:text-slate-400 font-medium">No classes to display.</p>
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Try selecting a different batch, section, or clearing filters.</p>
      </div>
    );
  }

  // 1. Group classes by day
  const classesByDay: Record<string, ClassRecord[]> = {};
  DAYS.forEach(day => classesByDay[day] = []);
  
  visibleClasses.forEach(c => {
    if (classesByDay[c.day]) {
      classesByDay[c.day].push(c);
    }
  });

  const activeDays = DAYS.filter(day => classesByDay[day].length > 0);
  
  // Set initial day if current index is empty, try to find an active one
  const currentActiveDay = DAYS[currentDayIndex];

  // Compute boundaries for the timeline
  let minMinutes = 24 * 60;
  let maxMinutes = 0;
  
  visibleClasses.forEach(c => {
    const start = parseRoutineTime(c.start_time);
    const end = parseRoutineTime(c.end_time);
    const startMins = start.getHours() * 60 + start.getMinutes();
    const endMins = end.getHours() * 60 + end.getMinutes();
    if (startMins < minMinutes) minMinutes = startMins;
    if (endMins > maxMinutes) maxMinutes = endMins;
  });
  
  // Snap to 30 min boundaries and add some padding
  minMinutes = Math.floor(minMinutes / 30) * 30;
  maxMinutes = Math.ceil(maxMinutes / 30) * 30;
  if (minMinutes >= maxMinutes) {
    minMinutes = 8 * 60; // 08:00
    maxMinutes = 18 * 60; // 18:00
  }
  
  const totalMinutes = maxMinutes - minMinutes;
  
  // Create dynamic markers from actual start/end times
  const uniqueTimeMinutes = Array.from(new Set([
    ...visibleClasses.map(c => parseRoutineTime(c.start_time)),
    ...visibleClasses.map(c => parseRoutineTime(c.end_time))
  ].map(d => d.getHours() * 60 + d.getMinutes()))).sort((a, b) => a - b);

  // If there are no classes, fallback to some default boundaries
  const timeMarkers = uniqueTimeMinutes.length > 0 ? uniqueTimeMinutes : [510, 600, 690, 780, 870, 960, 1050];
  const nowMins = now.getHours() * 60 + now.getMinutes();

  const renderTimeline = () => (
    <div className="overflow-x-auto custom-scrollbar">
      <div className="min-w-[900px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden relative shadow-sm">
        
        {/* Header - Times */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 relative ml-24 h-11">
           {timeMarkers.map((mins) => {
             const h = Math.floor(mins / 60);
             const m = mins % 60;
             const label = `${pad(h)}:${pad(m)}`;
             return (
               <div 
                 key={mins} 
                 className="absolute top-0 bottom-0 border-l border-slate-200 dark:border-slate-700/50 flex flex-col pt-1.5"
                 style={{ left: `${((mins - minMinutes) / totalMinutes) * 100}%` }}
               >
                 <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 pl-1.5">{label}</span>
               </div>
             )
           })}
        </div>

        {/* Days */}
        <div className="divide-y divide-slate-200 dark:divide-slate-800">
          {activeDays.map(day => {
            const dayClasses = classesByDay[day];
            
            // Layout algorithm for overlapping classes
            const sorted = [...dayClasses].sort((a, b) => {
               const aStart = parseRoutineTime(a.start_time).getTime();
               const bStart = parseRoutineTime(b.start_time).getTime();
               if (aStart !== bStart) return aStart - bStart;
               return parseRoutineTime(b.end_time).getTime() - parseRoutineTime(a.end_time).getTime();
            });
            
            const rows: ClassRecord[][] = [];
            sorted.forEach(c => {
               const start = parseRoutineTime(c.start_time).getTime();
               const end = parseRoutineTime(c.end_time).getTime();
               
               let placed = false;
               for (let i = 0; i < rows.length; i++) {
                 const overlaps = rows[i].some(existing => {
                    const eStart = parseRoutineTime(existing.start_time).getTime();
                    const eEnd = parseRoutineTime(existing.end_time).getTime();
                    return (start < eEnd && end > eStart);
                 });
                 if (!overlaps) {
                   rows[i].push(c);
                   placed = true;
                   break;
                 }
               }
               if (!placed) {
                 rows.push([c]);
               }
            });
            
            const rowHeight = 110;
            const dayHeight = Math.max(rowHeight * rows.length, rowHeight) + 16;
            
            const isToday = day === todayStr;
            const dayDate = addDays(weekStart, DAYS.indexOf(day));

            return (
              <div key={day} className={`relative flex group transition-colors ${isToday ? 'bg-purple-50/30 dark:bg-purple-900/10' : 'hover:bg-slate-50/50 dark:hover:bg-slate-800/10'}`} style={{ height: dayHeight }}>
                {/* Day Label */}
                <div className={`w-24 flex-shrink-0 border-r border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center z-10 sticky left-0 shadow-[1px_0_0_0_rgba(0,0,0,0.05)] dark:shadow-[1px_0_0_0_rgba(255,255,255,0.05)] ${isToday ? 'bg-purple-50 dark:bg-purple-900/20' : 'bg-white dark:bg-slate-900'}`}>
                  {isToday && <div className="absolute top-1 text-[8px] font-black tracking-widest text-purple-600 dark:text-purple-400 uppercase">Today</div>}
                  <span className={`font-black text-sm tracking-wide ${isToday ? 'text-purple-700 dark:text-purple-300' : 'text-slate-700 dark:text-slate-300'}`}>
                    {day.slice(0, 3).toUpperCase()} <span className="text-lg ml-0.5">{format(dayDate, 'd')}</span>
                  </span>
                </div>
                
                {/* Timeline background grids */}
                <div className="absolute top-0 bottom-0 left-24 right-0 pointer-events-none">
                  {timeMarkers.map((mins) => (
                    <div 
                      key={mins}
                      className="absolute top-0 bottom-0 border-l border-slate-200/50 dark:border-slate-700/30"
                      style={{ left: `${((mins - minMinutes) / totalMinutes) * 100}%` }}
                    />
                  ))}
                  
                  {/* NOW indicator */}
                  {isToday && nowMins >= minMinutes && nowMins <= maxMinutes && (
                    <div 
                      className="absolute top-0 bottom-0 border-l-2 border-red-500 z-20 flex flex-col items-center"
                      style={{ left: `${((nowMins - minMinutes) / totalMinutes) * 100}%` }}
                    >
                      <div className="bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full absolute -top-2.5 -translate-x-1/2 whitespace-nowrap shadow-sm shadow-red-500/30">
                        NOW · {format(now, 'h:mm a')}
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Classes Container */}
                <div className="relative flex-1 py-2 ml-24">
                  {rows.map((rowClasses, rowIndex) => (
                    rowClasses.map(c => {
                      const start = parseRoutineTime(c.start_time);
                      const end = parseRoutineTime(c.end_time);
                      const startMins = start.getHours() * 60 + start.getMinutes();
                      const endMins = end.getHours() * 60 + end.getMinutes();
                      
                      const leftPercent = ((startMins - minMinutes) / totalMinutes) * 100;
                      const widthPercent = ((endMins - startMins) / totalMinutes) * 100;
                      
                      return (
                        <div 
                          key={c.id} 
                          className="absolute px-1"
                          style={{ 
                            left: `${leftPercent}%`, 
                            width: `${widthPercent}%`,
                            top: `${rowIndex * rowHeight + 8}px`,
                            height: `${rowHeight}px`
                          }}
                        >
                           <ClassCard classRecord={c} onClick={setSelectedClass} />
                        </div>
                      )
                    })
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  );

  const renderList = () => {
    const handlePrev = () => {
      if (currentDayIndex > 0) setCurrentDayIndex(currentDayIndex - 1);
    };
    const handleNext = () => {
      if (currentDayIndex < 6) setCurrentDayIndex(currentDayIndex + 1);
    };
    const handleToday = () => {
      const todayStr = format(now, 'EEEE');
      const idx = DAYS.indexOf(todayStr);
      if (idx !== -1) setCurrentDayIndex(idx);
    };

    const dayClasses = [...classesByDay[currentActiveDay]].sort((a, b) => 
      parseRoutineTime(a.start_time).getTime() - parseRoutineTime(b.start_time).getTime()
    );

    return (
      <div className="space-y-4 max-w-2xl mx-auto pb-8">
        <div className="flex items-center justify-between bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-2 rounded-xl shadow-sm">
           <button 
             onClick={handlePrev} 
             disabled={currentDayIndex === 0}
             className="p-2.5 bg-slate-50 dark:bg-slate-800 rounded-lg disabled:opacity-30 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
           >
             <ChevronLeft className="w-5 h-5 text-slate-700 dark:text-slate-300" />
           </button>
           <div className="flex flex-col items-center">
             <div className="flex items-center gap-2 font-bold text-slate-800 dark:text-slate-200 text-lg">
               <Calendar className="w-5 h-5 text-purple-500" />
               {currentActiveDay}, {format(addDays(weekStart, currentDayIndex), 'MMM d')}
             </div>
             <button onClick={handleToday} className="text-[10px] font-bold text-purple-600 hover:text-purple-700 uppercase tracking-widest mt-0.5">Today</button>
           </div>
           <button 
             onClick={handleNext} 
             disabled={currentDayIndex === 6}
             className="p-2.5 bg-slate-50 dark:bg-slate-800 rounded-lg disabled:opacity-30 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
           >
             <ChevronRight className="w-5 h-5 text-slate-700 dark:text-slate-300" />
           </button>
        </div>

        <div className="grid grid-cols-1 gap-3">
          {dayClasses.length > 0 ? (
            dayClasses.map(c => (
              <div key={c.id} className="h-[120px]">
                <ClassCard classRecord={c} onClick={setSelectedClass} />
              </div>
            ))
          ) : (
            <div className="text-center py-16 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm border-dashed">
              <div className="text-3xl mb-2 text-slate-300 dark:text-slate-600">🏖️</div>
              <div className="text-slate-500 dark:text-slate-400 font-medium">
                No classes on {currentActiveDay}.
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      {viewMode === 'week' ? (
        <div className="hidden md:block animate-in fade-in duration-300">{renderTimeline()}</div>
      ) : (
        <div className="animate-in fade-in duration-300">{renderList()}</div>
      )}
      
      {/* Fallback to list view on small screens if they are in week mode */}
      {viewMode === 'week' && (
        <div className="md:hidden animate-in fade-in duration-300">
           {renderList()}
        </div>
      )}

      <ClassDetailModal 
        classRecord={selectedClass} 
        onClose={() => setSelectedClass(null)}
        onRefresh={onRefresh}
      />
    </>
  );
}
