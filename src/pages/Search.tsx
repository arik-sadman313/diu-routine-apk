import { useState, useEffect, useMemo, useRef } from 'react';
import { api } from '../services/api';
import type { ClassRecord } from '../types/api';
import { useAppContext } from '../context/AppContext';
import { Search as SearchIcon, Loader2, X, MapPin, Users, User, BookOpen } from 'lucide-react';
import { ClassDetailModal } from '../components/ClassDetailModal';
import { BUILTIN_COURSES } from '../data/builtinCourses';

const DAY_ORDER: Record<string, number> = {
  'Saturday': 0,
  'Sunday': 1,
  'Monday': 2,
  'Tuesday': 3,
  'Wednesday': 4,
  'Thursday': 5,
  'Friday': 6,
};

const sortClasses = (a: ClassRecord, b: ClassRecord) => {
  const d1 = DAY_ORDER[a.day] ?? 99;
  const d2 = DAY_ORDER[b.day] ?? 99;
  if (d1 !== d2) return d1 - d2;
  if (a.start_time !== b.start_time) return a.start_time.localeCompare(b.start_time);
  if (a.course_code !== b.course_code) return a.course_code.localeCompare(b.course_code);
  return (a.group_code || '').localeCompare(b.group_code || '');
};

const HighlightText = ({ text, highlight }: { text: string; highlight: string }) => {
  if (!text) return null;
  if (!highlight.trim()) return <>{text}</>;
  
  const regex = new RegExp(`(${highlight})`, 'gi');
  const parts = text.split(regex);
  
  return (
    <>
      {parts.map((part, i) => 
        part.toLowerCase() === highlight.toLowerCase() ? (
          <b key={i} className="text-purple-600 dark:text-purple-400 font-extrabold">{part}</b>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
};

export function Search() {
  const { selectedVersion, getCourseName, customCourses } = useAppContext();
  const versionId = selectedVersion?.id;
  
  const [query, setQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'course' | 'teacher' | 'room' | 'group'>('all');
  
  const [results, setResults] = useState<ClassRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [selectedClass, setSelectedClass] = useState<ClassRecord | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Clear focus on unmount to prevent keyboard from staying open
  useEffect(() => {
    // Focus the non-interactive container immediately to override WebView auto-focus
    containerRef.current?.focus();
    
    console.log('[DIAGNOSTIC] Search page mounted. Current active element:', document.activeElement?.tagName);
    
    const handleFocus = (e: FocusEvent) => {
      console.log('[DIAGNOSTIC] Window focus event fired:', e.target);
    };
    window.addEventListener('focus', handleFocus, true);
    
    return () => {
      console.log('[DIAGNOSTIC] Search page unmounting.');
      window.removeEventListener('focus', handleFocus, true);
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
    };
  }, []);

  // Keyboard shortcut to clear
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setQuery('');
        inputRef.current?.blur();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      performSearch();
    }, 300);
    return () => clearTimeout(timer);
  }, [query, versionId]); // Re-search automatically when version changes

  const performSearch = async () => {
    if (!query.trim()) {
      setResults([]);
      setSearched(false);
      return;
    }

    if (!versionId) return;

    setLoading(true);
    setSearched(true);
    
    try {
      const data = await api.search(query.trim(), versionId);
      setResults(data.classes);
    } catch (err) {
      console.error(err);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const matchedCourses = useMemo(() => {
    if (!query.trim() || (activeFilter !== 'all' && activeFilter !== 'course')) return [];
    const q = query.trim().toLowerCase();
    
    const allCourses = new Map<string, string>();
    Object.entries(BUILTIN_COURSES).forEach(([code, name]) => {
      allCourses.set(code.toUpperCase(), name);
    });
    customCourses.forEach(c => {
      allCourses.set(c.course_code.toUpperCase(), c.course_name);
    });
    
    const matches: { code: string; name: string }[] = [];
    for (const [code, name] of allCourses.entries()) {
      if (code.toLowerCase().includes(q) || name.toLowerCase().includes(q)) {
        matches.push({ code, name });
      }
    }
    
    return matches.sort((a, b) => a.code.localeCompare(b.code));
  }, [query, customCourses, activeFilter]);

  const filteredAndSortedResults = useMemo(() => {
    let filtered = results;
    
    if (activeFilter !== 'all') {
      const q = query.toLowerCase();
      filtered = results.filter(c => {
        if (activeFilter === 'course') return c.course_code.toLowerCase().includes(q);
        if (activeFilter === 'teacher') return c.teacher?.toLowerCase().includes(q);
        if (activeFilter === 'room') return c.room.toLowerCase().includes(q);
        if (activeFilter === 'group') return c.group_code?.toLowerCase().includes(q);
        return true;
      });
    }

    return [...filtered].sort(sortClasses);
  }, [results, activeFilter, query]);

  return (
    <div 
      ref={containerRef}
      tabIndex={-1}
      className="space-y-6 max-w-5xl mx-auto animate-in fade-in duration-300 pb-10 focus:outline-none"
    >
      {/* Header */}
      <div className="page-header">
        <div className="page-header-content">
          <div className="page-header-icon">
            <SearchIcon />
          </div>
          <div className="page-header-text">
            <h2>Search</h2>
            <p>Find courses, teachers, rooms and classes.</p>
          </div>
        </div>
      </div>

      <div className="space-y-3 sticky top-[60px] md:top-0 z-20 bg-slate-50/80 dark:bg-slate-950/80 backdrop-blur-md pt-2 pb-4 -mx-4 px-4 sm:mx-0 sm:px-0">
        <div className="relative group">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <SearchIcon className="h-5 w-5 text-slate-400 group-focus-within:text-purple-500 transition-colors" />
          </div>
          <input
            ref={inputRef}
            type="text"
            className="block w-full pl-12 pr-12 py-4 bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 rounded-2xl text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-purple-500 dark:focus:border-purple-500 shadow-sm transition-all text-base font-medium"
            placeholder="Search courses, teachers, rooms, groups..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={(e) => {
              console.log('[DIAGNOSTIC] Search input focused! Event:', e.type);
              // Log the stack trace to see what triggered it
              console.trace('[DIAGNOSTIC] Focus Stack Trace');
            }}
          />
          {query && (
            <button
              onClick={() => { setQuery(''); }}
              className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
            >
              <div className="bg-slate-100 dark:bg-slate-800 rounded-full p-1">
                <X className="h-4 w-4" />
              </div>
            </button>
          )}
        </div>

        {/* Quick Filters */}
        <div className="flex overflow-x-auto custom-scrollbar pb-2 -mb-2">
          <div className="flex gap-2">
            {[
              { id: 'all', label: 'All' },
              { id: 'course', label: 'Course' },
              { id: 'teacher', label: 'Teacher' },
              { id: 'room', label: 'Room' },
              { id: 'group', label: 'Group' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveFilter(tab.id as any)}
                className={`px-4 py-1.5 rounded-full text-xs font-bold transition-colors whitespace-nowrap ${
                  activeFilter === tab.id
                    ? 'bg-purple-600 text-white shadow-md shadow-purple-500/20'
                    : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="relative min-h-[200px]">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-50/50 dark:bg-slate-950/50 backdrop-blur-sm z-10 rounded-2xl">
            <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
          </div>
        )}

        {!searched && !loading && (
          <div className="text-center py-24 flex flex-col items-center justify-center bg-white/40 dark:bg-slate-900/40 rounded-3xl border border-slate-200/60 dark:border-slate-800/60 mt-4">
            <div className="w-20 h-20 bg-white dark:bg-slate-900 rounded-2xl flex items-center justify-center shadow-sm border border-slate-200 dark:border-slate-800 mb-6 transform -rotate-3">
              <SearchIcon className="w-8 h-8 text-slate-400 dark:text-slate-500" />
            </div>
            <h3 className="font-bold text-xl text-slate-800 dark:text-slate-200 mb-2">Search your routine</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">Find courses, teachers, rooms and groups.</p>
          </div>
        )}

        {searched && !loading && filteredAndSortedResults.length === 0 && matchedCourses.length === 0 && (
          <div className="text-center py-20 flex flex-col items-center justify-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800">
            <div className="text-4xl mb-4">😕</div>
            <h3 className="font-bold text-lg text-slate-800 dark:text-slate-200 mb-1">No results found</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">Try searching for a course code, teacher, room or group.</p>
          </div>
        )}

        {searched && !loading && matchedCourses.length > 0 && (
          <div className="space-y-4 mb-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="flex items-center justify-between text-sm font-semibold text-slate-500 dark:text-slate-400 px-1 border-b border-slate-200 dark:border-slate-800 pb-2">
              <span className="flex items-center gap-1.5 text-purple-600 dark:text-purple-400 font-bold uppercase tracking-wider text-[11px]">
                <BookOpen className="w-4 h-4" /> Course Catalog Matches
              </span>
              <span>{matchedCourses.length} result{matchedCourses.length !== 1 ? 's' : ''}</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {matchedCourses.map(c => (
                <div key={c.code} className="bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800/80 rounded-2xl p-4 flex flex-col shadow-sm">
                  <h3 className="font-bold text-lg text-slate-900 dark:text-white break-words">
                    <HighlightText text={c.code} highlight={query} />
                  </h3>
                  <div className="text-sm text-slate-600 dark:text-slate-400 font-medium mt-1">
                    <HighlightText text={c.name} highlight={query} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {filteredAndSortedResults.length > 0 && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between text-sm font-semibold text-slate-500 dark:text-slate-400 px-1 border-b border-slate-200 dark:border-slate-800 pb-2">
              <span className="font-bold uppercase tracking-wider text-[11px] text-slate-600 dark:text-slate-400">Scheduled Classes</span>
              <span>{filteredAndSortedResults.length} result{filteredAndSortedResults.length !== 1 ? 's' : ''}</span>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredAndSortedResults.map((c) => (
                <div
                  key={c.id}
                  onClick={() => setSelectedClass(c)}
                  className="group bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-purple-300 dark:hover:border-purple-700/50 rounded-2xl p-4 cursor-pointer transition-all shadow-sm hover:shadow-md"
                >
                  <div className="flex justify-between items-start mb-2 gap-2">
                    <div>
                      <h3 className="font-bold text-lg text-slate-900 dark:text-white break-words overflow-hidden">
                        <HighlightText text={c.course_code} highlight={query} />
                      </h3>
                      {getCourseName(c.course_code) && (
                        <div className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                          <HighlightText text={getCourseName(c.course_code)!} highlight={query} />
                        </div>
                      )}
                    </div>
                    <div className="text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-2 py-1 rounded-md">
                      <HighlightText text={c.day} highlight={query} />
                    </div>
                  </div>
                  
                  <div className="text-sm text-slate-600 dark:text-slate-400 font-medium mb-3">
                    <HighlightText text={c.start_time} highlight={query} /> – <HighlightText text={c.end_time} highlight={query} />
                  </div>
                  
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
                    {c.group_code ? (
                      <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                        <Users className="w-3.5 h-3.5 text-slate-400" />
                        <span className="font-medium"><HighlightText text={c.group_code} highlight={query} /> {c.teacher && <>· <HighlightText text={c.teacher} highlight={query} /></>}</span>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                          <Users className="w-3.5 h-3.5 text-slate-400" />
                          <span className="font-medium"><HighlightText text={`${c.batch} / ${c.section}`} highlight={query} /></span>
                        </div>
                        {c.teacher && (
                          <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                            <User className="w-3.5 h-3.5 text-slate-400" />
                            <span className="font-medium"><HighlightText text={c.teacher} highlight={query} /></span>
                          </div>
                        )}
                      </>
                    )}
                    
                    <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" />
                      <span className="font-medium"><HighlightText text={c.room} highlight={query} /></span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <ClassDetailModal classRecord={selectedClass} onClose={() => setSelectedClass(null)} />
    </div>
  );
}
