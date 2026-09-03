
import type { ClassRecord } from '../types/api';
import { X, Clock, MapPin, User, BookOpen, Users, Edit2, EyeOff, RotateCcw, Trash2, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { ClassEditorModal } from './ClassEditorModal';
import { api } from '../services/api';
import { useAppContext } from '../context/AppContext';
import { useLiveTime } from '../hooks/useLiveTime';
import { startOfWeek, addDays, format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { Compass } from 'lucide-react';

const DAYS = ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

interface ClassDetailModalProps {
  classRecord: ClassRecord | null;
  onClose: () => void;
  onRefresh?: () => void;
}

const RECORD_TYPE_META: Record<string, { label: string; className: string }> = {
  edited:         { label: 'Edited',        className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  moved:          { label: 'Moved',         className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  manually_added: { label: 'Manually Added', className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
  hidden:         { label: 'Hidden',        className: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400' },
  original:       { label: 'Original',      className: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400' },
};

function DetailRow({ icon: Icon, label, children }: { icon: any; label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 items-start">
      <div className="w-7 h-7 flex-shrink-0 bg-slate-100 dark:bg-slate-800 rounded-lg flex items-center justify-center mt-0.5">
        <Icon className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-0.5">{label}</div>
        <div className="text-sm font-medium text-slate-800 dark:text-slate-100">{children}</div>
      </div>
    </div>
  );
}

export function ClassDetailModal({ classRecord, onClose, onRefresh }: ClassDetailModalProps) {
  const { selectedVersion } = useAppContext();
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  
  const now = useLiveTime();
  const weekStart = startOfWeek(now, { weekStartsOn: 6 });

  if (!classRecord) return null;

  const dayDate = addDays(weekStart, DAYS.indexOf(classRecord.day));
  const fullDateStr = format(dayDate, 'EEEE, MMMM d, yyyy');

  const typeMeta = RECORD_TYPE_META[classRecord.record_type] || RECORD_TYPE_META.original;

  const handleHide = async () => {
    if (!selectedVersion) return;
    setLoading(true);
    try {
      await api.saveOverride(selectedVersion.id, {
        target_class_id: classRecord.id,
        override_type: 'hidden'
      });
      onRefresh?.();
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleResetOrDelete = async () => {
    if (!selectedVersion) return;
    setLoading(true);
    try {
      await api.deleteOverride(selectedVersion.id, classRecord.id);
      onRefresh?.();
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm" onClick={onClose}>
      <div 
        className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 flex-shrink-0 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
              <BookOpen className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-slate-900 dark:text-slate-100 truncate">{classRecord.course_code}</h3>
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide ${typeMeta.className}`}>
                {typeMeta.label}
              </span>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="flex-shrink-0 ml-2 p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        
        {/* Body */}
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <DetailRow icon={Clock} label="Day & Time">
              <div>{fullDateStr}</div>
              <div className="text-xs text-slate-500 font-normal mt-0.5">{classRecord.start_time} – {classRecord.end_time}</div>
            </DetailRow>
            <DetailRow icon={MapPin} label="Room">
              {classRecord.room || <span className="text-slate-400 italic">—</span>}
            </DetailRow>
          </div>

          <DetailRow icon={User} label="Teacher">
            {classRecord.teacher || <span className="text-slate-400 dark:text-slate-500 italic">Not assigned</span>}
          </DetailRow>

          <DetailRow icon={Users} label="Target Group">
            <div className="flex flex-wrap gap-1.5 mt-1">
              <span className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2.5 py-1 rounded-lg text-xs font-medium">
                Batch {classRecord.batch}
              </span>
              <span className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2.5 py-1 rounded-lg text-xs font-medium">
                Section {classRecord.section}
              </span>
              {classRecord.group_code && (
                <span className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2.5 py-1 rounded-lg text-xs font-medium">
                  Group {classRecord.group_code}
                </span>
              )}
              {classRecord.subgroup && (
                <span className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2.5 py-1 rounded-lg text-xs font-medium">
                  Sub {classRecord.subgroup}
                </span>
              )}
            </div>
          </DetailRow>
        </div>

        {/* Action Buttons */}
        <div className="px-5 pb-5 flex flex-wrap gap-2 justify-end">
          {loading && (
            <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 mr-auto">
              <Loader2 className="w-4 h-4 animate-spin" /> Saving…
            </div>
          )}

          {classRecord.record_type === 'hidden' ? (
            <button
              onClick={handleResetOrDelete}
              disabled={loading}
              className="flex items-center gap-1.5 px-3.5 py-2 text-sm font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors disabled:opacity-50"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Restore
            </button>
          ) : (
            <>
              {classRecord.record_type !== 'original' && classRecord.record_type !== 'manually_added' && (
                <button
                  onClick={handleResetOrDelete}
                  disabled={loading}
                  className="flex items-center gap-1.5 px-3.5 py-2 text-sm font-semibold text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800/50 hover:bg-orange-100 dark:hover:bg-orange-900/40 rounded-xl transition-colors disabled:opacity-50"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Reset
                </button>
              )}
              {classRecord.record_type === 'manually_added' ? (
                <button
                  onClick={handleResetOrDelete}
                  disabled={loading}
                  className="flex items-center gap-1.5 px-3.5 py-2 text-sm font-semibold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 hover:bg-red-100 dark:hover:bg-red-900/40 rounded-xl transition-colors disabled:opacity-50"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Delete
                </button>
              ) : (
                <button
                  onClick={handleHide}
                  disabled={loading}
                  className="flex items-center gap-1.5 px-3.5 py-2 text-sm font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors disabled:opacity-50"
                >
                  <EyeOff className="w-3.5 h-3.5" /> Hide
                </button>
              )}
              <button
                onClick={() => setIsEditing(true)}
                disabled={loading}
                className="flex items-center gap-1.5 px-3.5 py-2 text-sm font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors disabled:opacity-50"
              >
                <Edit2 className="w-3.5 h-3.5" /> Edit
              </button>
              <button
                onClick={() => {
                  onClose();
                  navigate(`/explore?batch=${classRecord.batch}&section=${classRecord.section}`);
                }}
                disabled={loading}
                className="flex items-center gap-1.5 px-3.5 py-2 text-sm font-semibold text-white bg-purple-600 hover:bg-purple-700 rounded-xl shadow-sm shadow-purple-500/20 transition-all disabled:opacity-50"
              >
                <Compass className="w-3.5 h-3.5" /> View in Explore
              </button>
            </>
          )}
        </div>
      </div>
      
      {isEditing && (
        <ClassEditorModal
          mode="edit"
          initialData={classRecord}
          onClose={() => setIsEditing(false)}
          onSaved={() => {
            setIsEditing(false);
            onRefresh?.();
            onClose();
          }}
        />
      )}
    </div>
  );
}
