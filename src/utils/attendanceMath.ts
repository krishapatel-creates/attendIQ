import type { SubjectStanding, TimetableSlot } from '../types/academic';
import {
  getTodayLocalISO,
  getUitCalendarExclusion,
  parseSlotStartMinutes,
} from '../data/uitAcademicCalendar';

export interface RecoveryCalculation {
  currentPercent: number;
  targetPercent: number;
  isSafeZone: boolean;
  classesNeeded: number;
  safeToMiss: number;
}

/**
 * 1. Current Attendance (%): Attendance = (A / T) * 100
 */
export function calculateAttendancePercent(attended: number, total: number): number {
  if (total <= 0) return 0;
  return (attended / total) * 100;
}

/**
 * 2. Recovery Calculator:
 *    x = Math.ceil((p * T - A) / (1 - p))
 *    Safe Zone buffer: Math.floor((A - p * T) / p)
 */
export function calculateRecoveryMetrics(
  attended: number,
  total: number,
  targetPercent: number,
): RecoveryCalculation {
  const p = targetPercent / 100;
  const currentPercent = calculateAttendancePercent(attended, total);

  if (total <= 0) {
    return {
      currentPercent: 0,
      targetPercent,
      isSafeZone: true,
      classesNeeded: 0,
      safeToMiss: 0,
    };
  }

  // Guard floating-point precision when A / T === p (e.g. 16 / 20 = 80%)
  const isSafeZone = currentPercent + 1e-9 >= targetPercent;

  if (isSafeZone) {
    const rawBuffer = p > 0 ? (attended - p * total + 1e-9) / p : 0;
    return {
      currentPercent,
      targetPercent,
      isSafeZone: true,
      classesNeeded: 0,
      safeToMiss: Math.max(0, Math.floor(rawBuffer)),
    };
  }

  if (p >= 1) {
    return {
      currentPercent,
      targetPercent,
      isSafeZone: false,
      classesNeeded: Number.POSITIVE_INFINITY,
      safeToMiss: 0,
    };
  }

  const rawNeeded = (p * total - attended) / (1 - p);
  const classesNeeded = Math.max(1, Math.ceil(rawNeeded - 1e-9));

  return {
    currentPercent,
    targetPercent,
    isSafeZone: false,
    classesNeeded,
    safeToMiss: 0,
  };
}

/**
 * 3. What-If Simulator Formulas:
 *    - Attending m additional classes: ((A + m) / (T + m)) * 100
 *    - Missing m additional classes: (A / (T + m)) * 100
 */
export function simulateAttending(attended: number, total: number, m: number): number {
  const nextTotal = total + Math.max(0, m);
  if (nextTotal <= 0) return 0;
  return ((attended + Math.max(0, m)) / nextTotal) * 100;
}

export function simulateMissing(attended: number, total: number, m: number): number {
  const nextTotal = total + Math.max(0, m);
  if (nextTotal <= 0) return 0;
  return (attended / nextTotal) * 100;
}

export function simulateCombined(
  attended: number,
  total: number,
  attendCount: number,
  missCount: number,
): number {
  const a = Math.max(0, attendCount);
  const b = Math.max(0, missCount);
  const nextTotal = total + a + b;
  if (nextTotal <= 0) return 0;
  return ((attended + a) / nextTotal) * 100;
}

export function deriveStanding(
  attended: number,
  total: number,
  targetPercent: number,
): SubjectStanding {
  if (total <= 0) return 'on_track';
  const pct = calculateAttendancePercent(attended, total);
  if (pct + 1e-9 >= targetPercent) return 'on_track';
  if (pct + 1e-9 >= targetPercent - 3) return 'watch';
  return 'at_risk';
}

const WEEKDAY_INDEX_TO_NAME: Record<number, TimetableSlot['day']> = {
  1: 'Monday',
  2: 'Tuesday',
  3: 'Wednesday',
  4: 'Thursday',
  5: 'Friday',
};

