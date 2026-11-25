export type AttendanceStatus = 'pending' | 'present' | 'absent';

export type SubjectStanding = 'on_track' | 'watch' | 'at_risk';

export interface StudentProfile {
  id: string;
  name: string;
  email: string;
  studentId: string;
  college?: string;
  branch?: string;
  program: string;
  semester: string;
  semesterNumber?: number;
  currentWeek: number;
  totalWeeks: number;
  targetAttendance: number;
  semesterStart: string;
  semesterEnd: string;
  dailyStudyGoalHours?: number;
  alertLowAttendance?: boolean;
  alertExamReminders?: boolean;
  alertWeeklyDigest?: boolean;
  onboardingCompleted?: boolean;
  isGuest: boolean;
}

export type AssessmentCategory = 'Exam' | 'Quiz' | 'Assignment';

export interface MarkRecord {
  id: string;
  courseCode: string;
  subjectName: string;
  assessmentTitle: string;
  assessmentType?: AssessmentCategory;
  scoreObtained: number;
  maxScore: number;
  weightagePercent: number;
  dateISO: string;
}

export interface SubjectRecord {
  id: string;
  code: string;
  name: string;
  instructor: string;
  credits: number;
  attendedClasses: number;
  totalClasses: number;
  weeklyHours: number;
  gradePoint: number;
  currentGrade: string;
  targetAttendance?: number;
}

export type ClassLogStatus = 'present' | 'absent' | 'cancelled';

export interface ClassLogEntry {
  id: string;
  subjectId: string;
  courseCode: string;
  subjectName: string;
  status: ClassLogStatus;
  dateISO: string;
  topic: string;
  timetableSlotId?: string;
}

export interface TodayClassSession {
  id: string;
  subjectId: string;
  courseCode: string;
  subjectName: string;
  timeRange: string;
  room: string;
  sessionType: 'Lecture' | 'Laboratory' | 'Tutorial';
  status: AttendanceStatus;
}

export interface ExamItem {
  id: string;
  courseCode: string;
  subjectName: string;
  examTitle: string;
  dateISO: string;
  displayDate: string;
  daysRemaining: number;
  room: string;
  syllabusProgress: number;
  itemType?: 'Exam' | 'Assignment' | 'Quiz';
  dueTime?: string;
}

export interface StudyTask {
  id: string;
  title: string;
  courseCode: string;
  dueLabel: string;
  estimatedMinutes: number;
  completed: boolean;
  linkedExamId?: string;
  linkedExamLabel?: string;
}

export interface AttendanceTrendPoint {
  dateLabel: string;
  rate: number;
  attended: number;
  held: number;
}

export interface NotificationItem {
  id: string;
  title: string;
  description: string;
  timestamp: string;
  severity: 'critical' | 'warning' | 'info' | 'milestone';
  read: boolean;
  actionRoute: string;
}

export interface TimetableSlot {
  id: string;
  day: 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday';
  timeRange: string;
  courseCode: string;
  subjectName: string;
  room: string;
  sessionType: 'Lecture' | 'Laboratory' | 'Tutorial';
  professor?: string;
}

export interface AchievementItem {
  id: string;
  title: string;
  criteria: string;
  earned: boolean;
  earnedDate?: string;
  progressCurrent: number;
  progressTarget: number;
}

export interface MonthlyReportSummary {
  id: string;
  monthLabel: string;
  attendanceRate: number;
  classesAttended: number;
  classesHeld: number;
  statusLabel: string;
  topSubject: string;
}
