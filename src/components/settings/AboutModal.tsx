import { X, Globe, ExternalLink } from 'lucide-react';
import { Browser } from '@capacitor/browser';
import { App } from '@capacitor/app';
import { useEffect, useState } from 'react';

interface AboutModalProps {
  onClose: () => void;
}

export function AboutModal({ onClose }: AboutModalProps) {
  const [version, setVersion] = useState<string>('1.0.x');

  useEffect(() => {
    App.getInfo().then((info: any) => {
      setVersion(`${info.version}`);
    }).catch(() => {
      // Fallback
    });
  }, []);

  const openGithub = async () => {
    try {
      await Browser.open({ url: 'https://github.com/arik-sadman313/diu-routine-apk' });
    } catch (e) {
      console.error('Failed to open browser', e);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex flex-col justify-end sm:justify-center bg-slate-900/40 dark:bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="absolute inset-0" 
        onClick={onClose}
      />
      
      <div className="relative w-full max-w-md mx-auto bg-slate-50 dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800 animate-in slide-in-from-bottom-8 sm:slide-in-from-bottom-4 duration-300">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <h2 className="text-lg font-black tracking-tight text-slate-800 dark:text-slate-100 flex items-center gap-2">
            About DIU Routine
          </h2>
          <button 
            onClick={onClose}
            className="p-2 -mr-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          <div className="text-center space-y-2">
            <div className="w-20 h-20 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-2xl mx-auto flex items-center justify-center shadow-lg mb-4">
              <span className="text-4xl font-black text-white tracking-tighter">DIU</span>
            </div>
            <h3 className="text-2xl font-black text-slate-900 dark:text-white">DIU Routine</h3>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Your offline DIU routine app</p>
          </div>

          <div className="bg-white dark:bg-slate-800/50 rounded-2xl p-4 border border-slate-200 dark:border-slate-700/50 space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm font-bold text-slate-500 dark:text-slate-400">Developed by</span>
              <span className="text-sm font-black text-slate-800 dark:text-slate-200">Md. Arik Sadman</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm font-bold text-slate-500 dark:text-slate-400">Version</span>
              <span className="text-sm font-black text-slate-800 dark:text-slate-200">{version}</span>
            </div>
          </div>

          <button 
            onClick={openGithub}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-bold transition-colors border border-slate-200 dark:border-slate-700"
          >
            <Globe className="w-5 h-5" />
            Project / Source
            <ExternalLink className="w-4 h-4 ml-1 opacity-50" />
          </button>

          <div className="text-center pt-2">
            <p className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
              © 2026 Md. Arik Sadman
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
