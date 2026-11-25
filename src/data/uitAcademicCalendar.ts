import type {
  AchievementItem,
  AttendanceTrendPoint,
  ClassLogEntry,
  ExamItem,
  MarkRecord,
  MonthlyReportSummary,
  NotificationItem,
  StudentProfile,
  StudyTask,
  SubjectRecord,
  TimetableSlot,
  TodayClassSession,
} from '../types/academic';

export const UIT_PRESET_LABEL = 'UIT Sem 1 ECE (Section A)';

export const UIT_PROFILE_DEFAULTS: StudentProfile = {
  id: 'stu_uit_ece_a',
  name: 'Aarav Patel',
  email: 'student@karnavatiuniversity.edu.in',
  studentId: 'UIT-ECE-A-01',
  college: 'Karnavati University (Unitedworld Institute of Technology - UIT)',
  branch: 'B.Tech Electronics & Communication Engineering (ECE) — Section A',
  program: 'B.Tech Electronics & Communication Engineering (ECE) — Section A',
  semester: 'Semester 1 (Odd Semester 2026–27)',
  semesterNumber: 1,
  currentWeek: 18,
  totalWeeks: 21,
  targetAttendance: 75,
  semesterStart: '2026-07-28',
  semesterEnd: '2026-12-16',
  dailyStudyGoalHours: 3,
  alertLowAttendance: true,
  alertExamReminders: true,
  alertWeeklyDigest: true,
  onboardingCompleted: true,
  isGuest: true,
};

export interface UitHolidayEntry {
  id: string;
  dateISO: string;
  endDateISO?: string;
  displayDate: string;
  label: string;
  kind: 'holiday' | 'vacation';
}

export const UIT_SEM1_HOLIDAYS: UitHolidayEntry[] = [
  {
    id: 'hol_ind',
    dateISO: '2026-08-15',
    displayDate: 'Aug 15, 2026',
    label: 'Independence Day',
    kind: 'holiday',
  },
  {
    id: 'hol_rakhi',
    dateISO: '2026-08-28',
    displayDate: 'Aug 28, 2026',
    label: 'Rakshabandhan',
    kind: 'holiday',
  },
  {
    id: 'hol_janm',
    dateISO: '2026-09-04',
    displayDate: 'Sep 04, 2026',
    label: 'Janmashtami',
    kind: 'holiday',
  },
  {
    id: 'hol_ganesh',
    dateISO: '2026-09-14',
    displayDate: 'Sep 14, 2026',
    label: 'Ganesh Chaturthi',
    kind: 'holiday',
  },
  {
    id: 'hol_gandhi',
    dateISO: '2026-10-02',
    displayDate: 'Oct 02, 2026',
    label: 'Gandhi Jayanti',
    kind: 'holiday',
  },
  {
    id: 'hol_dussehra',
    dateISO: '2026-10-20',
    displayDate: 'Oct 20, 2026',
    label: 'Dussehra',
    kind: 'holiday',
  },
  {
    id: 'hol_diwali',
    dateISO: '2026-11-06',
    endDateISO: '2026-11-15',
    displayDate: 'Nov 06 – Nov 15, 2026',
    label: 'Diwali Vacation (10-day break)',
    kind: 'vacation',
  },
  {
    id: 'hol_christmas',
    dateISO: '2026-12-25',
    displayDate: 'Dec 25, 2026',
    label: 'Christmas',
    kind: 'holiday',
  },
];

export const UIT_OFFICIAL_MILESTONES = {
  commencementDate: '2026-07-28',
  midTermDatesLabel: '2026-09-28 to 2026-10-01 & 2026-10-05',
  lastTeachingDay: '2026-12-16',
  endSemDatesLabel: '2026-12-17 to 2026-12-30',
};

const MID_TERM_EXAM_DATES = new Set([
  '2026-09-28',
  '2026-09-29',
  '2026-09-30',
  '2026-10-01',
  '2026-10-05',
]);

export interface CalendarExclusionResult {
  excluded: boolean;
  reason?: string;
  kind?: 'weekend' | 'holiday' | 'vacation' | 'exam';
}

