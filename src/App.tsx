import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { ThemeProvider } from './hooks/useTheme';
import { Dashboard } from './pages/Dashboard';
import { Explore } from './pages/Explore';
import { Search } from './pages/Search';
import { Settings } from './pages/Settings';
import { AppProvider } from './context/AppContext';
import { PlannerLayout } from './pages/planner/PlannerLayout';
import { PreferencesProvider } from './hooks/usePreferences';

function App() {
  return (
    <ThemeProvider>
      <PreferencesProvider>
        <BrowserRouter>
          <AppProvider>
            <Routes>
              <Route path="/" element={<Layout />}>
                <Route index element={<Dashboard />} />
                <Route path="explore" element={<Explore />} />
                <Route path="search" element={<Search />} />
                <Route path="settings" element={<Settings />} />
                <Route path="planner/*" element={<PlannerLayout />} />
              </Route>
            </Routes>
          </AppProvider>
        </BrowserRouter>
      </PreferencesProvider>
    </ThemeProvider>
  );
}

export default App;
