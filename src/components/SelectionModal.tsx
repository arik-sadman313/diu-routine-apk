import { useState, useEffect, useRef } from 'react';
import { Search, X } from 'lucide-react';

export function SelectionModal({
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
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setTempValue(currentValue);
    }
  }, [isOpen, currentValue]);

  // Clear focus on unmount to prevent keyboard from staying open
  useEffect(() => {
    // Focus the non-interactive container on mount to override WebView auto-focus
    if (isOpen) {
      setTimeout(() => {
        containerRef.current?.focus();
      }, 10);
    }

    console.log('[DIAGNOSTIC] SelectionModal mounted.');
    const handleFocus = (e: FocusEvent) => {
      console.log('[DIAGNOSTIC] SelectionModal focus event:', e.target);
    };
    window.addEventListener('focus', handleFocus, true);
    
    return () => {
      console.log('[DIAGNOSTIC] SelectionModal unmounting.');
      window.removeEventListener('focus', handleFocus, true);
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
    };
  }, []);

  if (!isOpen) return null;

  const filtered = options.filter(o => o.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
      <div 
        ref={containerRef}
        tabIndex={-1}
        className="bg-white dark:bg-slate-900 w-full max-w-sm max-h-[85vh] flex flex-col rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-200 dark:border-slate-800 focus:outline-none"
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
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl pl-9 pr-4 py-2.5 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-shadow"
              placeholder={searchPlaceholder}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={(e) => {
                console.log('[DIAGNOSTIC] SelectionModal input focused! Event:', e.type);
                console.trace('[DIAGNOSTIC] SelectionModal Focus Stack Trace');
              }}
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