export function getTodayLocalISO(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function isUitAcademicProfile(
  student?: Pick<StudentProfile, 'college' | 'branch' | 'program' | 'semesterEnd'> | null,
): boolean {
  if (!student) return true;
  const hay = `${student.college ?? ''} ${student.branch ?? ''} ${student.program ?? ''}`.toLowerCase();
  if (hay.includes('karnavati') || hay.includes('uit') || hay.includes('ece')) {
    return true;
  }
  return student.semesterEnd === '2026-12-16';
}

export function getUitCalendarExclusion(dateISO: string): CalendarExclusionResult {
  const dt = new Date(`${dateISO}T12:00:00`);
  if (!Number.isFinite(dt.getTime())) {
    return { excluded: false };
  }
  const dayOfWeek = dt.getDay();
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return { excluded: true, reason: 'Weekly Off (Weekend)', kind: 'weekend' };
  }

  for (const hol of UIT_SEM1_HOLIDAYS) {
    if (hol.endDateISO) {
      if (dateISO >= hol.dateISO && dateISO <= hol.endDateISO) {
        return { excluded: true, reason: hol.label, kind: hol.kind };
      }
    } else if (dateISO === hol.dateISO) {
      return { excluded: true, reason: hol.label, kind: hol.kind };
    }
  }

  if (MID_TERM_EXAM_DATES.has(dateISO)) {
    return {
      excluded: true,
      reason: 'Mid-Term Examinations (UIT UG Sem 1)',
      kind: 'exam',
    };
  }

  if (dateISO >= '2026-12-17' && dateISO <= '2026-12-30') {
    return {
      excluded: true,
      reason: 'End Semester Examinations (UIT Sem 1)',
      kind: 'exam',
    };
  }

  return { excluded: false };
}

/**
 * Parses timetable start times such as "07:35 – 10:20" or "01:05 – 01:55"
 * into chronological minutes from midnight (treating 01:00–06:59 as afternoon PM).
 */
export function parseSlotStartMinutes(timeRange: string): number {
  const match = timeRange.match(/(\d{1,2}):(\d{2})/);
  if (!match) return 0;
  let hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours >= 1 && hours <= 6) {
    hours += 12;
  }
  return hours * 60 + minutes;
}

export const UIT_SEM1_SUBJECTS_DEFAULT: SubjectRecord[] = [
  {
    id: 'sub_dti101',
    code: 'DTI-101',
    name: 'Design Thinking and Innovation',
    instructor: 'UIT Design Studio (Lab/Practical Heavy)',
    credits: 3,
    attendedClasses: 13,
    totalClasses: 15,
    weeklyHours: 3,
    gradePoint: 9.1,
    currentGrade: 'A+',
  },
  {
    id: 'sub_beee102',
    code: 'BEEE-102',
    name: 'Basic of Electrical and Electronics Engineering',
    instructor: 'UIT ECE Faculty (Theory + Lab)',
    credits: 4,
    attendedClasses: 27,
    totalClasses: 40,
    weeklyHours: 4,
    gradePoint: 7.8,
    currentGrade: 'B+',
  },
  {
    id: 'sub_math101',
    code: 'MATH-101',
    name: 'Engineering Mathematics-1',
    instructor: 'UIT Mathematics Dept (Theory)',
    credits: 4,
    attendedClasses: 45,
    totalClasses: 54,
    weeklyHours: 4,
    gradePoint: 8.8,
    currentGrade: 'A',
  },
  {
    id: 'sub_pps103',
    code: 'PPS-103',
    name: 'Programming for Problem Solving',
    instructor: 'UIT Computing Faculty (Theory)',
    credits: 4,
    attendedClasses: 29,
    totalClasses: 40,
    weeklyHours: 3,
    gradePoint: 8.2,
    currentGrade: 'A-',
  },
  {
    id: 'sub_edwp104',
    code: 'EDWP-104',
    name: 'Engineering Design and Workshop Practice',
    instructor: 'UIT Workshop Faculty (Theory/Workshop)',
    credits: 3,
    attendedClasses: 33,
    totalClasses: 41,
    weeklyHours: 4,
    gradePoint: 8.6,
    currentGrade: 'A',
  },
  {
    id: 'sub_fai105',
    code: 'FAI-105',
    name: 'Fundamentals of AI',
    instructor: 'UIT AI & DS Faculty (Theory)',
    credits: 3,
    attendedClasses: 34,
    totalClasses: 42,
    weeklyHours: 4,
    gradePoint: 8.9,
    currentGrade: 'A',
  },
  {
    id: 'sub_pdc106',
    code: 'PDC-106',
    name: 'Personality Development and Communication',
    instructor: 'UIT Humanities Faculty (Theory)',
    credits: 2,
    attendedClasses: 25,
    totalClasses: 28,
    weeklyHours: 2,
    gradePoint: 9.2,
    currentGrade: 'A+',
  },
];

