import { X } from 'lucide-react';
import { Browser } from '@capacitor/browser';
import { App } from '@capacitor/app';
import { useEffect, useState } from 'react';
import { useAppContext } from '../../context/AppContext';

interface AboutModalProps {
  onClose: () => void;
}

export function AboutModal({ onClose }: AboutModalProps) {
  const [version, setVersion] = useState<string>('1.0.0 (100)');
  const { selectedVersion } = useAppContext();

  useEffect(() => {
    App.getInfo().then((info: any) => {
      if (info.version && info.build) {
        setVersion(`${info.version} (${info.build})`);
      } else if (info.version) {
        setVersion(info.version);
      }
    }).catch(() => {
      // Fallback
    });
  }, []);

  const openUrl = async (url: string) => {
    try {
      await Browser.open({ url });
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
          <h2 className="text-lg font-black tracking-tight text-slate-800 dark:text-slate-100">
            About
          </h2>
          <button 
            onClick={onClose}
            className="p-2 -mr-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-8 overflow-y-auto max-h-[80vh]">
          {/* Identity */}
          <div className="text-center space-y-2">
            <h3 className="text-2xl font-black text-slate-900 dark:text-white">DIU Routine</h3>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Your class routine, simplified.</p>
            <p className="text-sm font-black text-slate-800 dark:text-slate-200 mt-2">Version {version}</p>
          </div>

          {/* Developer */}
          <div className="bg-white dark:bg-slate-800/50 rounded-2xl p-4 border border-slate-200 dark:border-slate-700/50 text-center space-y-1">
            <p className="text-sm font-bold text-slate-500 dark:text-slate-400">Developed & maintained by</p>
            <p className="text-base font-black text-slate-800 dark:text-slate-200">Arik Sadman</p>
          </div>

          {/* Routine Data */}
          <div className="bg-white dark:bg-slate-800/50 rounded-2xl p-4 border border-slate-200 dark:border-slate-700/50 text-center space-y-1">
            <h4 className="text-sm font-black text-slate-800 dark:text-slate-200 mb-2">Routine Data</h4>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
              Last updated: {selectedVersion?.semester || 'Not available'}
            </p>
            <p className="text-xs font-bold text-slate-400 dark:text-slate-500 pt-1">
              Data is maintained by the developer.
            </p>
          </div>

          {/* Connect */}
          <div className="space-y-3">
            <h4 className="text-sm font-black text-slate-800 dark:text-slate-200 text-center">Connect</h4>
            <div className="flex items-center justify-center gap-2 flex-wrap text-sm font-bold">
              <button onClick={() => openUrl('https://github.com/arik-sadman313')} className="text-accent-600 dark:text-accent-400 hover:underline px-2 py-1">GitHub</button>
              <span className="text-slate-300 dark:text-slate-700">·</span>
              <button onClick={() => openUrl('https://www.linkedin.com/in/arik-sadman313')} className="text-accent-600 dark:text-accent-400 hover:underline px-2 py-1">LinkedIn</button>
              <span className="text-slate-300 dark:text-slate-700">·</span>
              <button onClick={() => openUrl('https://www.facebook.com/profile.php?id=61577683923569&sk=directory_education&fb_profile_edit_entry_point={%22feature%22:%22profile_directory%22%2C%22click_point%22:%22directory_field_bottomsheet_edit_button%22%2C%22additional_metadata%22:{%22section_type%22:%22education%22,%22field_type%22:%22education%22}}')} className="text-accent-600 dark:text-accent-400 hover:underline px-2 py-1">Facebook</button>
            </div>
          </div>

          {/* Legal */}
          <div className="space-y-3">
            <h4 className="text-sm font-black text-slate-800 dark:text-slate-200 text-center">Legal</h4>
            <div className="flex items-center justify-center gap-2 flex-wrap text-sm font-bold">
              <button onClick={() => openUrl('https://github.com/arik-sadman313/diu-routine-apk/blob/main/PRIVACY.md')} className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 transition-colors px-2 py-1">Privacy Policy</button>
              <span className="text-slate-300 dark:text-slate-700">·</span>
              <button onClick={() => openUrl('https://github.com/arik-sadman313/diu-routine-apk/blob/main/LICENSES.md')} className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 transition-colors px-2 py-1">Open Source Licenses</button>
            </div>
          </div>

          <div className="text-center pt-2">
            <p className="text-[11px] font-bold text-slate-400 dark:text-slate-500 tracking-widest">
              © 2026 Arik Sadman
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
