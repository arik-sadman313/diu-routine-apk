import { parse, setDay, addWeeks, isAfter } from 'date-fns';

/**
 * Parses a routine time string (e.g., "08:30", "10:00", "01:00") into a full Date object.
 * Because the backend strips AM/PM, this function intelligently assumes that
 * classes starting with '01' through '07' are in the PM (13:00 - 19:00).
 *
 * @param timeStr The time string from the backend (e.g. "01:30")
 * @param referenceDate Optional base date. Defaults to today.
 * @returns A Date object with the correct hour and minute.
 */
export function parseRoutineTime(timeStr: string, referenceDate: Date = new Date()): Date {
  const [hourStr, minStr] = timeStr.split(':');
  let hour = parseInt(hourStr, 10);
  
  if (isNaN(hour)) {
    return referenceDate; // Fallback for invalid formats
  }

  // Determine if it's PM (assuming University classes from 01:00 to 07:00 are PM)
  if (hour >= 1 && hour <= 7) {
    hour += 12;
  }

  // We format it back to HH:mm (24hr) and parse using date-fns
  const time24 = `${hour.toString().padStart(2, '0')}:${minStr}`;
  return parse(time24, 'HH:mm', referenceDate);
}

/**
 * Maps a day name to a number (0-6) where 0 is Sunday.
 */
export function getDayNumber(dayName: string): number {
  const map: Record<string, number> = {
    'sunday': 0,
    'monday': 1,
    'tuesday': 2,
    'wednesday': 3,
    'thursday': 4,
    'friday': 5,
    'saturday': 6,
  };
  return map[dayName.toLowerCase()] ?? -1;
}

/**
 * Finds the next occurrence of a specific day of the week from a base date.
 */
export function getNextDayOccurrence(dayName: string, fromDate: Date = new Date()): Date {
  const targetDay = getDayNumber(dayName);
  if (targetDay === -1) return fromDate;

  let d = setDay(fromDate, targetDay);
  if (!isAfter(d, fromDate)) {
    // If the target day has already passed this week, jump to next week
    d = addWeeks(d, 1);
  }
  return d;
}
