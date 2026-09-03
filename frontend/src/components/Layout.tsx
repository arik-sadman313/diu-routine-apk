
import { NavLink, Outlet } from 'react-router-dom';
import { LayoutDashboard, Compass, Search, Upload, Settings, CalendarDays, ChevronDown } from 'lucide-react';
import { useAppContext } from '../context/AppContext';

export function Layout() {
  const navItems = [
    { to: '/', label: 'My Routine', icon: LayoutDashboard },
    { to: '/explore', label: 'Explore', icon: Compass },
    { to: '/planner', label: 'Planner', icon: CalendarDays },
    { to: '/search', label: 'Search', icon: Search },
    { to: '/upload', label: 'Upload', icon: Upload },
    { to: '/settings', label: 'Settings', icon: Settings },
  ];

  const { versions, selectedVersion, setSelectedVersionId } = useAppContext();

  return (
    <div className="flex flex-col md:flex-row min-h-screen w-full bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans">
      {/* Sidebar for Desktop */}
      <aside className="hidden md:flex flex-col w-56 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm z-10 sticky top-0 h-screen overflow-y-auto flex-shrink-0">
        <div className="px-5 py-6">
          <h1 className="text-base font-bold tracking-tight text-purple-600 dark:text-purple-400 mb-4">
            DIU Routine
          </h1>
          {versions.length > 0 && (
            <div className="relative">
              <select
                value={selectedVersion?.id || ''}
                onChange={(e) => setSelectedVersionId(Number(e.target.value))}
                className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-lg px-3 py-2 text-xs text-slate-700 dark:text-slate-300 focus:ring-2 focus:ring-purple-500/50 outline-none appearance-none font-medium pr-7 truncate cursor-pointer"
              >
                {versions.map(v => (
                  <option key={v.id} value={v.id}>{v.name || v.semester || `Version ${v.id}`}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
            </div>
          )}
        </div>
        <nav className="flex-1 px-3 pb-6 space-y-0.5">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all font-medium text-sm ${
                  isActive
                    ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 shadow-sm'
                    : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800/70'
                }`
              }
            >
              <item.icon className="w-4 h-4 flex-shrink-0" />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 h-screen overflow-y-auto overflow-x-hidden pb-16 md:pb-0">
        {/* Top Header for Mobile */}
        <header className="md:hidden flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 sticky top-0 z-10 shadow-sm">
          <h1 className="text-base font-bold text-purple-600 dark:text-purple-400">DIU Routine</h1>
          {versions.length > 0 && (
            <div className="relative">
              <select
                value={selectedVersion?.id || ''}
                onChange={(e) => setSelectedVersionId(Number(e.target.value))}
                className="bg-slate-100 dark:bg-slate-800 border-none rounded-lg px-2.5 py-1.5 text-xs text-slate-700 dark:text-slate-300 focus:ring-2 focus:ring-purple-500/50 outline-none max-w-[140px] truncate appearance-none pr-6 cursor-pointer"
              >
                {versions.map(v => (
                  <option key={v.id} value={v.id}>{v.name || v.semester || `v${v.id}`}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
            </div>
          )}
        </header>

        <div className="flex-1 p-4 md:p-8 max-w-screen-xl mx-auto w-full">
          <Outlet />
        </div>
      </main>

      {/* Bottom Navigation for Mobile */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 border-t border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md flex justify-around py-1 px-2 z-20 shadow-[0_-1px_0_0_rgba(0,0,0,0.06)] dark:shadow-none">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              `flex flex-col items-center py-2 px-2 rounded-lg transition-colors ${
                isActive
                  ? 'text-purple-600 dark:text-purple-400'
                  : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
              }`
            }
          >
            <item.icon className="w-5 h-5 mb-0.5" />
            <span className="text-[9px] font-semibold leading-none">{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