export const UIT_SEM1_TIMETABLE: TimetableSlot[] = [
  // Monday (Day 1)
  {
    id: 'tt_uit_mon_1',
    day: 'Monday',
    timeRange: '07:35 – 10:20',
    courseCode: 'DTI-101',
    subjectName: 'Design Thinking and Innovation',
    room: 'MAKERS LAB 4',
    sessionType: 'Laboratory',
    professor: 'Section A · Lab/Studio',
  },
  {
    id: 'tt_uit_mon_2',
    day: 'Monday',
    timeRange: '10:20 – 12:15',
    courseCode: 'BEEE-102',
    subjectName: 'Basic of Electrical and Electronics Engineering',
    room: 'I3',
    sessionType: 'Laboratory',
    professor: 'Section A · Lab',
  },
  {
    id: 'tt_uit_mon_3',
    day: 'Monday',
    timeRange: '01:05 – 01:55',
    courseCode: 'MATH-101',
    subjectName: 'Engineering Mathematics-1',
    room: 'I5',
    sessionType: 'Lecture',
    professor: 'Section A',
  },

  // Tuesday (Day 2)
  {
    id: 'tt_uit_tue_1',
    day: 'Tuesday',
    timeRange: '07:35 – 08:25',
    courseCode: 'PPS-103',
    subjectName: 'Programming for Problem Solving',
    room: 'I16',
    sessionType: 'Lecture',
    professor: 'Section A',
  },
  {
    id: 'tt_uit_tue_2',
    day: 'Tuesday',
    timeRange: '08:25 – 09:15',
    courseCode: 'MATH-101',
    subjectName: 'Engineering Mathematics-1',
    room: 'I16',
    sessionType: 'Lecture',
    professor: 'Section A',
  },
  {
    id: 'tt_uit_tue_3',
    day: 'Tuesday',
    timeRange: '09:30 – 10:20',
    courseCode: 'EDWP-104',
    subjectName: 'Engineering Design and Workshop Practice',
    room: 'I16',
    sessionType: 'Lecture',
    professor: 'Section A',
  },
  {
    id: 'tt_uit_tue_4',
    day: 'Tuesday',
    timeRange: '11:25 – 12:15',
    courseCode: 'PDC-106',
    subjectName: 'Personality Development and Communication',
    room: 'I16',
    sessionType: 'Lecture',
    professor: 'Section A',
  },
  {
    id: 'tt_uit_tue_5',
    day: 'Tuesday',
    timeRange: '01:05 – 01:55',
    courseCode: 'FAI-105',
    subjectName: 'Fundamentals of AI',
    room: 'I16',
    sessionType: 'Lecture',
    professor: 'Section A',
  },

  // Wednesday (Day 3)
  {
    id: 'tt_uit_wed_1',
    day: 'Wednesday',
    timeRange: '07:30 – 09:15',
    courseCode: 'FAI-105',
    subjectName: 'Fundamentals of AI',
    room: 'I16',
    sessionType: 'Lecture',
    professor: 'Section A',
  },
  {
    id: 'tt_uit_wed_2',
    day: 'Wednesday',
    timeRange: '09:30 – 10:20',
    courseCode: 'MATH-101',
    subjectName: 'Engineering Mathematics-1',
    room: 'I16',
    sessionType: 'Lecture',
    professor: 'Section A',
  },
  {
    id: 'tt_uit_wed_3',
    day: 'Wednesday',
    timeRange: '10:20 – 11:10',
    courseCode: 'EDWP-104',
    subjectName: 'Engineering Design and Workshop Practice',
    room: 'I16',
    sessionType: 'Lecture',
    professor: 'Section A',
  },
  {
    id: 'tt_uit_wed_4',
    day: 'Wednesday',
    timeRange: '01:05 – 01:55',
    courseCode: 'PPS-103',
    subjectName: 'Programming for Problem Solving',
    room: 'I16',
    sessionType: 'Lecture',
    professor: 'Section A',
  },

  // Thursday (Day 4)
  {
    id: 'tt_uit_thu_1',
    day: 'Thursday',
    timeRange: '09:30 – 10:20',
    courseCode: 'PPS-103',
    subjectName: 'Programming for Problem Solving',
    room: 'I16',
    sessionType: 'Lecture',
    professor: 'Section A',
  },
  {
    id: 'tt_uit_thu_2',
    day: 'Thursday',
    timeRange: '10:20 – 11:10',
    courseCode: 'BEEE-102',
    subjectName: 'Basic of Electrical and Electronics Engineering',
    room: 'I16',
    sessionType: 'Lecture',
    professor: 'Section A',
  },
  {
    id: 'tt_uit_thu_3',
    day: 'Thursday',
    timeRange: '11:25 – 12:15',
    courseCode: 'PDC-106',
    subjectName: 'Personality Development and Communication',
    room: 'I16',
    sessionType: 'Lecture',
    professor: 'Section A',
  },
  {
    id: 'tt_uit_thu_4',
    day: 'Thursday',
    timeRange: '01:05 – 01:55',
    courseCode: 'FAI-105',
    subjectName: 'Fundamentals of AI',
    room: 'I13',
    sessionType: 'Lecture',
    professor: 'Section A',
  },

  // Friday (Day 5)
  {
    id: 'tt_uit_fri_1',
    day: 'Friday',
    timeRange: '07:30 – 09:15',
    courseCode: 'EDWP-104',
    subjectName: 'Engineering Design and Workshop Practice',
    room: 'I16',
    sessionType: 'Lecture',
    professor: 'Section A',
  },
  {
    id: 'tt_uit_fri_2',
    day: 'Friday',
    timeRange: '09:30 – 10:20',
    courseCode: 'BEEE-102',
    subjectName: 'Basic of Electrical and Electronics Engineering',
    room: 'I16',
    sessionType: 'Lecture',
    professor: 'Section A',
  },
  {
    id: 'tt_uit_fri_3',
    day: 'Friday',
    timeRange: '01:05 – 01:55',
    courseCode: 'MATH-101',
    subjectName: 'Engineering Mathematics-1',
    room: 'I16',
    sessionType: 'Lecture',
    professor: 'Section A',
  },
];

