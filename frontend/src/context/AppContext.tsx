import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { api } from '../services/api';
import type { RoutineVersion, OptionsResponse } from '../types/api';
import { usePreferences } from '../hooks/usePreferences';
import { Loader2 } from 'lucide-react';

interface AppContextType {
  versions: RoutineVersion[];
  selectedVersion: RoutineVersion | null;
  setSelectedVersionId: (id: number) => void;
  options: OptionsResponse | null;
  refreshOptions: () => Promise<void>;
  loading: boolean;
  error: string | null;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [versions, setVersions] = useState<RoutineVersion[]>([]);
  const [selectedVersionId, setSelectedVersionIdState] = useState<number | null>(null);
  const [options, setOptions] = useState<OptionsResponse | null>(null);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { batch, section, setSection, setBatch } = usePreferences();

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const versionsData = await api.getVersions();
      setVersions(versionsData.versions);
      
      let targetVersionId = selectedVersionId;
      if (!targetVersionId && versionsData.versions.length > 0) {
        targetVersionId = versionsData.versions[0].id;
        setSelectedVersionIdState(targetVersionId);
      }

      if (targetVersionId) {
        const opts = await api.getOptions(targetVersionId);
        setOptions(opts);

        // Validate current default batch/section
        if (batch) {
          const batchExists = opts.batches.includes(batch);
          if (batchExists && section) {
            const validSection = opts.batch_sections.some(bs => bs.batch === batch && bs.section === section);
            if (!validSection) {
              // Section invalid for this batch, reset it
              const firstValidSection = opts.batch_sections.find(bs => bs.batch === batch)?.section || '';
              setSection(firstValidSection);
            }
          } else if (!batchExists) {
            // Batch is completely invalid for this version, reset both
            setBatch('');
            setSection('');
          }
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to initialize app data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedVersionId]); // Reload options if version changes

  const setSelectedVersionId = (id: number) => {
    setSelectedVersionIdState(id);
  };

  const selectedVersion = versions.find(v => v.id === selectedVersionId) || null;

  return (
    <AppContext.Provider value={{
      versions,
      selectedVersion,
      setSelectedVersionId,
      options,
      refreshOptions: loadData,
      loading,
      error
    }}>
      {loading ? (
        <div className="flex h-screen w-full items-center justify-center bg-slate-50 dark:bg-slate-950">
          <div className="flex flex-col items-center gap-4 text-purple-500">
            <Loader2 className="w-12 h-12 animate-spin" />
            <span className="font-semibold text-slate-700 dark:text-slate-300">Loading DIU Routine...</span>
          </div>
        </div>
      ) : error ? (
        <div className="flex h-screen w-full items-center justify-center bg-slate-50 dark:bg-slate-950">
          <div className="bg-red-50 text-red-600 p-6 rounded-2xl border border-red-200 text-center max-w-md">
            <h2 className="font-bold text-xl mb-2">Startup Error</h2>
            <p>{error}</p>
            <button onClick={loadData} className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg">Retry</button>
          </div>
        </div>
      ) : (
        children
      )}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
}
