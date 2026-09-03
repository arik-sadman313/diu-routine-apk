import { useState } from 'react';
import { api } from '../services/api';
import type { UploadResponse } from '../types/api';
import { useAppContext } from '../context/AppContext';
import { Upload as UploadIcon, FileUp, AlertTriangle, CheckCircle, Info, Loader2, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function Upload() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<UploadResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorStatus, setErrorStatus] = useState<number | null>(null);
  const [errorData, setErrorData] = useState<any>(null);
  const [corrections, setCorrections] = useState<any[]>([]);
  const [confirming, setConfirming] = useState(false);

  const { refreshOptions, setSelectedVersionId } = useAppContext();
  const navigate = useNavigate();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0];
      if (!selected.name.toLowerCase().endsWith('.pdf') && !selected.name.toLowerCase().endsWith('.json')) {
        setError('Only .pdf and .json files are supported.');
        return;
      }
      setFile(selected);
      setResult(null);
      setError(null);
      setErrorStatus(null);
      setErrorData(null);
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setLoading(true);
    setError(null);
    setErrorStatus(null);
    setErrorData(null);
    try {
      let data;
      if (file.name.toLowerCase().endsWith('.json')) {
        const text = await file.text();
        const jsonContent = JSON.parse(text);
        data = await api.importJson(jsonContent);
      } else {
        data = await api.uploadRoutine(file);
      }
      setResult(data);
      if (data.status === 'needs_review' && data.unresolved) {
        setCorrections(data.unresolved.map(u => ({
          page: u.page,
          day: u.day || '',
          start_time: u.time || '',
          room: u.room || '',
          raw_text: u.raw_text,
          course_code: '',
          group_code: '',
          teacher: '',
          end_time: ''
        })));
        return;
      }
      
      // Immediately refresh app options so the new version is available globally
      await refreshOptions();
      
      // Auto-select the newly created version
      if (data.version_id) {
        setSelectedVersionId(data.version_id);
      }
    } catch (err: any) {
      let msg = err.message || 'An error occurred during upload.';
      if (err.status === 400) {
        msg = `The uploaded file could not be processed. ${msg}`;
      } else if (err.status === 500) {
        msg = "The server encountered an unexpected error.";
      }
      
      setError(msg);
      setErrorStatus(err.status);
      setErrorData(err.data || null);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (!result?.session_id || !file) return;
    
    setConfirming(true);
    setError(null);
    setErrorStatus(null);
    setErrorData(null);
    
    try {
      const data = await api.uploadConfirm(
        result.session_id, 
        result.filename || file.name, 
        corrections,
        result.name
      );
      setResult(data);
      await refreshOptions();
      if (data.version_id) {
        setSelectedVersionId(data.version_id);
      }
    } catch (err: any) {
      let msg = err.message || 'An error occurred during confirmation.';
      if (err.status === 422) {
        msg = "Validation failed on manual corrections.";
      }
      setError(msg);
      setErrorStatus(err.status);
      setErrorData(err.data || null);
    } finally {
      setConfirming(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-in fade-in duration-300 pb-10">
      <div className="page-header">
        <div className="page-header-content">
          <div className="page-header-icon">
            <UploadIcon />
          </div>
          <div className="page-header-text">
            <h2>Upload Routine</h2>
            <p>Upload a new DIU routine PDF. A new version will be created automatically.</p>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 p-5 md:p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm text-center transition-all">
        
        {!result && (
          <div className="max-w-lg mx-auto py-8 px-4 sm:px-0">
            <div className={`border-2 border-dashed rounded-3xl p-6 sm:p-12 transition-all duration-300 flex flex-col items-center justify-center ${file ? 'border-purple-400 bg-purple-50/50 dark:bg-purple-900/10' : 'border-slate-300 dark:border-slate-700 hover:border-purple-400 dark:hover:border-purple-500 hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}>
              <FileUp className={`w-16 h-16 mb-5 transition-colors ${file ? 'text-purple-500' : 'text-slate-300 dark:text-slate-600'}`} />
              
              <label className="block cursor-pointer w-full text-center">
                <span className="sr-only">Choose PDF or JSON</span>
                <input 
                  type="file" 
                  accept=".pdf,.json,application/pdf,application/json" 
                  onChange={handleFileChange}
                  className="block w-full max-w-[280px] mx-auto text-sm text-slate-500 dark:text-slate-400
                    file:mr-4 file:py-2.5 file:px-5
                    file:rounded-full file:border-0
                    file:text-sm file:font-bold file:transition-colors
                    file:bg-purple-100 file:text-purple-700
                    hover:file:bg-purple-200
                    dark:file:bg-purple-900/30 dark:file:text-purple-400 dark:hover:file:bg-purple-900/50"
                />
              </label>
              
              {file && (
                <div className="mt-5 px-4 py-2 bg-white dark:bg-slate-800 rounded-lg text-sm font-bold text-slate-700 dark:text-slate-300 shadow-sm border border-slate-200 dark:border-slate-700">
                  {file.name}
                </div>
              )}
            </div>

            <div className="mt-8">
              <button
                onClick={handleUpload}
                disabled={!file || loading}
                className="w-full bg-purple-600 hover:bg-purple-700 text-white px-6 py-4 rounded-2xl font-bold text-lg shadow-lg shadow-purple-500/30 transition-all active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100 flex items-center justify-center gap-3"
              >
                {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : <UploadIcon className="w-6 h-6" />}
                {loading ? 'Processing & Importing...' : 'Import Routine'}
              </button>
            </div>
          </div>
        )}

        {error && (
          <div className="mt-6 text-left animate-in zoom-in-95 duration-300">
            <div className={`p-6 rounded-2xl mb-6 flex flex-col sm:flex-row items-center justify-between gap-4 border ${
              errorStatus === 422 ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800 text-orange-700 dark:text-orange-400' 
              : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-600 dark:text-red-400'
            }`}>
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-6 h-6 flex-shrink-0" />
                <div>
                  <h3 className="font-bold text-lg mb-1">
                    {errorStatus === 409 ? 'Duplicate Routine' : errorStatus === 422 ? 'Parsing Issues Detected' : 'Upload Failed'}
                  </h3>
                  <span className="font-medium">{error}</span>
                </div>
              </div>
              {errorStatus === 409 && errorData?.version_id && (
                <button
                  onClick={() => {
                    setSelectedVersionId(errorData.version_id);
                    navigate('/');
                  }}
                  className="bg-red-100 hover:bg-red-200 dark:bg-red-900/40 dark:hover:bg-red-900/60 px-4 py-2 rounded-lg font-bold transition-colors whitespace-nowrap"
                >
                  View Version {errorData.version_id}
                </button>
              )}
            </div>

            {errorStatus === 422 && errorData && (errorData.repairs?.length > 0 || errorData.warnings?.length > 0) && (
              <div className="space-y-6 mt-4">
                <h4 className="font-bold text-lg text-slate-800 dark:text-slate-200 flex items-center gap-2">
                  <Info className="w-5 h-5 text-orange-500" /> Parser Diagnostics
                </h4>
                
                {errorData.repairs?.length > 0 && (
                  <div className="bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                    <div className="px-4 py-2 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-100 dark:border-blue-800/50 font-semibold text-blue-800 dark:text-blue-300 text-sm">
                      Repairs ({errorData.repairs.length})
                    </div>
                    <ul className="divide-y divide-slate-200 dark:divide-slate-800 max-h-60 overflow-y-auto custom-scrollbar">
                      {errorData.repairs.map((r: any, i: number) => (
                        <li key={i} className="px-4 py-3 text-sm flex gap-3">
                          <span className="text-slate-400 w-16 flex-shrink-0">Pg {r.page}</span>
                          <span className="text-slate-500 font-medium w-24 flex-shrink-0">{r.day}</span>
                          <span className="text-slate-700 dark:text-slate-300">{r.message}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {errorData.warnings?.length > 0 && (
                  <div className="bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                    <div className="px-4 py-2 bg-yellow-50 dark:bg-yellow-900/20 border-b border-yellow-100 dark:border-yellow-800/50 font-semibold text-yellow-800 dark:text-yellow-500 text-sm">
                      Warnings ({errorData.warnings.length})
                    </div>
                    <ul className="divide-y divide-slate-200 dark:divide-slate-800 max-h-60 overflow-y-auto custom-scrollbar">
                      {errorData.warnings.map((w: any, i: number) => (
                        <li key={i} className="px-4 py-3 text-sm flex gap-3">
                          <span className="text-slate-400 w-16 flex-shrink-0">Pg {w.page}</span>
                          <span className="text-slate-700 dark:text-slate-300">{w.message}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        
        {/* Needs Review UI */}
        {result?.status === 'needs_review' && result.unresolved && (
          <div className="text-left animate-in zoom-in-95 duration-300">
            <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 p-6 rounded-2xl mb-6">
              <div className="flex items-center gap-3 mb-2">
                <AlertTriangle className="w-6 h-6 text-orange-500" />
                <h3 className="text-xl font-bold text-orange-800 dark:text-orange-400">Review Required</h3>
              </div>
              <p className="text-orange-700 dark:text-orange-500 font-medium">
                {result.unresolved.length} records need manual review before this routine can be imported.
              </p>
            </div>
            
            <div className="space-y-6 mb-8">
              {corrections.map((corr, idx) => (
                <div key={idx} className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm">
                  <div className="mb-4 text-sm bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-3 rounded-lg flex items-center justify-between">
                    <div>
                      <span className="text-slate-500 font-medium">Context: </span>
                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                        Pg {corr.page} &middot; {corr.day} &middot; {corr.start_time} &middot; {corr.room}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 font-medium">Original: </span>
                      <span className="font-mono text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-2 py-0.5 rounded">{corr.raw_text}</span>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">Course</label>
                      <input 
                        type="text" 
                        value={corr.course_code}
                        onChange={e => {
                          const newC = [...corrections];
                          newC[idx].course_code = e.target.value.toUpperCase();
                          setCorrections(newC);
                        }}
                        className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 outline-none"
                        placeholder="e.g. CSE113"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">Group</label>
                      <input 
                        type="text" 
                        value={corr.group_code}
                        onChange={e => {
                          const newC = [...corrections];
                          newC[idx].group_code = e.target.value;
                          setCorrections(newC);
                        }}
                        className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 outline-none"
                        placeholder="e.g. 64_M"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">Teacher</label>
                      <input 
                        type="text" 
                        value={corr.teacher}
                        onChange={e => {
                          const newC = [...corrections];
                          newC[idx].teacher = e.target.value;
                          setCorrections(newC);
                        }}
                        className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 outline-none"
                        placeholder="e.g. MSH"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">Room</label>
                      <input 
                        type="text" 
                        value={corr.room}
                        onChange={e => {
                          const newC = [...corrections];
                          newC[idx].room = e.target.value;
                          setCorrections(newC);
                        }}
                        className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 outline-none"
                        placeholder="e.g. G1-007"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="flex justify-end gap-4">
              <button
                onClick={() => {
                  setResult(null);
                  setFile(null);
                }}
                className="px-6 py-2.5 rounded-xl font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                disabled={confirming}
                className="bg-accent hover:bg-purple-600 text-white px-6 py-2.5 rounded-xl font-bold shadow-lg shadow-purple-500/30 transition-all flex items-center gap-2 disabled:opacity-50"
              >
                {confirming ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle className="w-5 h-5" />}
                Validate & Import
              </button>
            </div>
          </div>
        )}

        {/* Rich Summary */}
        {result && result.status !== 'needs_review' && (
          <div className="text-left animate-in zoom-in-95 duration-300">
            <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 p-6 rounded-2xl mb-6">
              <div className="flex items-center gap-3 mb-2">
                <CheckCircle className="w-6 h-6 text-emerald-500" />
                <h3 className="text-xl font-bold text-emerald-800 dark:text-emerald-400">Import Successful</h3>
              </div>
              <p className="text-emerald-700 dark:text-emerald-500 font-medium">
                Version {result.version_id} {result.semester ? `(${result.semester}) ` : ''}was imported successfully and is now selected.
              </p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
                <div className="text-2xl font-black text-slate-800 dark:text-slate-100">{result.record_count}</div>
                <div className="text-sm font-medium text-slate-500">Records Found</div>
              </div>
              <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
                <div className="text-2xl font-black text-slate-800 dark:text-slate-100">{result.pages_processed}</div>
                <div className="text-sm font-medium text-slate-500">Pages Processed</div>
              </div>
              <div className="bg-yellow-50 dark:bg-yellow-900/10 p-4 rounded-xl border border-yellow-200 dark:border-yellow-900/30">
                <div className="text-2xl font-black text-yellow-600 dark:text-yellow-500">{result.warning_count}</div>
                <div className="text-sm font-medium text-yellow-600/80">Warnings</div>
              </div>
              <div className="bg-blue-50 dark:bg-blue-900/10 p-4 rounded-xl border border-blue-200 dark:border-blue-900/30">
                <div className="text-2xl font-black text-blue-600 dark:text-blue-500">{result.repair_count}</div>
                <div className="text-sm font-medium text-blue-600/80">Auto-Repairs</div>
              </div>
            </div>

            {(result.repairs.length > 0 || (result.warnings && (result.warnings as any[]).length > 0)) && (
              <div className="space-y-6">
                <h4 className="font-bold text-lg text-slate-800 dark:text-slate-200 flex items-center gap-2">
                  <Info className="w-5 h-5 text-blue-500" /> Parser Intelligence Log
                </h4>
                
                {result.repairs.length > 0 && (
                  <div className="bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                    <div className="px-4 py-2 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-100 dark:border-blue-800/50 font-semibold text-blue-800 dark:text-blue-300 text-sm">
                      Repairs ({result.repairs.length})
                    </div>
                    <ul className="divide-y divide-slate-200 dark:divide-slate-800 max-h-60 overflow-y-auto custom-scrollbar">
                      {result.repairs.map((r, i) => (
                        <li key={i} className="px-4 py-3 text-sm flex gap-3">
                          <span className="text-slate-400 w-16 flex-shrink-0">Pg {r.page}</span>
                          <span className="text-slate-500 font-medium w-24 flex-shrink-0">{r.day}</span>
                          <span className="text-slate-700 dark:text-slate-300">{r.message}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {result.warnings && (result.warnings as any[]).length > 0 && (
                  <div className="bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                    <div className="px-4 py-2 bg-yellow-50 dark:bg-yellow-900/20 border-b border-yellow-100 dark:border-yellow-800/50 font-semibold text-yellow-800 dark:text-yellow-500 text-sm">
                      Warnings ({(result.warnings as any[]).length})
                    </div>
                    <ul className="divide-y divide-slate-200 dark:divide-slate-800 max-h-60 overflow-y-auto custom-scrollbar">
                      {(result.warnings as any[]).map((w, i) => (
                        <li key={i} className="px-4 py-3 text-sm flex gap-3">
                          <span className="text-slate-400 w-16 flex-shrink-0">Pg {w.page}</span>
                          <span className="text-slate-700 dark:text-slate-300">{w.message}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
            
            <div className="mt-8 flex justify-end gap-4">
              <button
                onClick={() => {
                  window.open(`http://localhost:8000/api/export/json/${result.version_id}`, '_blank');
                }}
                className="px-6 py-2.5 rounded-xl font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                Export JSON
              </button>
              <button
                onClick={() => {
                  setResult(null);
                  setFile(null);
                }}
                className="px-6 py-2.5 rounded-xl font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                Upload Another
              </button>
              <button
                onClick={() => navigate('/')}
                className="bg-accent hover:bg-purple-600 text-white px-6 py-2.5 rounded-xl font-bold shadow-lg shadow-purple-500/30 transition-all flex items-center gap-2"
              >
                Go to Dashboard <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
