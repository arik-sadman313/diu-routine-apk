import { useEffect, useState, useRef, useMemo } from 'react';
import { usePreferences } from '../hooks/usePreferences';
import { useTheme } from '../hooks/useTheme';
import { useAppContext } from '../context/AppContext';
import { Settings as SettingsIcon, Moon, Sun, Monitor, Trash2, MapPin, Navigation, Loader2, CheckCircle2 } from 'lucide-react';

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

export function Settings() {
  const { batch, section, weatherLocation, setBatch, setSection, setWeatherLocation, clearPreferences } = usePreferences();
  const { theme, setTheme } = useTheme();
  const { options, loading } = useAppContext();
  
  const [showSaved, setShowSaved] = useState(false);
  const mounted = useRef(false);
  const [showClearModal, setShowClearModal] = useState(false);

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
        
        {/* Profile Settings */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5 md:p-6">
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-5">My Routine Profile</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">
            <div className="space-y-1.5">
              <label className="block text-sm font-bold text-slate-700 dark:text-slate-300">
                Default Batch
              </label>
              <select
                value={batch}
                onChange={(e) => { setBatch(e.target.value); }}
                disabled={loading || !options}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5 text-slate-800 dark:text-slate-200 font-medium focus:outline-none focus:ring-2 focus:ring-purple-500/50 appearance-none disabled:opacity-50 text-sm transition-shadow"
              >
                <option value="">Select Batch...</option>
                {options?.batches.map(b => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
              <p className="text-xs text-slate-400 dark:text-slate-500">Used as the default batch when opening Explore.</p>
            </div>

            <div className="space-y-1.5">
              <label className="block text-sm font-bold text-slate-700 dark:text-slate-300">
                Default Section
              </label>
              <select
                value={section}
                onChange={(e) => setSection(e.target.value)}
                disabled={!batch || loading || availableSections.length === 0}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5 text-slate-800 dark:text-slate-200 font-medium focus:outline-none focus:ring-2 focus:ring-purple-500/50 appearance-none disabled:opacity-50 text-sm transition-shadow"
              >
                <option value="">Select Section...</option>
                {availableSections.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
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
    </div>
  );
}