export const UIT_SEM1_TODAY_CLASSES: TodayClassSession[] = [
  {
    id: 'cls_uit_1',
    subjectId: 'sub_fai105',
    courseCode: 'FAI-105',
    subjectName: 'Fundamentals of AI',
    timeRange: '07:30 – 09:15',
    room: 'I16',
    sessionType: 'Lecture',
    status: 'pending',
  },
  {
    id: 'cls_uit_2',
    subjectId: 'sub_math101',
    courseCode: 'MATH-101',
    subjectName: 'Engineering Mathematics-1',
    timeRange: '09:30 – 10:20',
    room: 'I16',
    sessionType: 'Lecture',
    status: 'pending',
  },
  {
    id: 'cls_uit_3',
    subjectId: 'sub_edwp104',
    courseCode: 'EDWP-104',
    subjectName: 'Engineering Design and Workshop Practice',
    timeRange: '10:20 – 11:10',
    room: 'I16',
    sessionType: 'Lecture',
    status: 'pending',
  },
  {
    id: 'cls_uit_4',
    subjectId: 'sub_pps103',
    courseCode: 'PPS-103',
    subjectName: 'Programming for Problem Solving',
    timeRange: '01:05 – 01:55',
    room: 'I16',
    sessionType: 'Lecture',
    status: 'pending',
  },
];

