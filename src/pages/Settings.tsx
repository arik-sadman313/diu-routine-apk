import { useEffect, useState, useRef, useMemo } from 'react';
import { usePreferences } from '../hooks/usePreferences';
import { useTheme } from '../hooks/useTheme';
import { useAppContext } from '../context/AppContext';
import { Settings as SettingsIcon, Moon, Sun, Monitor, Trash2, MapPin, Navigation, Loader2, CheckCircle2, BookOpen, Edit2, Plus, Search, X, ChevronDown, GraduationCap, Users } from 'lucide-react';
import { api } from '../services/api';

// ... LocationSearch component remains the same ...
function LocationSearch({ value, onChange }: { value: string; onChange: (val: string) => void }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const currentName = useMemo(() => {
    if (value === 'auto') return 'Use Device Location';
    const parts = value.split(',');
    if (parts.length >= 3) return parts.slice(2).join(', ');
    return 'Search for a city...';
  }, [value]);

  useEffect(() => {
    if (!isOpen) setQuery('');
  }, [isOpen]);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=5`);
        const data = await res.json();
        setResults(data.results || []);
      } catch (err) {
        console.error(err);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  return (
    <div className="relative" ref={wrapperRef}>
      <button 
        className="w-full text-left bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500/50 flex justify-between items-center text-sm transition-colors hover:bg-slate-100 dark:hover:bg-slate-900"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="truncate font-medium">{isOpen && query ? query : currentName}</span>
        <MapPin className="w-4 h-4 text-slate-400 flex-shrink-0 ml-2" />
      </button>

      {isOpen && (
        <div className="absolute z-10 w-full mt-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="p-2 border-b border-slate-100 dark:border-slate-800">
            <input
              type="text"
              autoFocus
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-shadow"
              placeholder="Search city (e.g. Dhaka)..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          
          <div className="max-h-60 overflow-y-auto custom-scrollbar">
            <button
              onClick={() => { onChange('auto'); setIsOpen(false); }}
              className="w-full text-left px-4 py-3 text-sm hover:bg-purple-50 dark:hover:bg-purple-900/20 flex items-center gap-2.5 text-slate-700 dark:text-slate-200 transition-colors font-medium"
            >
              <Navigation className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              Use Device Location
            </button>
            
            {searching ? (
              <div className="px-4 py-4 text-sm text-slate-500 flex items-center justify-center gap-2 border-t border-slate-50 dark:border-slate-800/50">
                <Loader2 className="w-4 h-4 animate-spin text-purple-500" /> Searching...
              </div>
            ) : results.length > 0 ? (
              results.map(r => (
                <button
                  key={r.id}
                  onClick={() => {
                    const name = [r.name, r.admin1, r.country].filter(Boolean).join(', ');
                    onChange(`${r.latitude},${r.longitude},${name}`);
                    setIsOpen(false);
                  }}
                  className="w-full text-left px-4 py-3 text-sm hover:bg-slate-50 dark:hover:bg-slate-800/50 flex items-center gap-2.5 text-slate-700 dark:text-slate-200 transition-colors border-t border-slate-50 dark:border-slate-800/50 font-medium"
                >
                  <MapPin className="w-4 h-4 text-slate-400" />
                  <span className="truncate">{[r.name, r.admin1, r.country].filter(Boolean).join(', ')}</span>
                </button>
              ))
            ) : query.trim() ? (
              <div className="px-4 py-4 text-sm text-slate-500 text-center border-t border-slate-50 dark:border-slate-800/50">
                No locations found.
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}

function SelectionModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  subtitle,
  icon: Icon,
  options,
  currentValue,
  searchPlaceholder,
  emptyText
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (val: string) => void;
  title: string;
  subtitle: string;
  icon: any;
  options: string[];
  currentValue: string;
  searchPlaceholder: string;
  emptyText: string;
}) {
  const [query, setQuery] = useState('');
  const [tempValue, setTempValue] = useState(currentValue);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setTempValue(currentValue);
    }
  }, [isOpen, currentValue]);

  if (!isOpen) return null;

  const filtered = options.filter(o => o.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
      <div 
        className="bg-white dark:bg-slate-900 w-full max-w-sm max-h-[85vh] flex flex-col rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-200 dark:border-slate-800"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-start justify-between bg-slate-50/50 dark:bg-slate-950/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-purple-600 dark:text-purple-400 shrink-0">
              <Icon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white leading-tight">{title}</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{subtitle}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 border-b border-slate-100 dark:border-slate-800">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              autoFocus
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl pl-9 pr-4 py-2.5 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-shadow"
              placeholder={searchPlaceholder}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="overflow-y-auto p-2 custom-scrollbar flex-1 min-h-[150px]">
          {filtered.length > 0 ? (
            <div className="space-y-1">
              {filtered.map(opt => {
                const isSelected = tempValue === opt;
                return (
                  <button
                    key={opt}
                    onClick={() => setTempValue(opt)}
                    className={`w-full flex items-center justify-between p-3 rounded-xl transition-all ${
                      isSelected 
                        ? 'bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800' 
                        : 'bg-transparent border border-transparent hover:bg-slate-50 dark:hover:bg-slate-800/50'
                    }`}
                  >
                    <span className={`text-sm ${isSelected ? 'text-purple-700 dark:text-purple-300 font-bold' : 'text-slate-700 dark:text-slate-300 font-medium'}`}>
                      {opt}
                    </span>
                    <div className={`w-5 h-5 rounded-full border-[1.5px] flex items-center justify-center transition-colors ${
                      isSelected 
                        ? 'border-purple-500' 
                        : 'border-slate-300 dark:border-slate-600'
                    }`}>
                      {isSelected && <div className="w-2.5 h-2.5 rounded-full bg-purple-500" />}
                    </div>
                  </button>
                )
              })}
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-sm text-slate-500 dark:text-slate-400 py-8">
              {emptyText}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 flex gap-3">
          <button 
            onClick={onClose}
            className="flex-1 px-4 py-2.5 text-sm font-bold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50 rounded-xl transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={() => {
              if (tempValue) {
                onConfirm(tempValue);
                onClose();
              }
            }}
            disabled={!tempValue}
            className="flex-1 px-4 py-2.5 text-sm font-bold text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:hover:bg-purple-600 rounded-xl shadow-sm transition-colors"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}

export function Settings() {
  const { batch, section, weatherLocation, setBatch, setSection, setWeatherLocation, clearPreferences } = usePreferences();
  const { theme, setTheme } = useTheme();
  const { options, loading, customCourses, refreshCustomCourses, setSelectedVersionId } = useAppContext();
  
  const [showSaved, setShowSaved] = useState(false);
  const mounted = useRef(false);
  const [showClearModal, setShowClearModal] = useState(false);

  // Course Catalog state
  const [courseCode, setCourseCode] = useState('');
  const [courseName, setCourseName] = useState('');
  const [editingCourse, setEditingCourse] = useState<string | null>(null);
  const [savingCourse, setSavingCourse] = useState(false);

  // Routine Update State
  const [updateStatus, setUpdateStatus] = useState<'idle' | 'checking' | 'up-to-date' | 'update-available' | 'error' | 'success'>('idle');
  const [downloadedRoutine, setDownloadedRoutine] = useState<any>(null);
  const [updating, setUpdating] = useState(false);
  const [updateError, setUpdateError] = useState('');

  const [showBatchModal, setShowBatchModal] = useState(false);
  const [showSectionModal, setShowSectionModal] = useState(false);

  const handleCheckUpdate = async () => {
    setUpdateStatus('checking');
    setUpdateError('');
    try {
      const timestamp = new Date().getTime();
      const res = await fetch(`https://raw.githubusercontent.com/arik-sadman313/diu-routine-data/main/latest.json?t=${timestamp}`, {
        cache: 'no-store',
      });
      if (!res.ok) {
        throw new Error('Could not check for routine updates. Your current routine is still available.');
      }
      const data = await res.json();
      
      if (data.format !== 'diu-routine-v1' || !Array.isArray(data.classes)) {
        throw new Error('The downloaded routine is invalid and was not imported.');
      }
      
      const isDuplicate = await api.checkDuplicateJson(data);
      if (isDuplicate) {
        setUpdateStatus('up-to-date');
      } else {
        setDownloadedRoutine(data);
        setUpdateStatus('update-available');
      }
    } catch (e: any) {
      if (e.message === 'Failed to fetch' || e.name === 'TypeError') {
        setUpdateError('Unable to check for updates. Please check your internet connection.');
      } else {
        setUpdateError(e.message || 'Error checking for updates.');
      }
      setUpdateStatus('error');
    }
  };

  const handlePerformUpdate = async () => {
    if (!downloadedRoutine) return;
    setUpdating(true);
    try {
      const res = await api.importJson(downloadedRoutine);
      if (res.version_id) {
        setSelectedVersionId(res.version_id);
      }
      setUpdateStatus('success');
    } catch (e: any) {
      alert(`Update failed: ${e.message}`);
      setUpdateStatus('error');
    } finally {
      setUpdating(false);
    }
  };

  const handleAddCourse = async () => {
    const code = courseCode.trim().toUpperCase();
    const name = courseName.trim();
    if (!code || !name) {
      alert("Course code and name cannot be empty.");
      return;
    }
    if (!editingCourse && customCourses.some(c => c.course_code === code)) {
      alert("This course code already exists.");
      return;
    }

    setSavingCourse(true);
    try {
      await api.addCustomCourse({ course_code: code, course_name: name });
      await refreshCustomCourses();
      setCourseCode('');
      setCourseName('');
      setEditingCourse(null);
    } catch (err: any) {
      alert(`Failed to save course: ${err.message}`);
    } finally {
      setSavingCourse(false);
    }
  };

  const handleDeleteCourse = async (code: string, name: string) => {
    if (!window.confirm(`Delete Course?\n\n${code}\n${name}\n\nThis will remove the custom course name from your catalog.`)) {
      return;
    }
    try {
      await api.deleteCustomCourse(code);
      await refreshCustomCourses();
    } catch (err: any) {
      alert(`Failed to delete course: ${err.message}`);
    }
  };

  // Derived available sections based on selected batch
  const availableSections = options?.batch_sections
    .filter(bs => bs.batch === batch)
    .map(bs => bs.section)
    .sort() || [];

  // Reset section if it becomes invalid for the new batch
  useEffect(() => {
    if (batch && section && availableSections.length > 0) {
      if (!availableSections.includes(section)) {
        setSection(availableSections[0] || '');
      }
    }
  }, [batch, availableSections, section, setSection]);

  // Auto-save feedback
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    setShowSaved(true);
    const t = setTimeout(() => setShowSaved(false), 2000);
    return () => clearTimeout(t);
  }, [batch, section, weatherLocation, theme]);

  const handleClear = () => {
    clearPreferences();
    setShowClearModal(false);
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-in fade-in duration-300 pb-10">
      {/* Header */}
      <div className="page-header">
        <div className="page-header-content">
          <div className="page-header-icon">
            <SettingsIcon />
          </div>
          <div className="page-header-text">
            <h2>Settings</h2>
            <p>Preferences are saved automatically.</p>
          </div>
        </div>
        
        {/* Saved Feedback */}
        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 text-xs font-bold transition-opacity duration-300 ${showSaved ? 'opacity-100' : 'opacity-0'}`}>
          <CheckCircle2 className="w-3.5 h-3.5" /> Saved
        </div>
      </div>

      <div className="space-y-6">
        
        {/* Routine Update Status */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5 md:p-6">
          <div className="flex items-center gap-3 mb-5">
            <BookOpen className="w-5 h-5 text-purple-500" />
            <div>
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Routine</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Current Routine: {options ? `Version ${options.version_id}` : 'None'}</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
            <div>
              <div className="text-sm font-bold text-slate-700 dark:text-slate-300">Routine Status</div>
              <div className="text-xs mt-1">
                {updateStatus === 'idle' && <span className="text-slate-500">Not checked recently</span>}
                {updateStatus === 'checking' && <span className="text-slate-500 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin"/> Checking GitHub...</span>}
                {updateStatus === 'up-to-date' && <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1"><CheckCircle2 className="w-3 h-3"/> Up to date</span>}
                {updateStatus === 'success' && <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1"><CheckCircle2 className="w-3 h-3"/> Routine updated successfully. {downloadedRoutine?.semester || 'The new routine'} is now available.</span>}
                {updateStatus === 'update-available' && <span className="text-purple-600 dark:text-purple-400 font-bold flex items-center gap-1">↑ Update available: {downloadedRoutine?.semester || 'New Routine'}</span>}
                {updateStatus === 'error' && <span className="text-red-500">{updateError}</span>}
              </div>
            </div>

            {updateStatus === 'update-available' ? (
              <div className="flex gap-2 w-full sm:w-auto">
                <button onClick={() => setUpdateStatus('idle')} className="px-4 py-2 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-sm font-bold rounded-lg transition-colors flex-1 sm:flex-none">Later</button>
                <button onClick={handlePerformUpdate} disabled={updating} className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-bold rounded-lg transition-colors flex-1 sm:flex-none flex items-center justify-center gap-2">
                  {updating && <Loader2 className="w-4 h-4 animate-spin"/>}
                  Update Routine
                </button>
              </div>
            ) : (
              <button 
                onClick={handleCheckUpdate} 
                disabled={updateStatus === 'checking'}
                className="w-full sm:w-auto px-4 py-2 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-sm font-bold rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {updateStatus === 'checking' && <Loader2 className="w-4 h-4 animate-spin"/>}
                Check for Routine Updates
              </button>
            )}
          </div>
        </div>
        
        {/* Profile Settings */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5 md:p-6">
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-5">My Routine Profile</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">
            <div className="space-y-1.5">
              <label className="block text-sm font-bold text-slate-700 dark:text-slate-300">
                Default Batch
              </label>
              <button
                onClick={() => setShowBatchModal(true)}
                disabled={loading || !options}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5 text-slate-800 dark:text-slate-200 font-medium focus:outline-none focus:ring-2 focus:ring-purple-500/50 disabled:opacity-50 text-sm transition-shadow flex items-center justify-between text-left"
              >
                <span>{batch || 'Select Batch...'}</span>
                <ChevronDown className="w-4 h-4 text-slate-400" />
              </button>
              <p className="text-xs text-slate-400 dark:text-slate-500">Used as the default batch when opening Explore.</p>
            </div>

            <div className="space-y-1.5">
              <label className="block text-sm font-bold text-slate-700 dark:text-slate-300">
                Default Section
              </label>
              <button
                onClick={() => setShowSectionModal(true)}
                disabled={!batch || loading || availableSections.length === 0}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5 text-slate-800 dark:text-slate-200 font-medium focus:outline-none focus:ring-2 focus:ring-purple-500/50 disabled:opacity-50 text-sm transition-shadow flex items-center justify-between text-left"
              >
                <span>{section || 'Select Section...'}</span>
                <ChevronDown className="w-4 h-4 text-slate-400" />
              </button>
              <p className="text-xs text-slate-400 dark:text-slate-500">Used as the default section when opening Explore.</p>
            </div>
            
            <div className="space-y-1.5 md:col-span-2">
              <label className="block text-sm font-bold text-slate-700 dark:text-slate-300">
                Weather Location
              </label>
              <LocationSearch value={weatherLocation} onChange={setWeatherLocation} />
              <p className="text-xs text-slate-400 dark:text-slate-500">Search for any city globally or use your device's location.</p>
            </div>
          </div>
        </div>

        {/* Theme Settings */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5 md:p-6">
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-5">Appearance</h3>
          
          <div className="grid grid-cols-3 gap-3">
            <button
              onClick={() => setTheme('light')}
              className={`flex flex-col items-center justify-center gap-3 p-5 rounded-xl border-2 transition-all ${
                theme === 'light' 
                  ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 shadow-sm' 
                  : 'border-slate-100 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:border-purple-200 dark:hover:border-purple-800 hover:bg-purple-50/50 dark:hover:bg-purple-900/10'
              }`}
            >
              <Sun className={`w-6 h-6 ${theme === 'light' ? 'fill-purple-200 dark:fill-purple-800' : ''}`} />
              <span className="font-bold text-sm">Light</span>
            </button>
            
            <button
              onClick={() => setTheme('dark')}
              className={`flex flex-col items-center justify-center gap-3 p-5 rounded-xl border-2 transition-all ${
                theme === 'dark' 
                  ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 shadow-sm' 
                  : 'border-slate-100 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:border-purple-200 dark:hover:border-purple-800 hover:bg-purple-50/50 dark:hover:bg-purple-900/10'
              }`}
            >
              <Moon className={`w-6 h-6 ${theme === 'dark' ? 'fill-purple-200 dark:fill-purple-800' : ''}`} />
              <span className="font-bold text-sm">Dark</span>
            </button>

            <button
              onClick={() => setTheme('system')}
              className={`flex flex-col items-center justify-center gap-3 p-5 rounded-xl border-2 transition-all ${
                theme === 'system' 
                  ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 shadow-sm' 
                  : 'border-slate-100 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:border-purple-200 dark:hover:border-purple-800 hover:bg-purple-50/50 dark:hover:bg-purple-900/10'
              }`}
            >
              <Monitor className="w-6 h-6" />
              <span className="font-bold text-sm">System</span>
            </button>
          </div>
        </div>
        
        {/* Course Catalog Settings */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5 md:p-6">
          <div className="flex items-center gap-3 mb-5">
            <BookOpen className="w-5 h-5 text-purple-500" />
            <div>
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Course Catalog</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Manage course codes and subject names</p>
            </div>
          </div>
          
          <div className="flex flex-col md:flex-row gap-3 mb-6 bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
            <div className="flex-1 space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Course Code</label>
              <input
                type="text"
                placeholder="e.g. CSE450"
                value={courseCode}
                onChange={(e) => setCourseCode(e.target.value.toUpperCase())}
                disabled={savingCourse || !!editingCourse}
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50 disabled:opacity-50 uppercase"
              />
            </div>
            <div className="flex-[2] space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Course Name</label>
              <input
                type="text"
                placeholder="e.g. Advanced Computer Vision"
                value={courseName}
                onChange={(e) => setCourseName(e.target.value)}
                disabled={savingCourse}
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50 disabled:opacity-50"
              />
            </div>
            <div className="flex items-end pb-0.5">
              <button
                onClick={handleAddCourse}
                disabled={savingCourse}
                className="w-full md:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-bold rounded-lg transition-colors shadow-sm disabled:opacity-50"
              >
                {savingCourse ? <Loader2 className="w-4 h-4 animate-spin" /> : (editingCourse ? <CheckCircle2 className="w-4 h-4" /> : <Plus className="w-4 h-4" />)}
                {editingCourse ? 'Save' : 'Add Course'}
              </button>
              {editingCourse && (
                <button
                  onClick={() => { setEditingCourse(null); setCourseCode(''); setCourseName(''); }}
                  disabled={savingCourse}
                  className="ml-2 px-3 py-2 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-sm font-bold rounded-lg transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
              )}
            </div>
          </div>

          {customCourses.length > 0 ? (
            <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar pr-2">
              {customCourses.map(c => (
                <div key={c.course_code} className="flex items-center justify-between p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                  <div>
                    <div className="font-bold text-sm text-slate-800 dark:text-slate-200">{c.course_code}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">{c.course_name}</div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => {
                        setEditingCourse(c.course_code);
                        setCourseCode(c.course_code);
                        setCourseName(c.course_name);
                      }}
                      className="p-2 text-slate-400 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-lg transition-colors"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteCourse(c.course_code, c.course_name)}
                      className="p-2 text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6 text-slate-500 dark:text-slate-400 text-sm border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
              No custom courses added.
            </div>
          )}
        </div>
        
        {/* Danger Zone */}
        <div className="flex justify-end pt-4">
          <button 
            onClick={() => setShowClearModal(true)}
            className="text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300 text-sm font-bold flex items-center gap-2 px-4 py-2.5 bg-red-50 dark:bg-red-900/10 hover:bg-red-100 dark:hover:bg-red-900/20 border border-red-100 dark:border-red-900/30 rounded-xl transition-colors"
          >
            <Trash2 className="w-4 h-4" /> Clear saved preferences
          </button>
        </div>

      </div>

      {/* Clear Preferences Modal */}
      {showClearModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setShowClearModal(false)}>
          <div 
            className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-2xl shadow-2xl p-6 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mb-4 text-red-600 dark:text-red-400">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Clear Preferences?</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">
              Are you sure you want to completely reset your personal preferences? Your routine and planner data will <strong>not</strong> be affected.
            </p>
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setShowClearModal(false)}
                className="px-4 py-2.5 text-sm font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleClear}
                className="px-4 py-2.5 text-sm font-bold text-white bg-red-500 hover:bg-red-600 rounded-xl shadow-sm shadow-red-500/20 transition-all"
              >
                Clear Preferences
              </button>
            </div>
          </div>
        </div>
      )}

      <SelectionModal
        isOpen={showBatchModal}
        onClose={() => setShowBatchModal(false)}
        onConfirm={setBatch}
        title="Select Batch"
        subtitle="Choose your batch"
        icon={GraduationCap}
        options={options?.batches || []}
        currentValue={batch}
        searchPlaceholder="Search batch..."
        emptyText="No batches found"
      />

      <SelectionModal
        isOpen={showSectionModal}
        onClose={() => setShowSectionModal(false)}
        onConfirm={setSection}
        title="Select Section"
        subtitle="Choose your section"
        icon={Users}
        options={availableSections}
        currentValue={section}
        searchPlaceholder="Search section..."
        emptyText="No sections found"
      />
    </div>
  );
}
