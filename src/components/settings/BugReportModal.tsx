import { X, ExternalLink, Loader2, AlertTriangle, Bug, Smartphone } from 'lucide-react';
import { Browser } from '@capacitor/browser';
import { App } from '@capacitor/app';
import { Device } from '@capacitor/device';
import { Network } from '@capacitor/network';
import { useEffect, useState } from 'react';
import { useAppContext } from '../../context/AppContext';

interface BugReportModalProps {
  onClose: () => void;
}

export function BugReportModal({ onClose }: BugReportModalProps) {
  const { selectedVersion } = useAppContext();
  
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [steps, setSteps] = useState('');
  
  const [diagnostics, setDiagnostics] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [showDiagnostics, setShowDiagnostics] = useState(false);

  useEffect(() => {
    async function collectDiagnostics() {
      try {
        const appInfo = await App.getInfo().catch(() => ({ version: 'Unknown' }));
        const deviceInfo = await Device.getInfo().catch(() => ({ model: 'Unknown', osVersion: 'Unknown', operatingSystem: 'Android' }));
        const networkInfo = await Network.getStatus().catch(() => ({ connected: true }));
        
        setDiagnostics({
          appVersion: appInfo.version,
          platform: deviceInfo.operatingSystem,
          osVersion: deviceInfo.osVersion,
          device: deviceInfo.model,
          isOnline: networkInfo.connected,
          routineVersion: selectedVersion?.id || 'Unknown',
          routineSemester: selectedVersion?.name || 'Unknown',
        });
      } catch (e) {
        console.error('Diagnostic error', e);
      } finally {
        setLoading(false);
      }
    }
    collectDiagnostics();
  }, [selectedVersion]);

  const handleSubmit = async () => {
    if (!title.trim() || !description.trim()) return;
    
    setSubmitting(true);
    setError(null);

    try {
      const status = await Network.getStatus();
      if (!status.connected) {
        setError("Internet connection required to open the online bug report.");
        setSubmitting(false);
        return;
      }

      let markdown = `## Description\n${description.trim()}\n\n`;
      
      if (steps.trim()) {
        markdown += `## Steps to Reproduce\n${steps.trim()}\n\n`;
      }
      
      markdown += `## Environment\n`;
      markdown += `- App: DIU Routine\n`;
      markdown += `- Version: ${diagnostics.appVersion || 'Unknown'}\n`;
      markdown += `- Platform: Android\n`;
      markdown += `- Android version: ${diagnostics.osVersion || 'Unknown'}\n`;
      markdown += `- Device: ${diagnostics.device || 'Unknown'}\n`;
      markdown += `- Routine: ${diagnostics.routineSemester || 'Unknown'} (${diagnostics.routineVersion || 'Unknown'})\n`;
      markdown += `- Status: ${diagnostics.isOnline ? 'Online' : 'Offline'}\n`;

      const encodedTitle = encodeURIComponent(title.trim());
      const encodedBody = encodeURIComponent(markdown);
      const url = `https://github.com/arik-sadman313/diu-routine-apk/issues/new?title=${encodedTitle}&body=${encodedBody}`;

      await Browser.open({ url });
      setSuccess(true);
      
    } catch (e) {
      console.error(e);
      setError("Could not open the bug report page. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const isFormValid = title.trim().length > 0 && description.trim().length > 0;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col justify-end sm:justify-center bg-slate-900/40 dark:bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="absolute inset-0" 
        onClick={onClose}
      />
      
      <div className="relative w-full max-w-lg mx-auto bg-slate-50 dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800 animate-in slide-in-from-bottom-8 sm:slide-in-from-bottom-4 duration-300 max-h-[90vh] flex flex-col">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0">
          <h2 className="text-lg font-black tracking-tight text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <Bug className="w-5 h-5 text-red-500" />
            Report a Bug
          </h2>
          <button 
            onClick={onClose}
            className="p-2 -mr-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-5">
          
          {success ? (
            <div className="flex flex-col items-center justify-center py-10 text-center space-y-4">
              <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mb-2">
                <ExternalLink className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
              </div>
              <h3 className="text-xl font-black text-slate-800 dark:text-slate-100">Bug report opened in your browser.</h3>
              <p className="text-slate-500 dark:text-slate-400 font-medium">Review it and submit it on GitHub using your account.</p>
              <button
                onClick={onClose}
                className="mt-6 px-6 py-2.5 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold rounded-xl transition-colors"
              >
                Close
              </button>
            </div>
          ) : (
            <>
              {error && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-xl p-4 flex gap-3 text-red-800 dark:text-red-300">
                  <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                  <p className="text-sm font-semibold">{error}</p>
                </div>
              )}

              <div className="space-y-4">
                {/* Title */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1">
                    Title <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    placeholder="What went wrong?"
                    maxLength={100}
                    className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-semibold text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 outline-none transition-all placeholder:font-medium placeholder:text-slate-400"
                  />
                </div>

                {/* Description */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1">
                    Description <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder="Describe the problem..."
                    rows={4}
                    maxLength={1000}
                    className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-semibold text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 outline-none transition-all placeholder:font-medium placeholder:text-slate-400 resize-none"
                  />
                </div>

                {/* Steps */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1">
                    Steps to reproduce <span className="text-slate-400 dark:text-slate-500 normal-case font-medium tracking-normal">(Optional)</span>
                  </label>
                  <textarea
                    value={steps}
                    onChange={e => setSteps(e.target.value)}
                    placeholder="1. Open Explore&#10;2. Select Week&#10;3. ..."
                    rows={3}
                    maxLength={500}
                    className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-semibold text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 outline-none transition-all placeholder:font-medium placeholder:text-slate-400 resize-none"
                  />
                </div>

                {/* Diagnostics Preview */}
                <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-800/50">
                  <button 
                    onClick={() => setShowDiagnostics(!showDiagnostics)}
                    className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <Smartphone className="w-4 h-4 text-slate-500" />
                      <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Automatic Diagnostics</span>
                    </div>
                    <span className="text-xs font-semibold text-purple-600 dark:text-purple-400">
                      {showDiagnostics ? 'Hide' : 'Show'}
                    </span>
                  </button>
                  
                  {showDiagnostics && (
                    <div className="px-4 pb-4 pt-1 border-t border-slate-100 dark:border-slate-800 space-y-2">
                      <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-3">
                        This safe technical information will be attached to help fix the bug. No personal data is included.
                      </p>
                      {loading ? (
                        <div className="flex justify-center py-2"><Loader2 className="w-5 h-5 animate-spin text-purple-500" /></div>
                      ) : (
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div className="bg-slate-50 dark:bg-slate-900/50 p-2 rounded-lg border border-slate-100 dark:border-slate-800">
                            <span className="text-slate-400 block mb-0.5 font-medium">App Version</span>
                            <span className="font-bold text-slate-700 dark:text-slate-200">{diagnostics.appVersion}</span>
                          </div>
                          <div className="bg-slate-50 dark:bg-slate-900/50 p-2 rounded-lg border border-slate-100 dark:border-slate-800">
                            <span className="text-slate-400 block mb-0.5 font-medium">Device</span>
                            <span className="font-bold text-slate-700 dark:text-slate-200">{diagnostics.device}</span>
                          </div>
                          <div className="bg-slate-50 dark:bg-slate-900/50 p-2 rounded-lg border border-slate-100 dark:border-slate-800">
                            <span className="text-slate-400 block mb-0.5 font-medium">OS Version</span>
                            <span className="font-bold text-slate-700 dark:text-slate-200">Android {diagnostics.osVersion}</span>
                          </div>
                          <div className="bg-slate-50 dark:bg-slate-900/50 p-2 rounded-lg border border-slate-100 dark:border-slate-800">
                            <span className="text-slate-400 block mb-0.5 font-medium">Routine</span>
                            <span className="font-bold text-slate-700 dark:text-slate-200 truncate block" title={diagnostics.routineSemester}>{diagnostics.routineSemester}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

        </div>

        {/* Footer Actions */}
        {!success && (
          <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 flex gap-3 shrink-0">
            <button 
              onClick={onClose}
              disabled={submitting}
              className="flex-1 py-3 px-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-xl transition-all active:scale-95 disabled:opacity-50"
            >
              Cancel
            </button>
            <button 
              onClick={handleSubmit}
              disabled={!isFormValid || submitting}
              className="flex-1 py-3 px-4 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl transition-all active:scale-95 disabled:opacity-50 disabled:bg-slate-300 dark:disabled:bg-slate-700 flex items-center justify-center gap-2 shadow-md shadow-purple-500/20"
            >
              {submitting ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Preparing...</>
              ) : (
                <><ExternalLink className="w-4 h-4" /> Submit Bug</>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