export const UIT_SEM1_EXAMS: ExamItem[] = [
  {
    id: 'ex_uit_midsem',
    courseCode: 'UIT-SEM1',
    subjectName: 'UIT UG Sem 1 (ECE Section A)',
    examTitle: 'Mid-Term Examinations (Sep 28 – Oct 01 & Oct 05)',
    dateISO: '2026-09-28',
    displayDate: 'Sep 28 – Oct 05',
    daysRemaining: 0,
    room: 'UIT Block I',
    syllabusProgress: 100,
    itemType: 'Exam',
    dueTime: '09:30',
  },
  {
    id: 'ex_uit_dti',
    courseCode: 'DTI-101',
    subjectName: 'Design Thinking and Innovation',
    examTitle: 'Studio Prototype Jury & Makers Lab Evaluation',
    dateISO: '2026-12-04',
    displayDate: 'Fri, Dec 04',
    daysRemaining: 9,
    room: 'MAKERS LAB 4',
    syllabusProgress: 76,
    itemType: 'Assignment',
    dueTime: '10:20',
  },
  {
    id: 'ex_uit_beee',
    courseCode: 'BEEE-102',
    subjectName: 'Basic of Electrical and Electronics Engineering',
    examTitle: 'BEEE Circuit Analysis Lab Practical & Viva',
    dateISO: '2026-12-08',
    displayDate: 'Tue, Dec 08',
    daysRemaining: 13,
    room: 'I3',
    syllabusProgress: 64,
    itemType: 'Exam',
    dueTime: '10:20',
  },
  {
    id: 'ex_uit_pps',
    courseCode: 'PPS-103',
    subjectName: 'Programming for Problem Solving',
    examTitle: 'C Programming & Problem Solving Practical Viva',
    dateISO: '2026-12-11',
    displayDate: 'Fri, Dec 11',
    daysRemaining: 16,
    room: 'I16',
    syllabusProgress: 70,
    itemType: 'Quiz',
    dueTime: '09:30',
  },
  {
    id: 'ex_uit_ltd',
    courseCode: 'UIT-SEM1',
    subjectName: 'UIT Odd Semester 2026–27',
    examTitle: 'Last Teaching Day (UIT Sem 1 Attendance Cutoff)',
    dateISO: '2026-12-16',
    displayDate: 'Wed, Dec 16',
    daysRemaining: 21,
    room: 'Karnavati UIT',
    syllabusProgress: 84,
    itemType: 'Exam',
    dueTime: '14:00',
  },
  {
    id: 'ex_uit_endsem',
    courseCode: 'UIT-SEM1',
    subjectName: 'B.Tech ECE (Section A)',
    examTitle: 'End Semester Examinations (Dec 17 – Dec 30)',
    dateISO: '2026-12-17',
    displayDate: 'Dec 17 – Dec 30',
    daysRemaining: 22,
    room: 'UIT Exam Block',
    syllabusProgress: 68,
    itemType: 'Exam',
    dueTime: '09:30',
  },
];

export const UIT_SEM1_STUDY_TASKS: StudyTask[] = [
  {
    id: 'tsk_uit_1',
    title: 'Solve Thevenin & Norton equivalent circuit problem set',
    courseCode: 'BEEE-102',
    dueLabel: 'Today, 19:00',
    estimatedMinutes: 55,
    completed: false,
    linkedExamId: 'ex_uit_beee',
    linkedExamLabel: 'BEEE-102 · BEEE Circuit Analysis Lab Practical & Viva',
  },
  {
    id: 'tsk_uit_2',
    title: 'Practice pointers, recursion & array lab exercises in C',
    courseCode: 'PPS-103',
    dueLabel: 'Tomorrow',
    estimatedMinutes: 50,
    completed: false,
    linkedExamId: 'ex_uit_pps',
    linkedExamLabel: 'PPS-103 · C Programming & Problem Solving Practical Viva',
  },
  {
    id: 'tsk_uit_3',
    title: 'Revise multivariable calculus & partial derivatives tutorial',
    courseCode: 'MATH-101',
    dueLabel: 'Nov 28',
    estimatedMinutes: 45,
    completed: true,
    linkedExamId: 'ex_uit_endsem',
    linkedExamLabel: 'UIT-SEM1 · End Semester Examinations (Dec 17 – Dec 30)',
  },
  {
    id: 'tsk_uit_4',
    title: 'Finalize Makers Lab 4 user-journey & prototype board',
    courseCode: 'DTI-101',
    dueLabel: 'Dec 02',
    estimatedMinutes: 60,
    completed: false,
    linkedExamId: 'ex_uit_dti',
    linkedExamLabel: 'DTI-101 · Studio Prototype Jury & Makers Lab Evaluation',
  },
  {
    id: 'tsk_uit_5',
    title: 'Review search heuristics & supervised ML unit notes',
    courseCode: 'FAI-105',
    dueLabel: 'Dec 05',
    estimatedMinutes: 40,
    completed: true,
    linkedExamId: 'ex_uit_endsem',
    linkedExamLabel: 'UIT-SEM1 · End Semester Examinations (Dec 17 – Dec 30)',
  },
];

