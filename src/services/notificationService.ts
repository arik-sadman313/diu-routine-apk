import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';
import { api } from './api';
import { plannerApi } from './plannerApi';
import { weatherService } from './weatherService';
import { addDays, setHours, setMinutes, startOfDay, isAfter } from 'date-fns';
import { parseRoutineTime } from '../utils/time';

export interface NotificationPreferences {
  masterNotifications: boolean;
  classNotifications: boolean;
  notifyBeforeClass: number; // minutes
  plannerNotifications: boolean;
  weatherSuggestions: boolean;
  weatherLocation: string;
  batch?: string;
  section?: string;
  versionId?: number;
}

// Simple hash for deterministic IDs
function hashStringToInt(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

export const notificationService = {
  async checkPermissions(): Promise<boolean> {
    if (!Capacitor.isNativePlatform()) return false;
    const { display } = await LocalNotifications.checkPermissions();
    return display === 'granted';
  },

  async requestPermissions(): Promise<boolean> {
    if (!Capacitor.isNativePlatform()) return false;
    const { display } = await LocalNotifications.requestPermissions();
    return display === 'granted';
  },

  async cancelAll(): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;
    const pending = await LocalNotifications.getPending();
    if (pending.notifications.length > 0) {
      await LocalNotifications.cancel({ notifications: pending.notifications });
    }
  },

  async scheduleAll(prefs: NotificationPreferences, customCourses: any[]): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;
    
    // Always cancel existing to avoid duplicates and stale data
    await this.cancelAll();

    if (!prefs.masterNotifications) return;

    const hasPermission = await this.checkPermissions();
    if (!hasPermission) return;

    const notificationsToSchedule: any[] = [];

    // --- 1. Class Notifications ---
    if (prefs.classNotifications && prefs.batch && prefs.section && prefs.versionId) {
      try {
        const routineData = await api.getRoutine(prefs.batch, prefs.section, prefs.versionId);
        const activeClasses = routineData.classes.filter((c: any) => c.record_type !== 'hidden');
          
          let weatherData = null;
          if (prefs.weatherSuggestions) {
            try {
              weatherData = await weatherService.fetchWeather(prefs.weatherLocation);
            } catch (e) {
              console.warn("Could not fetch weather for notifications", e);
            }
          }

          const now = new Date();

          for (let i = 0; i < 7; i++) {
            const date = addDays(startOfDay(now), i);
            const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });
            
            const dayClasses = activeClasses.filter(c => c.day === dayName);
            for (const c of dayClasses) {
              const customCourse = customCourses.find(cc => cc.course_code === c.course_code);
              const courseName = customCourse?.course_name || c.course_code;

              const parsedStart = parseRoutineTime(c.start_time, date);
              const classDate = parsedStart;
              const notificationDate = new Date(classDate.getTime() - prefs.notifyBeforeClass * 60000);

              if (isAfter(notificationDate, now)) {
                let body = `${c.start_time}-${c.end_time} • ${c.room}`;
                
                // Smart Weather Suggestion
                if (weatherData) {
                  const parsedEnd = parseRoutineTime(c.end_time, date);
                  const durationMins = (parsedEnd.getTime() - parsedStart.getTime()) / 60000;
                  const suggestion = weatherService.generateSmartSuggestion(weatherData, classDate.getTime(), durationMins);
                  if (suggestion) {
                    body += `\n\n${suggestion}`;
                  }
                }

                notificationsToSchedule.push({
                  id: hashStringToInt(`class_${c.id}_${classDate.getTime()}`),
                  title: `Class in ${prefs.notifyBeforeClass} minutes: ${courseName}`,
                  body: body,
                  schedule: { at: notificationDate },
                  smallIcon: 'ic_stat_icon', // Ensure you have a small icon in Android res/drawable
                });
              }
            }
          }
      } catch (e) {
        console.error("Error scheduling class notifications", e);
      }
    }

    // --- 2. Planner Notifications ---
    if (prefs.plannerNotifications) {
      try {
        const upcoming = await plannerApi.getUpcoming(14); // Next 14 days
        const now = new Date();

        const scheduleItem = (item: any, type: string, hoursBefore: number, defaultTitle: string) => {
          if (!item.due_date) return;
          let itemDate = new Date(item.due_date);
          if (item.due_time) {
            const [h, m] = item.due_time.split(':').map(Number);
            itemDate = setMinutes(setHours(itemDate, h), m);
          } else {
            // Default to end of day if no time
            itemDate = setMinutes(setHours(itemDate, 23), 59);
          }

          // Use reminder time if available, otherwise fallback
          let notifyTime = new Date(itemDate.getTime() - hoursBefore * 3600000);
          if (item.reminder_time) {
             const rDate = new Date(item.reminder_time);
             if (!isNaN(rDate.getTime())) notifyTime = rDate;
          }

          if (isAfter(notifyTime, now)) {
            notificationsToSchedule.push({
              id: hashStringToInt(`planner_${type}_${item.id}_${notifyTime.getTime()}`),
              title: `${defaultTitle}: ${item.course ? item.course + ' ' : ''}${item.title}`,
              body: `Due: ${itemDate.toLocaleString()}`,
              schedule: { at: notifyTime },
              smallIcon: 'ic_stat_icon',
            });
          }
        };

        upcoming.assignments.forEach(a => scheduleItem(a, 'assignment', 24, 'Assignment Due Tomorrow'));
        upcoming.quizzes.forEach(q => scheduleItem(q, 'quiz', 24, 'Quiz Tomorrow'));
        upcoming.exams.forEach(e => scheduleItem(e, 'exam', 24, 'Exam Tomorrow'));
        upcoming.tasks.forEach(t => scheduleItem(t, 'task', 1, 'Task Reminder'));
        upcoming.reminders.forEach(r => {
           const rTime = r.time ? new Date(`${r.date}T${r.time}`) : new Date(r.date);
           if (isAfter(rTime, now)) {
              notificationsToSchedule.push({
                id: hashStringToInt(`planner_reminder_${r.id}_${rTime.getTime()}`),
                title: `Reminder: ${r.title}`,
                body: r.notes || '',
                schedule: { at: rTime },
                smallIcon: 'ic_stat_icon',
              });
           }
        });

      } catch (e) {
        console.error("Error scheduling planner notifications", e);
      }
    }

    if (notificationsToSchedule.length > 0) {
      await LocalNotifications.schedule({ notifications: notificationsToSchedule });
    }
  }
};
