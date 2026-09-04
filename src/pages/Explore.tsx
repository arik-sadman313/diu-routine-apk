import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../services/api';
import { usePreferences } from '../hooks/usePreferences';
import { useAppContext } from '../context/AppContext';
import type { ClassRecord } from '../types/api';
import { Timetable } from '../components/Timetable';
import { ClassEditorModal } from '../components/ClassEditorModal';
import { Search, LayoutGrid, List, Compass, Loader2, Eye, Plus, ChevronDown, GraduationCap, Users, Layout } from 'lucide-react';
import { SelectionModal } from '../components/SelectionModal';
export function Explore() {
  const { selectedVersion, options, loading: optionsLoading } = useAppContext();
  const versionId = selectedVersion?.id;
  const prefs = usePreferences();
  const [searchParams] = useSearchParams();
  
  const [selectedBatch, setSelectedBatch] = useState<string>(() => searchParams.get('batch') || prefs.batch || '');
  const [selectedSection, setSelectedSection] = useState<string>(() => searchParams.get('section') || prefs.section || '');
  
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [showSectionModal, setShowSectionModal] = useState(false);
  const [showGroupModal, setShowGroupModal] = useState(false);

  // Sync with URL params if user navigates here with them explicitly while already mounted
  useEffect(() => {
    const urlBatch = searchParams.get('batch');
    const urlSection = searchParams.get('section');
    if (urlBatch) setSelectedBatch(urlBatch);
    if (urlSection) setSelectedSection(urlSection);
  }, [searchParams]);
  
  const [classes, setClasses] = useState<ClassRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [selectedGroup, setSelectedGroup] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [viewMode, setViewMode] = useState<'week'|'list'>('week');
  
  const [showHidden, setShowHidden] = useState(false);
  const [isAddingClass, setIsAddingClass] = useState(false);

  // Derived available sections based on selected batch
  const availableSections = options?.batch_sections
    .filter(bs => bs.batch === selectedBatch)
    .map(bs => bs.section)
    .sort() || [];

  // Reset section if it becomes invalid for the new batch
  useEffect(() => {
    if (selectedBatch && selectedSection && availableSections.length > 0) {
      if (!availableSections.includes(selectedSection)) {
        setSelectedSection(availableSections[0] || '');
      }
    }
  }, [selectedBatch, availableSections, selectedSection]);

  const loadRoutine = async () => {
    if (!selectedBatch || !selectedSection || !versionId) {
      setClasses([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await api.getRoutine(selectedBatch, selectedSection, versionId);
      setClasses(data.classes);
    } catch (err: any) {
      setError(err.message || 'Failed to load routine');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRoutine();
  }, [selectedBatch, selectedSection, versionId]);

  const hasSelection = selectedBatch && selectedSection;

  // Filter classes locally
  const filteredClasses = classes.filter(c => {
    if (selectedGroup && c.group_code !== selectedGroup) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchCourse = c.course_code.toLowerCase().includes(q);
      const matchTeacher = (c.teacher || '').toLowerCase().includes(q);
      const matchRoom = c.room.toLowerCase().includes(q);
      if (!matchCourse && !matchTeacher && !matchRoom) return false;
    }
    return true;
  });

  // Unique groups for the loaded classes
  const uniqueGroups = Array.from(new Set(classes.map(c => c.group_code))).filter(Boolean).sort();

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-in fade-in duration-300 pb-10">
      {/* Header */}
      <div className="page-header">
        <div className="page-header-content">
          <div className="page-header-icon">
            <Compass />
          </div>
          <div className="page-header-text">
            <h2>Explore Routine</h2>
            <p>Browse the routine for any batch and section.</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-slate-900 p-5 md:p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="flex flex-col sm:flex-row gap-3 flex-1">
            <div className="flex-1">
              <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                Batch
              </label>
              <button
                onClick={() => setShowBatchModal(true)}
                disabled={optionsLoading || !options}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500/50 disabled:opacity-50 text-sm font-medium flex items-center justify-between text-left"
              >
                <span>{selectedBatch || 'Select…'}</span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>
            </div>

            <div className="flex-1">
              <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                Section
              </label>
              <button
                onClick={() => setShowSectionModal(true)}
                disabled={!selectedBatch || optionsLoading || availableSections.length === 0}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500/50 disabled:opacity-50 text-sm font-medium flex items-center justify-between text-left"
              >
                <span>{selectedSection || 'Select…'}</span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>
            </div>
            
            <div className="flex-1">
              <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                Group
              </label>
              <button
                onClick={() => setShowGroupModal(true)}
                disabled={!hasSelection || uniqueGroups.length === 0}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500/50 disabled:opacity-50 text-sm font-medium flex items-center justify-between text-left"
              >
                <span>{selectedGroup || 'All Groups'}</span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>
            </div>
          </div>

          <div className="flex-1 min-w-[200px]">
             <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                Search
             </label>
             <div className="relative">
               <Search className="w-4 h-4 absolute left-2.5 top-2 text-slate-400" />
               <input
                 type="text"
                 placeholder="Course, teacher, room..."
                 value={searchQuery}
                 onChange={(e) => setSearchQuery(e.target.value)}
                 disabled={!hasSelection}
                 className="w-full pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500/50 disabled:opacity-50 font-medium"
               />
             </div>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 px-4 py-3 rounded-xl border border-red-200 dark:border-red-800/50 text-sm font-medium">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex justify-center py-12">
          <Loader2 className="w-7 h-7 animate-spin text-purple-500" />
        </div>
      )}

      {/* Empty prompt */}
      {!loading && !hasSelection && (
        <div className="text-center py-16">
          <div className="text-4xl mb-3">🔭</div>
          <p className="text-slate-500 dark:text-slate-400 font-medium">Select a batch and section to view the routine.</p>
        </div>
      )}

      {/* Results */}
      {!loading && hasSelection && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50/70 dark:bg-slate-800/30 flex-wrap gap-3">
            <div className="flex items-center gap-2 bg-slate-200/50 dark:bg-slate-800 p-1 rounded-lg">
              <button 
                onClick={() => setViewMode('week')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${viewMode === 'week' ? 'bg-white dark:bg-slate-700 text-purple-700 dark:text-purple-400 shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'}`}
              >
                <LayoutGrid className="w-3.5 h-3.5" /> Week
              </button>
              <button 
                onClick={() => setViewMode('list')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${viewMode === 'list' ? 'bg-white dark:bg-slate-700 text-purple-700 dark:text-purple-400 shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'}`}
              >
                <List className="w-3.5 h-3.5" /> List
              </button>
            </div>
            
            <div className="flex items-center gap-2.5">
              <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400 cursor-pointer hover:text-slate-900 dark:hover:text-slate-200 transition-colors select-none">
                <input 
                  type="checkbox" 
                  checked={showHidden} 
                  onChange={(e) => setShowHidden(e.target.checked)}
                  className="rounded text-purple-600 focus:ring-purple-500 bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700 w-3.5 h-3.5"
                />
                <Eye className="w-3.5 h-3.5" />
                Show Hidden
              </label>
              <button 
                onClick={() => setIsAddingClass(true)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg font-semibold text-xs transition-colors"
                title="Add Class"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          <div className="p-0 sm:p-4">
            <Timetable classes={filteredClasses} showHidden={showHidden} onRefresh={loadRoutine} viewMode={viewMode} />
          </div>
        </div>
      )}

      {isAddingClass && (
        <ClassEditorModal
          mode="add"
          initialData={null}
          onClose={() => setIsAddingClass(false)}
          onSaved={() => {
            setIsAddingClass(false);
            loadRoutine();
          }}
        />
      )}

      <SelectionModal
        isOpen={showBatchModal}
        onClose={() => setShowBatchModal(false)}
        onConfirm={(val) => {
          setSelectedBatch(val);
          setSelectedGroup('');
        }}
        title="Select Batch"
        subtitle="Choose your batch"
        icon={GraduationCap}
        options={options?.batches || []}
        currentValue={selectedBatch}
        searchPlaceholder="Search batch..."
        emptyText="No batches found"
      />

      <SelectionModal
        isOpen={showSectionModal}
        onClose={() => setShowSectionModal(false)}
        onConfirm={(val) => {
          setSelectedSection(val);
          setSelectedGroup('');
        }}
        title="Select Section"
        subtitle="Choose your section"
        icon={Users}
        options={availableSections}
        currentValue={selectedSection}
        searchPlaceholder="Search section..."
        emptyText="No sections found"
      />

      <SelectionModal
        isOpen={showGroupModal}
        onClose={() => setShowGroupModal(false)}
        onConfirm={setSelectedGroup}
        title="Select Group"
        subtitle="Choose your group"
        icon={Layout}
        options={['', ...uniqueGroups]} // Include empty option for "All Groups"
        currentValue={selectedGroup}
        searchPlaceholder="Search group..."
        emptyText="No groups found"
      />
    </div>
  );
}