export const UIT_SEM1_MARKS: MarkRecord[] = [
  {
    id: 'mrk_uit_1',
    courseCode: 'BEEE-102',
    subjectName: 'Basic of Electrical and Electronics Engineering',
    assessmentTitle: 'Mid-Term Examination (UIT UG Sem 1)',
    assessmentType: 'Exam',
    scoreObtained: 20,
    maxScore: 30,
    weightagePercent: 30,
    dateISO: '2026-09-29',
  },
  {
    id: 'mrk_uit_2',
    courseCode: 'MATH-101',
    subjectName: 'Engineering Mathematics-1',
    assessmentTitle: 'Mid-Term Examination (UIT UG Sem 1)',
    assessmentType: 'Exam',
    scoreObtained: 26,
    maxScore: 30,
    weightagePercent: 30,
    dateISO: '2026-09-28',
  },
  {
    id: 'mrk_uit_3',
    courseCode: 'PPS-103',
    subjectName: 'Programming for Problem Solving',
    assessmentTitle: 'Mid-Term Examination (UIT UG Sem 1)',
    assessmentType: 'Exam',
    scoreObtained: 21,
    maxScore: 30,
    weightagePercent: 30,
    dateISO: '2026-09-30',
  },
  {
    id: 'mrk_uit_4',
    courseCode: 'FAI-105',
    subjectName: 'Fundamentals of AI',
    assessmentTitle: 'Mid-Term Examination (UIT UG Sem 1)',
    assessmentType: 'Exam',
    scoreObtained: 25,
    maxScore: 30,
    weightagePercent: 30,
    dateISO: '2026-10-01',
  },
  {
    id: 'mrk_uit_5',
    courseCode: 'EDWP-104',
    subjectName: 'Engineering Design and Workshop Practice',
    assessmentTitle: 'Workshop CAD & Fabrication Evaluation',
    assessmentType: 'Assignment',
    scoreObtained: 17,
    maxScore: 20,
    weightagePercent: 20,
    dateISO: '2026-11-18',
  },
  {
    id: 'mrk_uit_6',
    courseCode: 'DTI-101',
    subjectName: 'Design Thinking and Innovation',
    assessmentTitle: 'Empathy & Ideation Studio Review',
    assessmentType: 'Assignment',
    scoreObtained: 18,
    maxScore: 20,
    weightagePercent: 20,
    dateISO: '2026-11-16',
  },
];

export const UIT_SEM1_TREND: AttendanceTrendPoint[] = [
  { dateLabel: 'Nov 03', rate: 77.6, attended: 173, held: 223 },
  { dateLabel: 'Nov 04', rate: 77.9, attended: 176, held: 226 },
  { dateLabel: 'Nov 05', rate: 78.2, attended: 180, held: 230 },
  { dateLabel: 'Nov 16', rate: 78.4, attended: 183, held: 233 },
  { dateLabel: 'Nov 17', rate: 78.8, attended: 187, held: 237 },
  { dateLabel: 'Nov 18', rate: 78.6, attended: 190, held: 241 },
  { dateLabel: 'Nov 19', rate: 79.0, attended: 194, held: 245 },
  { dateLabel: 'Nov 20', rate: 78.9, attended: 196, held: 248 },
  { dateLabel: 'Nov 23', rate: 79.1, attended: 199, held: 251 },
  { dateLabel: 'Nov 24', rate: 79.2, attended: 204, held: 257 },
  { dateLabel: 'Nov 25', rate: 79.2, attended: 206, held: 260 },
];

export const UIT_SEM1_NOTIFICATIONS: NotificationItem[] = [
  {
    id: 'not_uit_1',
    title: 'BEEE-102 at 67.5% — Below 75% Target',
    description:
      'Basic of Electrical and Electronics Engineering (27/40) needs 12 consecutive sessions (or full attendance through Dec 16 + extra lab makeups) to clear 75%.',
    timestamp: '2h ago',
    severity: 'critical',
    read: false,
    actionRoute: '/recovery',
  },
  {
    id: 'not_uit_2',
    title: 'PPS-103 at 72.5% — Recovery Window Open',
    description:
      'Programming for Problem Solving (29/40) needs 4 consecutive attended classes in Room I16 before Dec 16 to cross 75%.',
    timestamp: '5h ago',
    severity: 'warning',
    read: false,
    actionRoute: '/predictor',
  },
  {
    id: 'not_uit_3',
    title: 'Last Teaching Day: Wednesday, Dec 16, 2026',
    description:
      'End Semester Examinations (UIT Sem 1) begin Thursday, Dec 17, 2026. Only instructional weekdays before Dec 16 count toward Sem 1 attendance.',
    timestamp: 'Yesterday',
    severity: 'info',
    read: false,
    actionRoute: '/timetable-exams',
  },
];

