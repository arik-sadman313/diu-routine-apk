
import type { ClassRecord } from '../types/api';

interface ClassCardProps {
  classRecord: ClassRecord;
  onClick: (c: ClassRecord) => void;
}

const RECORD_TYPE_BADGE: Record<string, { label: string; className: string }> = {
  edited:        { label: 'Edited',   className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400' },
  moved:         { label: 'Moved',    className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400' },
  manually_added:{ label: 'Manual',   className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400' },
  hidden:        { label: 'Hidden',   className: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400' },
};

export function ClassCard({ classRecord, onClick }: ClassCardProps) {
  const badge = RECORD_TYPE_BADGE[classRecord.record_type];

  return (
    <div
      onClick={() => onClick(classRecord)}
      className="p-2.5 bg-white dark:bg-slate-800/90 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700/80 cursor-pointer hover:shadow-md hover:border-purple-400 dark:hover:border-purple-500 transition-all flex flex-col h-full group overflow-hidden"
    >
      <div className="flex flex-col flex-1 min-w-0">
        <div className="font-bold text-sm text-slate-900 dark:text-slate-100 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors leading-tight truncate" title={classRecord.course_code}>
          {classRecord.course_code}
        </div>
        
        <div className="text-xs font-medium text-slate-700 dark:text-slate-300 mt-1 truncate" title={classRecord.teacher || 'No teacher'}>
          {classRecord.teacher || <span className="text-slate-400 dark:text-slate-500 italic">No teacher</span>}
        </div>
        
        <div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium mt-0.5 truncate">
          {classRecord.start_time} – {classRecord.end_time}
        </div>
      </div>

      <div className="flex justify-between items-end mt-2 pt-2 border-t border-slate-100 dark:border-slate-700/50 gap-1.5">
        <div className="flex gap-1.5 flex-wrap min-w-0">
          {classRecord.group_code && (
            <span 
              title={classRecord.group_code}
              className="bg-slate-100 dark:bg-slate-700/70 text-slate-600 dark:text-slate-300 px-1.5 py-0.5 rounded text-[10px] font-bold truncate max-w-[50%]"
            >
              {classRecord.group_code}
            </span>
          )}
          <span 
            title={classRecord.room}
            className="bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300 px-1.5 py-0.5 rounded text-[10px] font-bold truncate max-w-full"
          >
            {classRecord.room}
          </span>
        </div>
        
        {badge && (
          <span className={`text-[9px] font-bold px-1 py-0.5 rounded uppercase tracking-wider flex-shrink-0 ${badge.className}`}>
            {badge.label}
          </span>
        )}
      </div>
    </div>
  );
}
