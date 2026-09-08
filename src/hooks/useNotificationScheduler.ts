import { useEffect } from 'react';
import { usePreferences } from './usePreferences';
import { useAppContext } from '../context/AppContext';
import { notificationService } from '../services/notificationService';
import { Capacitor } from '@capacitor/core';

export function useNotificationScheduler() {
  const preferences = usePreferences();
  const { customCourses, selectedVersion } = useAppContext();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    // We pass the preferences directly. The routine data is fetched internally by the service.
    
    const prefs = {
      masterNotifications: preferences.masterNotifications,
      classNotifications: preferences.classNotifications,
      notifyBeforeClass: preferences.notifyBeforeClass,
      plannerNotifications: preferences.plannerNotifications,
      weatherSuggestions: preferences.weatherSuggestions,
      weatherLocation: preferences.weatherLocation,
      batch: preferences.batch,
      section: preferences.section,
      versionId: selectedVersion?.id
    };

    // Schedule all notifications in the background
    notificationService.scheduleAll(prefs, customCourses).catch(e => {
      console.error("Failed to schedule notifications", e);
    });

  }, [
    preferences.masterNotifications,
    preferences.classNotifications,
    preferences.notifyBeforeClass,
    preferences.plannerNotifications,
    preferences.weatherSuggestions,
    preferences.weatherLocation,
    preferences.batch,
    preferences.section,
    selectedVersion?.id,
    customCourses,
  ]);
}