export const UIT_SEM1_ACHIEVEMENTS: AchievementItem[] = [
  {
    id: 'ach_uit_1',
    title: 'Post-Diwali Attendance Streak',
    criteria: 'Attend 5 consecutive instructional days after Diwali Vacation (Nov 6–15)',
    earned: true,
    earnedDate: 'Nov 20, 2026',
    progressCurrent: 5,
    progressTarget: 5,
  },
  {
    id: 'ach_uit_2',
    title: 'Makers Lab Honor (85%+)',
    criteria: 'Maintain >= 85% standing in Design Thinking and Innovation (DTI-101)',
    earned: true,
    earnedDate: 'Nov 16, 2026',
    progressCurrent: 87,
    progressTarget: 85,
  },
  {
    id: 'ach_uit_3',
    title: 'Zero-Deficit Semester',
    criteria: 'Keep all 7 UIT Sem 1 ECE courses above the 75% benchmark simultaneously',
    earned: false,
    progressCurrent: 5,
    progressTarget: 7,
  },
];

export const UIT_SEM1_REPORTS: MonthlyReportSummary[] = [
  {
    id: 'rep_uit_nov',
    monthLabel: 'November 2026 (MTD)',
    attendanceRate: 81.4,
    classesAttended: 35,
    classesHeld: 43,
    statusLabel: 'Above Target',
    topSubject: 'Personality Development & Comm. (89.3%)',
  },
  {
    id: 'rep_uit_oct',
    monthLabel: 'October 2026',
    attendanceRate: 78.6,
    classesAttended: 66,
    classesHeld: 84,
    statusLabel: 'Above Target',
    topSubject: 'Design Thinking & Innovation (86.7%)',
  },
  {
    id: 'rep_uit_sep',
    monthLabel: 'September 2026',
    attendanceRate: 79.5,
    classesAttended: 62,
    classesHeld: 78,
    statusLabel: 'Above Target',
    topSubject: 'Engineering Mathematics-1 (83.3%)',
  },
];

export const UIT_SEM1_CLASS_LOGS: ClassLogEntry[] = [
  {
    id: 'log_uit_1',
    subjectId: 'sub_math101',
    courseCode: 'MATH-101',
    subjectName: 'Engineering Mathematics-1',
    status: 'present',
    dateISO: '2026-11-24',
    topic: 'Euler Theorem & Homogeneous Partial Derivatives (Room I16)',
  },
  {
    id: 'log_uit_2',
    subjectId: 'sub_pps103',
    courseCode: 'PPS-103',
    subjectName: 'Programming for Problem Solving',
    status: 'present',
    dateISO: '2026-11-24',
    topic: 'Dynamic Memory Allocation & Pointers in C (Room I16)',
  },
  {
    id: 'log_uit_3',
    subjectId: 'sub_beee102',
    courseCode: 'BEEE-102',
    subjectName: 'Basic of Electrical and Electronics Engineering',
    status: 'absent',
    dateISO: '2026-11-23',
    topic: 'AC Bridge & RL/RC Transient Lab (Room I3)',
  },
  {
    id: 'log_uit_4',
    subjectId: 'sub_dti101',
    courseCode: 'DTI-101',
    subjectName: 'Design Thinking and Innovation',
    status: 'present',
    dateISO: '2026-11-23',
    topic: 'Rapid Prototyping Sprint Review (MAKERS LAB 4)',
  },
];

const WEEKDAY_INDEX_TO_NAME: Record<number, TimetableSlot['day']> = {
  1: 'Monday',
  2: 'Tuesday',
  3: 'Wednesday',
  4: 'Thursday',
  5: 'Friday',
};

export interface CalendarWeekBucket {
  weekIndex: number;
  weekLabel: string;
  startDateISO: string;
  endDateISO: string;
  instructionalDays: number;
  sessionsByCourse: Record<string, number>;
}

export interface RemainingCalendarProjection {
  startDateISO: string;
  endDateISO: string;
  instructionalDays: number;
  skippedWeekends: number;
  skippedHolidays: Array<{ dateISO: string; reason: string }>;
  remainingByCourse: Record<string, number>;
  weeklyBuckets: CalendarWeekBucket[];
}

