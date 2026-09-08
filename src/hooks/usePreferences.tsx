import { useState, useEffect, createContext, useContext } from 'react';
import type { ReactNode } from 'react';

export type AccentColor = 'purple' | 'blue' | 'green' | 'orange' | 'red' | 'pink';
export type FontSize = 'small' | 'default' | 'large' | 'extra-large';
export type UIDensity = 'compact' | 'comfortable' | 'spacious';
export type TimeFormat = '12h' | '24h';
export type ClassDetailMode = 'compact' | 'detailed';

function usePreferencesProvider() {
  const [batch, setBatch] = useState<string>(() => localStorage.getItem('diu_routine_batch') || '');
  const [section, setSection] = useState<string>(() => localStorage.getItem('diu_routine_section') || '');
  const [weatherLocation, setWeatherLocation] = useState<string>(() => localStorage.getItem('diu_weather_location') || 'Dhaka'); // Format: Lat,Lon or 'Dhaka'

  // Appearance
  const [accentColor, setAccentColor] = useState<AccentColor>(() => (localStorage.getItem('diu_accent_color') as AccentColor) || 'purple');
  const [fontSize, setFontSize] = useState<FontSize>(() => (localStorage.getItem('diu_font_size') as FontSize) || 'default');
  const [uiDensity, setUiDensity] = useState<UIDensity>(() => (localStorage.getItem('diu_ui_density') as UIDensity) || 'comfortable');
  const [reduceAnimations, setReduceAnimations] = useState<boolean>(() => localStorage.getItem('diu_reduce_animations') === 'true');

  // Timetable
  const [timeFormat, setTimeFormat] = useState<TimeFormat>(() => (localStorage.getItem('diu_time_format') as TimeFormat) || '24h');
  const [showRoom, setShowRoom] = useState<boolean>(() => localStorage.getItem('diu_show_room') !== 'false');
  const [showTeacher, setShowTeacher] = useState<boolean>(() => localStorage.getItem('diu_show_teacher') !== 'false');
  const [showGroup, setShowGroup] = useState<boolean>(() => localStorage.getItem('diu_show_group') !== 'false');
  const [classDetailMode, setClassDetailMode] = useState<ClassDetailMode>(() => (localStorage.getItem('diu_class_detail_mode') as ClassDetailMode) || 'detailed');

  // Notifications
  const [masterNotifications, setMasterNotifications] = useState<boolean>(() => localStorage.getItem('diu_master_notifications') !== 'false');
  const [classNotifications, setClassNotifications] = useState<boolean>(() => localStorage.getItem('diu_class_notifications') !== 'false');
  const [notifyBeforeClass, setNotifyBeforeClass] = useState<number>(() => {
    const saved = localStorage.getItem('diu_notify_before_class');
    return saved ? parseInt(saved, 10) : 30;
  });
  const [plannerNotifications, setPlannerNotifications] = useState<boolean>(() => localStorage.getItem('diu_planner_notifications') !== 'false');
  const [weatherSuggestions, setWeatherSuggestions] = useState<boolean>(() => localStorage.getItem('diu_weather_suggestions') !== 'false');

  useEffect(() => {
    if (batch) localStorage.setItem('diu_routine_batch', batch);
    else localStorage.removeItem('diu_routine_batch');
  }, [batch]);

  useEffect(() => {
    if (section) localStorage.setItem('diu_routine_section', section);
    else localStorage.removeItem('diu_routine_section');
  }, [section]);

  useEffect(() => {
    if (weatherLocation) localStorage.setItem('diu_weather_location', weatherLocation);
    else localStorage.removeItem('diu_weather_location');
  }, [weatherLocation]);

  useEffect(() => { localStorage.setItem('diu_accent_color', accentColor); }, [accentColor]);
  useEffect(() => { localStorage.setItem('diu_font_size', fontSize); }, [fontSize]);
  useEffect(() => { localStorage.setItem('diu_ui_density', uiDensity); }, [uiDensity]);
  useEffect(() => { localStorage.setItem('diu_reduce_animations', String(reduceAnimations)); }, [reduceAnimations]);
  
  useEffect(() => { localStorage.setItem('diu_time_format', timeFormat); }, [timeFormat]);
  useEffect(() => { localStorage.setItem('diu_show_room', String(showRoom)); }, [showRoom]);
  useEffect(() => { localStorage.setItem('diu_show_teacher', String(showTeacher)); }, [showTeacher]);
  useEffect(() => { localStorage.setItem('diu_show_group', String(showGroup)); }, [showGroup]);
  useEffect(() => { localStorage.setItem('diu_class_detail_mode', classDetailMode); }, [classDetailMode]);

  useEffect(() => { localStorage.setItem('diu_master_notifications', String(masterNotifications)); }, [masterNotifications]);
  useEffect(() => { localStorage.setItem('diu_class_notifications', String(classNotifications)); }, [classNotifications]);
  useEffect(() => { localStorage.setItem('diu_notify_before_class', String(notifyBeforeClass)); }, [notifyBeforeClass]);
  useEffect(() => { localStorage.setItem('diu_planner_notifications', String(plannerNotifications)); }, [plannerNotifications]);
  useEffect(() => { localStorage.setItem('diu_weather_suggestions', String(weatherSuggestions)); }, [weatherSuggestions]);

  const clearPreferences = () => {
    setBatch('');
    setSection('');
    setWeatherLocation('Dhaka');
    setAccentColor('purple');
    setFontSize('default');
    setUiDensity('comfortable');
    setReduceAnimations(false);
    setTimeFormat('24h');
    setShowRoom(true);
    setShowTeacher(true);
    setShowGroup(true);
    setClassDetailMode('detailed');
    setMasterNotifications(true);
    setClassNotifications(true);
    setNotifyBeforeClass(30);
    setPlannerNotifications(true);
    setWeatherSuggestions(true);

    localStorage.removeItem('diu_routine_batch');
    localStorage.removeItem('diu_routine_section');
    localStorage.removeItem('diu_weather_location');
    localStorage.removeItem('diu_accent_color');
    localStorage.removeItem('diu_font_size');
    localStorage.removeItem('diu_ui_density');
    localStorage.removeItem('diu_reduce_animations');
    localStorage.removeItem('diu_time_format');
    localStorage.removeItem('diu_show_room');
    localStorage.removeItem('diu_show_teacher');
    localStorage.removeItem('diu_show_group');
    localStorage.removeItem('diu_class_detail_mode');
    localStorage.removeItem('diu_master_notifications');
    localStorage.removeItem('diu_class_notifications');
    localStorage.removeItem('diu_notify_before_class');
    localStorage.removeItem('diu_planner_notifications');
    localStorage.removeItem('diu_weather_suggestions');
  };

  return { 
    batch, section, weatherLocation, 
    setBatch, setSection, setWeatherLocation, 
    accentColor, setAccentColor,
    fontSize, setFontSize,
    uiDensity, setUiDensity,
    reduceAnimations, setReduceAnimations,
    timeFormat, setTimeFormat,
    showRoom, setShowRoom,
    showTeacher, setShowTeacher,
    showGroup, setShowGroup,
    classDetailMode, setClassDetailMode,
    masterNotifications, setMasterNotifications,
    classNotifications, setClassNotifications,
    notifyBeforeClass, setNotifyBeforeClass,
    plannerNotifications, setPlannerNotifications,
    weatherSuggestions, setWeatherSuggestions,
    clearPreferences 
  };
}

type PreferencesContextType = ReturnType<typeof usePreferencesProvider>;

const PreferencesContext = createContext<PreferencesContextType | undefined>(undefined);

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const preferences = usePreferencesProvider();
  return (
    <PreferencesContext.Provider value={preferences}>
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferences() {
  const context = useContext(PreferencesContext);
  if (context === undefined) {
    throw new Error('usePreferences must be used within a PreferencesProvider');
  }
  return context;
}
