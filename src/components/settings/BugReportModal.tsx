import { X, ExternalLink, Loader2, AlertTriangle, Bug } from 'lucide-react';
import { Browser } from '@capacitor/browser';
import { Network } from '@capacitor/network';
import { useState } from 'react';

interface BugReportModalProps {
  onClose: () => void;
}

const BUG_REPORT_FORM_URL = 'https://forms.gle/2AYbYEjoFPKXNUgJ8';

export function BugReportModal({ onClose }: BugReportModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);

    try {
      const status = await Network.getStatus();
      if (!status.connected) {
        setError("Internet connection is required to open the bug report form.");
        setSubmitting(false);
        return;
      }

      await Browser.open({ url: BUG_REPORT_FORM_URL });
      setSuccess(true);
      
    } catch (e) {
      console.error(e);
      setError("Couldn't open the bug report form.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex flex-col justify-end sm:justify-center bg-slate-900/40 dark:bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="absolute inset-0" 
        onClick={onClose}
      />
      
      <div className="relative w-full max-w-sm mx-auto bg-slate-50 dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800 animate-in slide-in-from-bottom-8 sm:slide-in-from-bottom-4 duration-300 max-h-[90vh] flex flex-col">
        
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
            <div className="flex flex-col items-center justify-center py-6 text-center space-y-4">
              <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mb-2">
                <ExternalLink className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
              </div>
              <h3 className="text-xl font-black text-slate-800 dark:text-slate-100">Bug report opened</h3>
              <p className="text-slate-500 dark:text-slate-400 font-medium">Complete the form to send your report to the developer.</p>
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

              <div className="text-center py-4">
                <p className="text-slate-600 dark:text-slate-300 font-medium leading-relaxed">
                  Found something that isn't working correctly?
                  <br />
                  <br />
                  Tell us what happened and we'll look into it.
                </p>
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
              disabled={submitting}
              className="flex-1 py-3 px-4 bg-accent-600 hover:bg-accent-700 text-white font-bold rounded-xl transition-all active:scale-95 disabled:opacity-50 disabled:bg-slate-300 dark:disabled:bg-slate-700 flex items-center justify-center gap-2 shadow-md shadow-accent-500/20"
            >
              {submitting ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Preparing...</>
              ) : (
                <><ExternalLink className="w-4 h-4" /> Open Bug Report Form</>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