/**
 * Counts exact remaining scheduled timetable sessions between startDateISO and endDateISO
 * (inclusive), skipping weekends, Diwali Vacation (Nov 6–15), listed gazetted holidays,
 * and UIT examination dates.
 */
export function computeRemainingInstructionalCalendar(params: {
  subjects: SubjectRecord[];
  weeklyTimetable: TimetableSlot[];
  startDateISO: string;
  endDateISO: string;
  applyUitExclusions?: boolean;
}): RemainingCalendarProjection {
  const { subjects, weeklyTimetable, startDateISO, endDateISO, applyUitExclusions = true } = params;

  const remainingByCourse: Record<string, number> = {};
  subjects.forEach((s) => {
    remainingByCourse[s.code.toUpperCase()] = 0;
  });

  const start = new Date(`${startDateISO}T12:00:00`);
  const end = new Date(`${endDateISO}T12:00:00`);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || start > end) {
    return {
      startDateISO,
      endDateISO,
      instructionalDays: 0,
      skippedWeekends: 0,
      skippedHolidays: [],
      remainingByCourse,
      weeklyBuckets: [],
    };
  }

  const slotsByWeekday = new Map<TimetableSlot['day'], string[]>();
  weeklyTimetable.forEach((slot) => {
    const arr = slotsByWeekday.get(slot.day) ?? [];
    arr.push(slot.courseCode.toUpperCase());
    slotsByWeekday.set(slot.day, arr);
  });

  let instructionalDays = 0;
  let skippedWeekends = 0;
  const skippedHolidays: Array<{ dateISO: string; reason: string }> = [];
  const bucketMap = new Map<string, CalendarWeekBucket>();

  const cursor = new Date(start);
  let safetyCounter = 0;

  while (cursor <= end && safetyCounter < 365) {
    safetyCounter += 1;
    const y = cursor.getFullYear();
    const m = String(cursor.getMonth() + 1).padStart(2, '0');
    const d = String(cursor.getDate()).padStart(2, '0');
    const iso = `${y}-${m}-${d}`;

    const dayIdx = cursor.getDay();
    const weekdayName = WEEKDAY_INDEX_TO_NAME[dayIdx];

    if (!weekdayName) {
      skippedWeekends += 1;
    } else {
      const exclusion = applyUitExclusions ? getUitCalendarExclusion(iso) : { excluded: false };
      if (exclusion.excluded) {
        skippedHolidays.push({ dateISO: iso, reason: exclusion.reason ?? 'University Holiday' });
      } else {
        instructionalDays += 1;

        // Compute Monday of this week for weekly grouping
        const monday = new Date(cursor);
        monday.setDate(cursor.getDate() - ((dayIdx + 6) % 7));
        const my = monday.getFullYear();
        const mm = String(monday.getMonth() + 1).padStart(2, '0');
        const md = String(monday.getDate()).padStart(2, '0');
        const mondayISO = `${my}-${mm}-${md}`;

        let bucket = bucketMap.get(mondayISO);
        if (!bucket) {
          bucket = {
            weekIndex: bucketMap.size + 1,
            weekLabel: monday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            startDateISO: mondayISO,
            endDateISO: iso,
            instructionalDays: 0,
            sessionsByCourse: {},
          };
          bucketMap.set(mondayISO, bucket);
        }
        bucket.endDateISO = iso;
        bucket.instructionalDays += 1;

        const dayCodes = slotsByWeekday.get(weekdayName) ?? [];
        dayCodes.forEach((code) => {
          remainingByCourse[code] = (remainingByCourse[code] ?? 0) + 1;
          bucket!.sessionsByCourse[code] = (bucket!.sessionsByCourse[code] ?? 0) + 1;
        });
      }
    }

    cursor.setDate(cursor.getDate() + 1);
  }

  // Fallback for courses added manually without timetable slots
  subjects.forEach((sub) => {
    const code = sub.code.toUpperCase();
    const hasTimetableSlot = weeklyTimetable.some((s) => s.courseCode.toUpperCase() === code);
    if (!hasTimetableSlot && instructionalDays > 0) {
      remainingByCourse[code] = Math.round((sub.weeklyHours / 5) * instructionalDays);
    }
  });

  return {
    startDateISO,
    endDateISO,
    instructionalDays,
    skippedWeekends,
    skippedHolidays,
    remainingByCourse,
    weeklyBuckets: Array.from(bucketMap.values()),
  };
}
