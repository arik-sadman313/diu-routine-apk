import React, { useState } from 'react';
import type { ClassRecord, OverrideRequest } from '../types/api';
import { X, Save, AlertCircle } from 'lucide-react';
import { api } from '../services/api';
import { useAppContext } from '../context/AppContext';

interface ClassEditorModalProps {
  mode: 'add' | 'edit';
  initialData?: ClassRecord | null;
  onClose: () => void;
  onSaved: () => void;
}

const DAYS = ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

export function ClassEditorModal({ mode, initialData, onClose, onSaved }: ClassEditorModalProps) {
  const { selectedVersion, refreshOptions } = useAppContext();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState<Partial<ClassRecord>>(() => {
    const defaults = {
      day: 'Saturday',
      start_time: '08:30',
      end_time: '10:00',
      course_code: '',
      teacher: '',
      room: '',
      batch: '',
      section: '',
      group_code: '',
    };
    if (initialData) return { ...defaults, ...initialData };
    return defaults;
  });


  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVersion) return;
    
    if (formData.start_time && formData.end_time && formData.start_time >= formData.end_time) {
      setError("Start time must be before end time.");
      return;
    }
    
    setLoading(true);
    setError(null);
    try {
      const payload: OverrideRequest = {
        target_class_id: mode === 'edit' && initialData ? initialData.id : undefined,
        override_type: mode === 'edit' ? 'edited' : 'manually_added',
        day: formData.day,
        start_time: formData.start_time,
        end_time: formData.end_time,
        room: formData.room,
        course_code: formData.course_code,
        group_code: formData.group_code,
        batch: formData.batch,
        section: formData.section,
        subgroup: formData.subgroup,
        special_group: formData.special_group,
        teacher: formData.teacher,
      };

      await api.saveOverride(selectedVersion.id, payload);
      await refreshOptions();
      onSaved();
    } catch (err: any) {
      setError(err.message || 'Failed to save class');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div 
        className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex-shrink-0">
          <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100 flex items-center gap-2">
            {mode === 'add' ? 'Add Manual Class' : 'Edit Class'}
          </h3>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="flex flex-col overflow-hidden">
          <div className="p-6 overflow-y-auto custom-scrollbar">
            {error && (
              <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-2 text-red-600 dark:text-red-400 text-sm">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Course Code *</label>
                <input required name="course_code" value={formData.course_code || ''} onChange={handleChange} className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500 outline-none" placeholder="e.g. CSE101" />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Teacher</label>
                <input name="teacher" value={formData.teacher || ''} onChange={handleChange} className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500 outline-none" placeholder="e.g. ABC" />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1">
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Batch *</label>
                <input required name="batch" value={formData.batch || ''} onChange={handleChange} className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500 outline-none" placeholder="60" />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Section *</label>
                <input required name="section" value={formData.section || ''} onChange={handleChange} className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500 outline-none" placeholder="A" />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Group</label>
                <input name="group_code" value={formData.group_code || ''} onChange={handleChange} className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500 outline-none" placeholder="e.g. 60_A" />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1">
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Day *</label>
                <select required name="day" value={formData.day || 'Saturday'} onChange={handleChange} className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500 outline-none">
                  {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Start Time *</label>
                <input required type="time" name="start_time" value={formData.start_time || ''} onChange={handleChange} className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500 outline-none" />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">End Time *</label>
                <input required type="time" name="end_time" value={formData.end_time || ''} onChange={handleChange} className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500 outline-none" />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Room</label>
              <input name="room" value={formData.room || ''} onChange={handleChange} className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500 outline-none" placeholder="e.g. KT-501" />
            </div>
            
            </div>
          </div>

          <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex-shrink-0 flex justify-end gap-3">
            <button type="button" onClick={onClose} disabled={loading} className="px-4 py-2 font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="flex items-center gap-2 px-5 py-2 font-semibold text-white bg-purple-600 hover:bg-purple-700 rounded-lg shadow-lg shadow-purple-500/30 transition-all disabled:opacity-50">
              <Save className="w-4 h-4" />
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