export interface RecoverySessionStep {
  stepNumber: number;
  dateLabel: string;
  timeRange: string;
  room: string;
  projectedAttended: number;
  projectedTotal: number;
  projectedPercent: number;
}

/**
 * Projects upcoming session dates using the subject's weekly timetable slots,
 * skipping weekends, Diwali Vacation, and listed university holidays/exams.
 */
export function buildRecoveryPlan(
  courseCode: string,
  attended: number,
  total: number,
  classesNeeded: number,
  weeklyHours: number,
  timetable: TimetableSlot[],
  startDateISO = getTodayLocalISO(),
  applyHolidayExclusions = true,
): { projectedDateLabel: string; steps: RecoverySessionStep[] } {
  if (classesNeeded <= 0 || !Number.isFinite(classesNeeded)) {
    return { projectedDateLabel: 'Already in Safe Zone', steps: [] };
  }

  const courseSlots = timetable
    .filter((s) => s.courseCode.toUpperCase() === courseCode.toUpperCase())
    .sort((a, b) => parseSlotStartMinutes(a.timeRange) - parseSlotStartMinutes(b.timeRange));
  const fallbackDays: Array<{ day: TimetableSlot['day']; timeRange: string; room: string }> = [
    { day: 'Monday', timeRange: '09:30 – 10:20', room: 'I16' },
    { day: 'Wednesday', timeRange: '09:30 – 10:20', room: 'I16' },
    { day: 'Friday', timeRange: '09:30 – 10:20', room: 'I16' },
    { day: 'Thursday', timeRange: '10:20 – 11:10', room: 'I16' },
  ];

  const slotsByDay = new Map<TimetableSlot['day'], Array<{ timeRange: string; room: string }>>();
  if (courseSlots.length > 0) {
    courseSlots.forEach((slot) => {
      const list = slotsByDay.get(slot.day) ?? [];
      list.push({ timeRange: slot.timeRange, room: slot.room });
      slotsByDay.set(slot.day, list);
    });
  } else {
    const count = Math.min(4, Math.max(1, weeklyHours));
    fallbackDays.slice(0, count).forEach((item) => {
      const list = slotsByDay.get(item.day) ?? [];
      list.push({ timeRange: item.timeRange, room: item.room });
      slotsByDay.set(item.day, list);
    });
  }

  const steps: RecoverySessionStep[] = [];
  const cursor = new Date(`${startDateISO}T12:00:00`);
  const maxDaysToScan = 240;
  let scanned = 0;

  while (steps.length < classesNeeded && scanned < maxDaysToScan) {
    const y = cursor.getFullYear();
    const m = String(cursor.getMonth() + 1).padStart(2, '0');
    const d = String(cursor.getDate()).padStart(2, '0');
    const iso = `${y}-${m}-${d}`;
    const excluded = applyHolidayExclusions ? getUitCalendarExclusion(iso).excluded : false;

    const dayName = WEEKDAY_INDEX_TO_NAME[cursor.getDay()];
    if (dayName && !excluded) {
      const slots = slotsByDay.get(dayName) ?? [];
      for (const slot of slots) {
        if (steps.length >= classesNeeded) break;
        const stepNum = steps.length + 1;
        const projA = attended + stepNum;
        const projT = total + stepNum;
        const dateLabel = cursor.toLocaleDateString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
        });
        steps.push({
          stepNumber: stepNum,
          dateLabel,
          timeRange: slot.timeRange,
          room: slot.room,
          projectedAttended: projA,
          projectedTotal: projT,
          projectedPercent: calculateAttendancePercent(projA, projT),
        });
      }
    }
    cursor.setDate(cursor.getDate() + 1);
    scanned += 1;
  }

  const lastStep = steps[steps.length - 1];
  return {
    projectedDateLabel: lastStep ? lastStep.dateLabel : 'End of Semester',
    steps,
  };
}
