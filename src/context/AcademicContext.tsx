import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
} from 'firebase/auth';
import { auth, googleProvider, isFirebaseConfigured } from '../config/firebase';
import {
  createAttendanceLogDoc,
  createExamDoc,
  createMarkDoc,
  createMonthlyReportDoc,
  createStudyTaskDoc,
  createSubjectDoc,
  createTimetableSlotDoc,
  deleteAttendanceLogDoc,
  deleteExamDoc,
  deleteMarkDoc,
  deleteStudyTaskDoc,
  deleteSubjectDoc,
  deleteTimetableSlotDoc,
  resetAndSeedUserData,
  seedInitialStudentDataIfEmpty,
  subscribeAchievements,
  subscribeAttendanceLogs,
  subscribeExams,
  subscribeMarks,
  subscribeMonthlyReports,
  subscribeNotifications,
  subscribeStudyTasks,
  subscribeSubjects,
  subscribeTimetable,
  subscribeUserProfile,
  updateAttendanceLogDoc,
  updateExamDoc,
  updateNotificationDoc,
  updateStudyTaskDoc,
  updateSubjectDoc,
  upsertUserProfile,
} from '../services/firestoreService';
import type {
  AchievementItem,
  AssessmentCategory,
  AttendanceStatus,
  AttendanceTrendPoint,
  ClassLogEntry,
  ClassLogStatus,
  ExamItem,
  MarkRecord,
  MonthlyReportSummary,
  NotificationItem,
  StudentProfile,
  StudyTask,
  SubjectRecord,
  SubjectStanding,
  TimetableSlot,
  TodayClassSession,
} from '../types/academic';
import { calculateRecoveryMetrics, deriveStanding } from '../utils/attendanceMath';
import {
  UIT_PROFILE_DEFAULTS,
  UIT_SEM1_ACHIEVEMENTS,
  UIT_SEM1_CLASS_LOGS,
  UIT_SEM1_EXAMS,
  UIT_SEM1_MARKS,
  UIT_SEM1_NOTIFICATIONS,
  UIT_SEM1_REPORTS,
  UIT_SEM1_STUDY_TASKS,
  UIT_SEM1_SUBJECTS_DEFAULT,
  UIT_SEM1_TIMETABLE,
  UIT_SEM1_TODAY_CLASSES,
  UIT_SEM1_TREND,
  parseSlotStartMinutes,
} from '../data/uitAcademicCalendar';
import { useToast } from './ToastContext';

export interface SubjectFormInput {
  code: string;
  name: string;
  instructor: string;
  credits: number;
  attendedClasses: number;
  totalClasses: number;
  weeklyHours: number;
  targetAttendance?: number;
}

export interface ImportedSubjectRow {
  matchedSubjectId?: string;
  code: string;
  name: string;
  attendedClasses: number;
  totalClasses: number;
}

export interface MarkFormInput {
  courseCode: string;
  subjectName: string;
  assessmentTitle: string;
  assessmentType?: AssessmentCategory;
  scoreObtained: number;
  maxScore: number;
  weightagePercent: number;
  dateISO: string;
}

export interface TimetableSlotFormInput {
  day: TimetableSlot['day'];
  timeRange: string;
  courseCode: string;
  subjectName: string;
  room: string;
  sessionType: TimetableSlot['sessionType'];
  professor?: string;
}

export interface ExamFormInput {
  courseCode: string;
  subjectName: string;
  examTitle: string;
  dateISO: string;
  dueTime?: string;
  room: string;
  itemType: 'Exam' | 'Assignment' | 'Quiz';
  syllabusProgress?: number;
}

export interface StudyTaskFormInput {
  title: string;
  courseCode: string;
  dueLabel: string;
  estimatedMinutes: number;
  linkedExamId?: string;
  linkedExamLabel?: string;
}

interface AcademicContextValue {
  student: StudentProfile;
  isAuthenticated: boolean;
  isAuthLoading: boolean;
  isDataLoading: boolean;
  isFirebaseLive: boolean;
  subjects: SubjectRecord[];
  classLogs: ClassLogEntry[];
  todayClasses: TodayClassSession[];
  exams: ExamItem[];
  studyTasks: StudyTask[];
  marks: MarkRecord[];
  attendanceTrend: AttendanceTrendPoint[];
  notifications: NotificationItem[];
  weeklyTimetable: TimetableSlot[];
  achievements: AchievementItem[];
  monthlyReports: MonthlyReportSummary[];
  overallStats: {
    attended: number;
    total: number;
    percentage: number;
    marginDelta: number;
    standing: SubjectStanding;
  };
  unreadCount: number;
  login: (email: string, password: string) => Promise<void>;
  register: (
    name: string,
    email: string,
    password: string,
    program: string,
    semester: string,
  ) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  loginAsGuest: () => void;
  logout: () => Promise<void>;
  todayDateISO: string;
  todayWeekday: string;
  todayScheduledSlots: TimetableSlot[];
  checkInTimetableSlot: (slot: TimetableSlot, status: ClassLogStatus) => Promise<void>;
  undoTimetableCheckIn: (slot: TimetableSlot) => Promise<void>;
  markTodayClass: (sessionId: string, nextStatus: AttendanceStatus) => Promise<void>;
  adjustSubjectAttendance: (
    subjectId: string,
    deltaAttended: number,
    deltaTotal: number,
  ) => Promise<void>;
  addSubject: (input: SubjectFormInput) => Promise<void>;
  updateSubject: (subjectId: string, input: SubjectFormInput) => Promise<void>;
  bulkSyncImportedSubjects: (rows: ImportedSubjectRow[]) => Promise<void>;
  deleteSubject: (subjectId: string) => Promise<void>;
  logClassSession: (input: {
    subjectId: string;
    status: ClassLogStatus;
    dateISO: string;
    topic: string;
    timetableSlotId?: string;
  }) => Promise<void>;
  updateClassLog: (
    logId: string,
    updates: {
      subjectId: string;
      status: ClassLogStatus;
      dateISO: string;
      topic: string;
    },
  ) => Promise<void>;
  deleteClassLog: (logId: string) => Promise<void>;
  addTimetableSlot: (input: TimetableSlotFormInput) => Promise<void>;
  deleteTimetableSlot: (slotId: string) => Promise<void>;
  markTimetableSlotAttended: (slot: TimetableSlot) => Promise<void>;
  addExamItem: (input: ExamFormInput) => Promise<void>;
  updateExamSyllabus: (examId: string, progress: number) => Promise<void>;
  deleteExamItem: (examId: string) => Promise<void>;
  toggleStudyTask: (taskId: string) => Promise<void>;
  addStudyTask: (input: StudyTaskFormInput) => Promise<void>;
  deleteStudyTask: (taskId: string) => Promise<void>;
  updateDailyStudyGoal: (hours: number) => Promise<void>;
  addMarkRecord: (input: MarkFormInput) => Promise<void>;
  deleteMarkRecord: (markId: string) => Promise<void>;
  generateMonthlyReportSnapshot: () => Promise<void>;
  markNotificationRead: (notificationId: string) => Promise<void>;
  markAllNotificationsRead: () => Promise<void>;
  updateTargetAttendance: (target: number) => Promise<void>;
  updateStudentProfile: (
    updates: Partial<
      Pick<
        StudentProfile,
        | 'name'
        | 'studentId'
        | 'college'
        | 'branch'
        | 'program'
        | 'semester'
        | 'semesterNumber'
        | 'semesterStart'
        | 'semesterEnd'
        | 'onboardingCompleted'
      >
    >,
  ) => Promise<void>;
  completeOnboarding: (payload: {
    name: string;
    college: string;
    branch: string;
    semesterNumber: number;
    studentId: string;
    targetAttendance: number;
    semesterStart: string;
    semesterEnd: string;
    loadUitSchedulePreset?: boolean;
    initialSubjects: Array<{
      code: string;
      name: string;
      credits: number;
      weeklyHours: number;
      attendedClasses: number;
      totalClasses: number;
    }>;
  }) => Promise<void>;
  skipOnboarding: () => Promise<void>;
  loadUitSem1Preset: () => Promise<void>;
  updateAlertPreferences: (
    updates: Partial<Pick<StudentProfile, 'alertLowAttendance' | 'alertExamReminders' | 'alertWeeklyDigest'>>,
  ) => Promise<void>;
  resetSampleData: () => Promise<void>;
  getEffectiveTarget: (subject?: SubjectRecord | null) => number;
  getSubjectStanding: (attended: number, total: number, targetPercent?: number) => SubjectStanding;
  getClassesNeededForTarget: (attended: number, total: number, targetPercent?: number) => number;
  getSafeBunksAvailable: (attended: number, total: number, targetPercent?: number) => number;
}

const DEFAULT_STUDENT: StudentProfile = UIT_PROFILE_DEFAULTS;
const INITIAL_SUBJECTS: SubjectRecord[] = UIT_SEM1_SUBJECTS_DEFAULT;
const INITIAL_TODAY_CLASSES: TodayClassSession[] = UIT_SEM1_TODAY_CLASSES;
const INITIAL_EXAMS: ExamItem[] = UIT_SEM1_EXAMS;
const INITIAL_STUDY_TASKS: StudyTask[] = UIT_SEM1_STUDY_TASKS;
const INITIAL_MARKS: MarkRecord[] = UIT_SEM1_MARKS;
const INITIAL_TREND: AttendanceTrendPoint[] = UIT_SEM1_TREND;
const INITIAL_NOTIFICATIONS: NotificationItem[] = UIT_SEM1_NOTIFICATIONS;
const INITIAL_TIMETABLE: TimetableSlot[] = UIT_SEM1_TIMETABLE;
const INITIAL_ACHIEVEMENTS: AchievementItem[] = UIT_SEM1_ACHIEVEMENTS;
const INITIAL_REPORTS: MonthlyReportSummary[] = UIT_SEM1_REPORTS;
const INITIAL_CLASS_LOGS: ClassLogEntry[] = UIT_SEM1_CLASS_LOGS;

const AUTH_STORAGE_KEY = 'attendiq_guest_mode_v1';

const AcademicContext = createContext<AcademicContextValue | null>(null);

export function AcademicProvider({ children }: { children: React.ReactNode }) {
  const { showToast } = useToast();

  const [firebaseUid, setFirebaseUid] = useState<string | null>(null);
  const [guestMode, setGuestMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem(AUTH_STORAGE_KEY) === 'guest';
    } catch {
      return false;
    }
  });
  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(isFirebaseConfigured);
  const [isDataLoading, setIsDataLoading] = useState<boolean>(false);

  const [student, setStudent] = useState<StudentProfile>(DEFAULT_STUDENT);
  const [subjects, setSubjects] = useState<SubjectRecord[]>(INITIAL_SUBJECTS);
  const [classLogs, setClassLogs] = useState<ClassLogEntry[]>(INITIAL_CLASS_LOGS);
  const [todayClasses, setTodayClasses] = useState<TodayClassSession[]>(INITIAL_TODAY_CLASSES);
  const [exams, setExams] = useState<ExamItem[]>(INITIAL_EXAMS);
  const [studyTasks, setStudyTasks] = useState<StudyTask[]>(INITIAL_STUDY_TASKS);
  const [marks, setMarks] = useState<MarkRecord[]>(INITIAL_MARKS);
  const [attendanceTrend, setAttendanceTrend] = useState<AttendanceTrendPoint[]>(INITIAL_TREND);
  const [notifications, setNotifications] = useState<NotificationItem[]>(INITIAL_NOTIFICATIONS);
  const [weeklyTimetable, setWeeklyTimetable] = useState<TimetableSlot[]>(INITIAL_TIMETABLE);
  const [achievements, setAchievements] = useState<AchievementItem[]>(INITIAL_ACHIEVEMENTS);
  const [monthlyReports, setMonthlyReports] = useState<MonthlyReportSummary[]>(INITIAL_REPORTS);

  const isFirebaseLive = Boolean(isFirebaseConfigured && firebaseUid && !guestMode);
  const isAuthenticated = Boolean(firebaseUid || guestMode);

  // Firebase Auth listener
  useEffect(() => {
    if (!isFirebaseConfigured || !auth) {
      setIsAuthLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, (fbUser) => {
      if (fbUser) {
        setFirebaseUid(fbUser.uid);
        setGuestMode(false);
        try {
          localStorage.removeItem(AUTH_STORAGE_KEY);
        } catch {
          // ignore
        }
        setStudent((prev) => ({
          ...prev,
          id: fbUser.uid,
          name: fbUser.displayName || prev.name,
          email: fbUser.email || prev.email,
          isGuest: false,
        }));
      } else {
        setFirebaseUid(null);
      }
      setIsAuthLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Firestore real-time subscriptions for all 10 collections when signed in with Firebase
  useEffect(() => {
    if (!isFirebaseConfigured || !firebaseUid || !auth?.currentUser) {
      return;
    }

    const currentAuthUser = auth.currentUser;
    let cancelled = false;
    setIsDataLoading(true);
    const unsubs: Array<() => void> = [];

    const setupFirestore = async () => {
      try {
        await seedInitialStudentDataIfEmpty(firebaseUid, currentAuthUser, {
          profile: DEFAULT_STUDENT,
          subjects: INITIAL_SUBJECTS,
          classLogs: INITIAL_CLASS_LOGS,
          timetable: INITIAL_TIMETABLE,
          exams: INITIAL_EXAMS,
          studyTasks: INITIAL_STUDY_TASKS,
          marks: INITIAL_MARKS,
          notifications: INITIAL_NOTIFICATIONS,
          achievements: INITIAL_ACHIEVEMENTS,
          monthlyReports: INITIAL_REPORTS,
        });
      } catch (error) {
        console.error('Failed to seed initial Firestore data:', error);
      }

      if (cancelled) return;

      unsubs.push(
        subscribeUserProfile(firebaseUid, (profileDoc: Partial<StudentProfile> | null) => {
          if (profileDoc) {
            setStudent((prev) => ({
              ...prev,
              id: firebaseUid,
              name: profileDoc.name ?? prev.name,
              email: profileDoc.email ?? prev.email,
              studentId: profileDoc.studentId ?? '',
              college: profileDoc.college ?? '',
              branch: profileDoc.branch ?? profileDoc.program ?? prev.branch,
              program: profileDoc.program ?? profileDoc.branch ?? prev.program,
              semester: profileDoc.semester ?? prev.semester,
              semesterNumber: profileDoc.semesterNumber ?? prev.semesterNumber,
              currentWeek: profileDoc.currentWeek ?? prev.currentWeek,
              totalWeeks: profileDoc.totalWeeks ?? prev.totalWeeks,
              targetAttendance: profileDoc.targetAttendance ?? 75,
              semesterStart: profileDoc.semesterStart ?? prev.semesterStart,
              semesterEnd: profileDoc.semesterEnd ?? prev.semesterEnd,
              dailyStudyGoalHours: profileDoc.dailyStudyGoalHours ?? prev.dailyStudyGoalHours ?? 3,
              alertLowAttendance: profileDoc.alertLowAttendance ?? prev.alertLowAttendance ?? true,
              alertExamReminders: profileDoc.alertExamReminders ?? prev.alertExamReminders ?? true,
              alertWeeklyDigest: profileDoc.alertWeeklyDigest ?? prev.alertWeeklyDigest ?? true,
              onboardingCompleted: profileDoc.onboardingCompleted ?? true,
              isGuest: false,
            }));
          }
          setIsDataLoading(false);
        }),
      );

      unsubs.push(
        subscribeSubjects(firebaseUid, (items: SubjectRecord[]) => {
          setSubjects(items);
        }),
      );
      unsubs.push(
        subscribeAttendanceLogs(firebaseUid, (items: ClassLogEntry[]) => {
          const sorted = [...items].sort((a, b) => b.dateISO.localeCompare(a.dateISO));
          setClassLogs(sorted);
        }),
      );
      unsubs.push(
        subscribeTimetable(firebaseUid, (items: TimetableSlot[]) => {
          setWeeklyTimetable(items);
        }),
      );
      unsubs.push(
        subscribeExams(firebaseUid, (items: ExamItem[]) => {
          const sorted = [...items].sort((a, b) => a.daysRemaining - b.daysRemaining);
          setExams(sorted);
        }),
      );
      unsubs.push(
        subscribeStudyTasks(firebaseUid, (items: StudyTask[]) => {
          setStudyTasks(items);
        }),
      );
      unsubs.push(
        subscribeMarks(firebaseUid, (items: MarkRecord[]) => {
          setMarks(items);
        }),
      );
      unsubs.push(
        subscribeNotifications(firebaseUid, (items: NotificationItem[]) => {
          setNotifications(items);
        }),
      );
      unsubs.push(
        subscribeAchievements(firebaseUid, (items: AchievementItem[]) => {
          setAchievements(items);
        }),
      );
      unsubs.push(
        subscribeMonthlyReports(firebaseUid, (items: MonthlyReportSummary[]) => {
          setMonthlyReports(items);
        }),
      );
    };

    void setupFirestore();

    return () => {
      cancelled = true;
      unsubs.forEach((fn) => fn());
    };
  }, [firebaseUid]);

  // Keep today's classes synchronized with subject IDs/names when Firestore subjects load
  useEffect(() => {
    if (subjects.length === 0) return;
    setTodayClasses((prev) =>
      prev.map((cls) => {
        const match = subjects.find((s) => s.code === cls.courseCode);
        return match
          ? { ...cls, subjectId: match.id, subjectName: match.name }
          : cls;
      }),
    );
  }, [subjects]);

  const getEffectiveTarget = (subject?: SubjectRecord | null): number => {
    if (subject?.targetAttendance !== undefined && Number.isFinite(subject.targetAttendance)) {
      return subject.targetAttendance;
    }
    return student.targetAttendance;
  };

  const getSubjectStanding = (
    attended: number,
    total: number,
    targetPercent = student.targetAttendance,
  ): SubjectStanding => {
    return deriveStanding(attended, total, targetPercent);
  };

  const getClassesNeededForTarget = (
    attended: number,
    total: number,
    targetPercent = student.targetAttendance,
  ): number => {
    return calculateRecoveryMetrics(attended, total, targetPercent).classesNeeded;
  };

  const getSafeBunksAvailable = (
    attended: number,
    total: number,
    targetPercent = student.targetAttendance,
  ): number => {
    return calculateRecoveryMetrics(attended, total, targetPercent).safeToMiss;
  };

  const { todayDateISO, todayWeekday } = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const weekday = now.toLocaleDateString('en-US', { weekday: 'long' });
    return {
      todayDateISO: `${year}-${month}-${day}`,
      todayWeekday: weekday,
    };
  }, []);

  const todayScheduledSlots = useMemo(() => {
    return weeklyTimetable
      .filter((slot) => slot.day === todayWeekday)
      .sort((a, b) => parseSlotStartMinutes(a.timeRange) - parseSlotStartMinutes(b.timeRange));
  }, [weeklyTimetable, todayWeekday]);

  const overallStats = useMemo(() => {
    const totals = subjects.reduce(
      (acc, sub) => ({
        attended: acc.attended + sub.attendedClasses,
        total: acc.total + sub.totalClasses,
      }),
      { attended: 0, total: 0 },
    );
    const percentage =
      totals.total > 0 ? Number(((totals.attended / totals.total) * 100).toFixed(1)) : 0;
    const marginDelta = Number((percentage - student.targetAttendance).toFixed(1));
    const standing = getSubjectStanding(totals.attended, totals.total);
    return {
      attended: totals.attended,
      total: totals.total,
      percentage,
      marginDelta,
      standing,
    };
  }, [subjects, student.targetAttendance]);

  const unreadCount = useMemo(
    () => notifications.filter((item) => !item.read).length,
    [notifications],
  );

  const syncTodayTrendPoint = (updatedSubjects: SubjectRecord[]) => {
    const totals = updatedSubjects.reduce(
      (acc, sub) => ({
        attended: acc.attended + sub.attendedClasses,
        total: acc.total + sub.totalClasses,
      }),
      { attended: 0, total: 0 },
    );
    const nextRate =
      totals.total > 0 ? Number(((totals.attended / totals.total) * 100).toFixed(1)) : 0;
    setAttendanceTrend((prev) =>
      prev.map((point, index) =>
        index === prev.length - 1
          ? {
              ...point,
              rate: nextRate,
              attended: totals.attended,
              held: totals.total,
            }
          : point,
      ),
    );
  };

  const login = async (email: string, password: string) => {
    if (isFirebaseConfigured && auth) {
      await signInWithEmailAndPassword(auth, email, password);
      showToast('Signed in to AttendIQ cloud sync', 'success');
      return;
    }

    const cleanName = email
      .split('@')[0]
      .replace(/[._-]/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());
    setStudent((prev) => ({
      ...prev,
      name: cleanName || prev.name,
      email: email || prev.email,
      isGuest: false,
    }));
    setGuestMode(true);
    try {
      localStorage.setItem(AUTH_STORAGE_KEY, 'guest');
    } catch {
      // ignore
    }
    showToast('Signed in (offline/demo storage)', 'info');
  };

  const register = async (
    name: string,
    email: string,
    password: string,
    program: string,
    semester: string,
  ) => {
    if (isFirebaseConfigured && auth) {
      const credential = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(credential.user, { displayName: name.trim() });
      const newProfile: StudentProfile = {
        ...DEFAULT_STUDENT,
        id: credential.user.uid,
        name: name.trim(),
        email: email.trim(),
        studentId: '',
        college: '',
        branch: program.trim() || DEFAULT_STUDENT.branch,
        program: program.trim() || DEFAULT_STUDENT.program,
        semester: semester.trim() || DEFAULT_STUDENT.semester,
        onboardingCompleted: false,
        isGuest: false,
      };
      setStudent(newProfile);
      await upsertUserProfile(credential.user.uid, newProfile, true);
      showToast('Account created — complete your quick setup', 'success');
      return;
    }

    setSubjects([]);
    setStudent((prev) => ({
      ...prev,
      name: name.trim() || prev.name,
      email: email.trim() || prev.email,
      studentId: '',
      college: '',
      branch: program.trim() || prev.branch,
      program: program.trim() || prev.program,
      semester: semester.trim() || prev.semester,
      onboardingCompleted: false,
      isGuest: false,
    }));
    setGuestMode(true);
    try {
      localStorage.setItem(AUTH_STORAGE_KEY, 'guest');
    } catch {
      // ignore
    }
    showToast('Account created — complete your quick setup', 'info');
  };

  const loginWithGoogle = async () => {
    if (!isFirebaseConfigured || !auth || !googleProvider) {
      throw new Error('Firebase configuration keys are missing. Use Guest Student mode instead.');
    }
    await signInWithPopup(auth, googleProvider);
    showToast('Signed in with Google', 'success');
  };

  const loginAsGuest = () => {
    setStudent(DEFAULT_STUDENT);
    setSubjects(INITIAL_SUBJECTS);
    setClassLogs(INITIAL_CLASS_LOGS);
    setTodayClasses(INITIAL_TODAY_CLASSES);
    setExams(INITIAL_EXAMS);
    setStudyTasks(INITIAL_STUDY_TASKS);
    setMarks(INITIAL_MARKS);
    setNotifications(INITIAL_NOTIFICATIONS);
    setWeeklyTimetable(INITIAL_TIMETABLE);
    setAchievements(INITIAL_ACHIEVEMENTS);
    setMonthlyReports(INITIAL_REPORTS);
    setGuestMode(true);
    try {
      localStorage.setItem(AUTH_STORAGE_KEY, 'guest');
    } catch {
      // ignore
    }
    showToast('Entered Guest Student demo workspace', 'info');
  };

  const logout = async () => {
    if (isFirebaseConfigured && auth && firebaseUid) {
      await signOut(auth);
    }
    setFirebaseUid(null);
    setGuestMode(false);
    try {
      localStorage.removeItem(AUTH_STORAGE_KEY);
    } catch {
      // ignore
    }
    showToast('Signed out', 'info');
  };

  const markTodayClass = async (sessionId: string, nextStatus: AttendanceStatus) => {
    const targetSession = todayClasses.find((cls) => cls.id === sessionId);
    if (!targetSession) return;

    const prevStatus = targetSession.status;
    if (prevStatus === nextStatus) return;

    let deltaAttended = 0;
    let deltaTotal = 0;

    if (prevStatus === 'pending' && nextStatus === 'present') {
      deltaAttended = 1;
      deltaTotal = 1;
    } else if (prevStatus === 'pending' && nextStatus === 'absent') {
      deltaAttended = 0;
      deltaTotal = 1;
    } else if (prevStatus === 'present' && nextStatus === 'absent') {
      deltaAttended = -1;
      deltaTotal = 0;
    } else if (prevStatus === 'absent' && nextStatus === 'present') {
      deltaAttended = 1;
      deltaTotal = 0;
    } else if (prevStatus === 'present' && nextStatus === 'pending') {
      deltaAttended = -1;
      deltaTotal = -1;
    } else if (prevStatus === 'absent' && nextStatus === 'pending') {
      deltaAttended = 0;
      deltaTotal = -1;
    }

    setTodayClasses((prev) =>
      prev.map((cls) => (cls.id === sessionId ? { ...cls, status: nextStatus } : cls)),
    );

    const targetSubject = subjects.find((s) => s.id === targetSession.subjectId);
    if (!targetSubject) return;

    const nextTotal = Math.max(0, targetSubject.totalClasses + deltaTotal);
    const nextAttended = Math.min(
      nextTotal,
      Math.max(0, targetSubject.attendedClasses + deltaAttended),
    );

    const updatedSubjects = subjects.map((sub) =>
      sub.id === targetSubject.id
        ? { ...sub, attendedClasses: nextAttended, totalClasses: nextTotal }
        : sub,
    );
    setSubjects(updatedSubjects);
    syncTodayTrendPoint(updatedSubjects);

    if (isFirebaseLive) {
      await updateSubjectDoc(targetSubject.id, {
        ...targetSubject,
        attendedClasses: nextAttended,
        totalClasses: nextTotal,
      });
    }
    showToast(
      nextStatus === 'pending'
        ? `Cleared today’s status for ${targetSession.courseCode}`
        : `Marked ${targetSession.courseCode} ${nextStatus}`,
      'success',
    );
  };

  const adjustSubjectAttendance = async (
    subjectId: string,
    deltaAttended: number,
    deltaTotal: number,
  ) => {
    const targetSubject = subjects.find((s) => s.id === subjectId);
    if (!targetSubject) return;

    const nextTotal = Math.max(1, targetSubject.totalClasses + deltaTotal);
    const nextAttended = Math.min(
      nextTotal,
      Math.max(0, targetSubject.attendedClasses + deltaAttended),
    );

    const updatedSubjects = subjects.map((sub) =>
      sub.id === subjectId
        ? { ...sub, attendedClasses: nextAttended, totalClasses: nextTotal }
        : sub,
    );
    setSubjects(updatedSubjects);
    syncTodayTrendPoint(updatedSubjects);

    if (isFirebaseLive) {
      await updateSubjectDoc(subjectId, {
        ...targetSubject,
        attendedClasses: nextAttended,
        totalClasses: nextTotal,
      });
    }
    showToast(`Updated ${targetSubject.code} attendance`, 'success');
  };

  const statusImpact = (status: ClassLogStatus): { attended: number; total: number } => {
    if (status === 'present') return { attended: 1, total: 1 };
    if (status === 'absent') return { attended: 0, total: 1 };
    return { attended: 0, total: 0 };
  };

  const findCheckInLogForSlot = (slot: TimetableSlot): ClassLogEntry | undefined => {
    return classLogs.find(
      (log) =>
        log.dateISO === todayDateISO &&
        (log.timetableSlotId === slot.id ||
          (log.courseCode.toUpperCase() === slot.courseCode.toUpperCase() &&
            log.topic.includes(slot.timeRange))),
    );
  };

  const checkInTimetableSlot = async (slot: TimetableSlot, nextStatus: ClassLogStatus) => {
    const targetSubject = subjects.find(
      (s) =>
        s.code.toUpperCase() === slot.courseCode.toUpperCase() ||
        s.name.toLowerCase() === slot.subjectName.toLowerCase(),
    );
    if (!targetSubject) {
      showToast(`No enrolled subject matched ${slot.courseCode}. Add it first to track attendance.`, 'error');
      return;
    }

    const existingLog = findCheckInLogForSlot(slot);
    if (existingLog && existingLog.status === nextStatus) {
      return;
    }

    const oldImpact = existingLog ? statusImpact(existingLog.status) : { attended: 0, total: 0 };
    const newImpact = statusImpact(nextStatus);
    const deltaA = newImpact.attended - oldImpact.attended;
    const deltaT = newImpact.total - oldImpact.total;

    const nextTotal = Math.max(0, targetSubject.totalClasses + deltaT);
    const nextAttended = Math.min(nextTotal, Math.max(0, targetSubject.attendedClasses + deltaA));

    const updatedSubjects = subjects.map((sub) =>
      sub.id === targetSubject.id
        ? { ...sub, attendedClasses: nextAttended, totalClasses: nextTotal }
        : sub,
    );
    setSubjects(updatedSubjects);
    syncTodayTrendPoint(updatedSubjects);

    const topicText = `${slot.subjectName} (${slot.sessionType} · ${slot.timeRange})`;

    if (isFirebaseLive && firebaseUid) {
      if (existingLog) {
        await updateAttendanceLogDoc(existingLog.id, {
          status: nextStatus,
          timetableSlotId: slot.id,
        });
      } else {
        await createAttendanceLogDoc(firebaseUid, {
          subjectId: targetSubject.id,
          courseCode: targetSubject.code,
          subjectName: targetSubject.name,
          status: nextStatus,
          dateISO: todayDateISO,
          topic: topicText,
          timetableSlotId: slot.id,
        });
      }
      if (deltaA !== 0 || deltaT !== 0) {
        await updateSubjectDoc(targetSubject.id, {
          ...targetSubject,
          attendedClasses: nextAttended,
          totalClasses: nextTotal,
        });
      }
    } else if (existingLog) {
      setClassLogs((prev) =>
        prev.map((log) =>
          log.id === existingLog.id
            ? { ...log, status: nextStatus, timetableSlotId: slot.id }
            : log,
        ),
      );
    } else {
      const localLog: ClassLogEntry = {
        id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        subjectId: targetSubject.id,
        courseCode: targetSubject.code,
        subjectName: targetSubject.name,
        status: nextStatus,
        dateISO: todayDateISO,
        topic: topicText,
        timetableSlotId: slot.id,
      };
      setClassLogs((prev) => [localLog, ...prev]);
    }

    const label =
      nextStatus === 'cancelled'
        ? 'Cancelled / Holiday'
        : nextStatus === 'present'
          ? 'Present'
          : 'Absent';
    showToast(`Marked ${targetSubject.code} as ${label}`, 'success');
  };

  const undoTimetableCheckIn = async (slot: TimetableSlot) => {
    const existingLog = findCheckInLogForSlot(slot);
    if (!existingLog) return;

    const targetSubject = subjects.find(
      (s) => s.id === existingLog.subjectId || s.code.toUpperCase() === existingLog.courseCode.toUpperCase(),
    );
    const oldImpact = statusImpact(existingLog.status);

    if (targetSubject && (oldImpact.attended !== 0 || oldImpact.total !== 0)) {
      const nextTotal = Math.max(0, targetSubject.totalClasses - oldImpact.total);
      const nextAttended = Math.min(nextTotal, Math.max(0, targetSubject.attendedClasses - oldImpact.attended));
      const updatedSubjects = subjects.map((sub) =>
        sub.id === targetSubject.id
          ? { ...sub, attendedClasses: nextAttended, totalClasses: nextTotal }
          : sub,
      );
      setSubjects(updatedSubjects);
      syncTodayTrendPoint(updatedSubjects);

      if (isFirebaseLive) {
        await updateSubjectDoc(targetSubject.id, {
          ...targetSubject,
          attendedClasses: nextAttended,
          totalClasses: nextTotal,
        });
      }
    }

    if (isFirebaseLive) {
      await deleteAttendanceLogDoc(existingLog.id);
    } else {
      setClassLogs((prev) => prev.filter((log) => log.id !== existingLog.id));
    }
    showToast(`Undid check-in for ${slot.courseCode}`, 'info');
  };

  const addSubject = async (input: SubjectFormInput) => {
    const rawTarget = Number(input.targetAttendance);
    const hasCustomTarget =
      input.targetAttendance !== undefined && Number.isFinite(rawTarget);
    const cleanInput = {
      code: input.code.trim().toUpperCase(),
      name: input.name.trim(),
      instructor: input.instructor.trim() || 'Faculty Assigned',
      credits: Math.max(1, Math.min(6, Number(input.credits) || 3)),
      attendedClasses: Math.max(0, Math.min(input.totalClasses, input.attendedClasses)),
      totalClasses: Math.max(0, input.totalClasses),
      weeklyHours: Math.max(1, Math.min(8, Number(input.weeklyHours) || 3)),
      gradePoint: 8.5,
      currentGrade: 'A',
      ...(hasCustomTarget
        ? { targetAttendance: Math.min(95, Math.max(50, Math.round(rawTarget))) }
        : {}),
    };

    if (isFirebaseLive && firebaseUid) {
      await createSubjectDoc(firebaseUid, cleanInput);
      showToast(`Saved ${cleanInput.code} to Firestore`, 'success');
      return;
    }

    const newSubject: SubjectRecord = { id: `sub_${Date.now()}`, ...cleanInput };
    const updatedSubjects = [...subjects, newSubject];
    setSubjects(updatedSubjects);
    syncTodayTrendPoint(updatedSubjects);
    showToast(`Added ${cleanInput.code} to semester ledger`, 'success');
  };

  const updateSubject = async (subjectId: string, input: SubjectFormInput) => {
    const existingSub = subjects.find((s) => s.id === subjectId);
    const rawTarget = Number(input.targetAttendance);
    const hasCustomTarget =
      input.targetAttendance !== undefined && Number.isFinite(rawTarget);
    const updatedFields = {
      code: input.code.trim().toUpperCase(),
      name: input.name.trim(),
      instructor: input.instructor.trim() || existingSub?.instructor || 'Faculty Assigned',
      credits: Math.max(1, Math.min(6, Number(input.credits) || 3)),
      attendedClasses: Math.max(0, Math.min(input.totalClasses, input.attendedClasses)),
      totalClasses: Math.max(0, input.totalClasses),
      weeklyHours: Math.max(1, Math.min(8, Number(input.weeklyHours) || 3)),
      gradePoint: existingSub?.gradePoint ?? 8.5,
      currentGrade: existingSub?.currentGrade ?? 'A',
      ...(hasCustomTarget
        ? { targetAttendance: Math.min(95, Math.max(50, Math.round(rawTarget))) }
        : { targetAttendance: undefined }),
    };

    if (isFirebaseLive) {
      await updateSubjectDoc(subjectId, updatedFields);
      showToast(`Updated ${updatedFields.code} in Firestore`, 'success');
      return;
    }

    const updatedSubjects = subjects.map((sub) =>
      sub.id === subjectId ? { ...sub, ...updatedFields } : sub,
    );
    setSubjects(updatedSubjects);
    syncTodayTrendPoint(updatedSubjects);
    showToast(`Updated ${updatedFields.code}`, 'success');
  };

  const bulkSyncImportedSubjects = async (rows: ImportedSubjectRow[]) => {
    if (rows.length === 0) return;

    if (isFirebaseLive && firebaseUid) {
      await Promise.all(
        rows.map(async (row) => {
          const total = Math.max(0, Math.round(row.totalClasses));
          const attended = Math.min(total, Math.max(0, Math.round(row.attendedClasses)));
          const existing =
            (row.matchedSubjectId && subjects.find((s) => s.id === row.matchedSubjectId)) ||
            subjects.find((s) => s.code.toUpperCase() === row.code.trim().toUpperCase());

          if (existing) {
            await updateSubjectDoc(existing.id, {
              ...existing,
              name: row.name.trim() || existing.name,
              attendedClasses: attended,
              totalClasses: total,
            });
          } else {
            await createSubjectDoc(firebaseUid, {
              code: row.code.trim().toUpperCase() || 'SUB',
              name: row.name.trim(),
              instructor: 'Faculty Assigned',
              credits: 3,
              attendedClasses: attended,
              totalClasses: total,
              weeklyHours: 3,
              gradePoint: 8.5,
              currentGrade: 'A',
            });
          }
        }),
      );
      showToast(`Synced ${rows.length} course${rows.length === 1 ? '' : 's'} from screenshot to Firestore`, 'success');
      return;
    }

    let nextSubjects = [...subjects];
    rows.forEach((row, idx) => {
      const total = Math.max(0, Math.round(row.totalClasses));
      const attended = Math.min(total, Math.max(0, Math.round(row.attendedClasses)));
      const cleanCode = row.code.trim().toUpperCase() || `IMP${idx + 1}`;
      const existingIdx = nextSubjects.findIndex(
        (s) =>
          (row.matchedSubjectId && s.id === row.matchedSubjectId) ||
          s.code.toUpperCase() === cleanCode,
      );
      if (existingIdx !== -1) {
        nextSubjects[existingIdx] = {
          ...nextSubjects[existingIdx],
          name: row.name.trim() || nextSubjects[existingIdx].name,
          attendedClasses: attended,
          totalClasses: total,
        };
      } else {
        nextSubjects.push({
          id: `sub_${Date.now()}_${idx}`,
          code: cleanCode,
          name: row.name.trim(),
          instructor: 'Faculty Assigned',
          credits: 3,
          attendedClasses: attended,
          totalClasses: total,
          weeklyHours: 3,
          gradePoint: 8.5,
          currentGrade: 'A',
        });
      }
    });
    setSubjects(nextSubjects);
    syncTodayTrendPoint(nextSubjects);
    showToast(`Synced ${rows.length} course${rows.length === 1 ? '' : 's'} from screenshot`, 'success');
  };

  const deleteSubject = async (subjectId: string) => {
    const targetSub = subjects.find((s) => s.id === subjectId);

    if (isFirebaseLive) {
      await deleteSubjectDoc(subjectId);
      showToast(`Deleted ${targetSub?.code ?? 'subject'} from Firestore`, 'info');
      return;
    }

    const updatedSubjects = subjects.filter((sub) => sub.id !== subjectId);
    setSubjects(updatedSubjects);
    setTodayClasses((prev) => prev.filter((cls) => cls.subjectId !== subjectId));
    setClassLogs((prev) => prev.filter((log) => log.subjectId !== subjectId));
    syncTodayTrendPoint(updatedSubjects);
    showToast(`Deleted ${targetSub?.code ?? 'subject'}`, 'info');
  };

  const logClassSession = async (input: {
    subjectId: string;
    status: ClassLogStatus;
    dateISO: string;
    topic: string;
    timetableSlotId?: string;
  }) => {
    const targetSubject = subjects.find((s) => s.id === input.subjectId);
    if (!targetSubject) return;

    const logPayload = {
      subjectId: targetSubject.id,
      courseCode: targetSubject.code,
      subjectName: targetSubject.name,
      status: input.status,
      dateISO: input.dateISO,
      topic: input.topic.trim() || `${targetSubject.name} Session`,
      ...(input.timetableSlotId ? { timetableSlotId: input.timetableSlotId } : {}),
    };

    const impact = statusImpact(input.status);
    const nextTotal = Math.max(0, targetSubject.totalClasses + impact.total);
    const nextAttended = Math.min(nextTotal, Math.max(0, targetSubject.attendedClasses + impact.attended));

    if (isFirebaseLive && firebaseUid) {
      await createAttendanceLogDoc(firebaseUid, logPayload);
      if (impact.attended !== 0 || impact.total !== 0) {
        await updateSubjectDoc(targetSubject.id, {
          ...targetSubject,
          attendedClasses: nextAttended,
          totalClasses: nextTotal,
        });
      }
      showToast(`Logged ${input.status} session for ${targetSubject.code}`, 'success');
      return;
    }

    setClassLogs((prev) =>
      [{ id: `log_${Date.now()}`, ...logPayload }, ...prev].sort((a, b) =>
        b.dateISO.localeCompare(a.dateISO),
      ),
    );
    if (impact.attended !== 0 || impact.total !== 0) {
      const updatedSubjects = subjects.map((sub) =>
        sub.id === input.subjectId
          ? {
              ...sub,
              attendedClasses: nextAttended,
              totalClasses: nextTotal,
            }
          : sub,
      );
      setSubjects(updatedSubjects);
      syncTodayTrendPoint(updatedSubjects);
    }
    showToast(`Logged ${input.status} session for ${targetSubject.code}`, 'success');
  };

  const updateClassLog = async (
    logId: string,
    updates: {
      subjectId: string;
      status: ClassLogStatus;
      dateISO: string;
      topic: string;
    },
  ) => {
    const existingLog = classLogs.find((l) => l.id === logId);
    if (!existingLog) return;

    const oldSubject = subjects.find(
      (s) => s.id === existingLog.subjectId || s.code === existingLog.courseCode,
    );
    const newSubject = subjects.find((s) => s.id === updates.subjectId) ?? oldSubject;
    if (!newSubject) return;

    const oldImpact = statusImpact(existingLog.status);
    const newImpact = statusImpact(updates.status);

    let nextSubjects = [...subjects];
    const modifiedSubjects: SubjectRecord[] = [];

    if (oldSubject && oldSubject.id === newSubject.id) {
      const deltaA = newImpact.attended - oldImpact.attended;
      const deltaT = newImpact.total - oldImpact.total;
      if (deltaA !== 0 || deltaT !== 0) {
        const nextTotal = Math.max(0, newSubject.totalClasses + deltaT);
        const nextAttended = Math.min(nextTotal, Math.max(0, newSubject.attendedClasses + deltaA));
        const updatedSub = { ...newSubject, attendedClasses: nextAttended, totalClasses: nextTotal };
        nextSubjects = nextSubjects.map((s) => (s.id === newSubject.id ? updatedSub : s));
        modifiedSubjects.push(updatedSub);
      }
    } else {
      if (oldSubject && (oldImpact.attended !== 0 || oldImpact.total !== 0)) {
        const oldNextT = Math.max(0, oldSubject.totalClasses - oldImpact.total);
        const oldNextA = Math.min(oldNextT, Math.max(0, oldSubject.attendedClasses - oldImpact.attended));
        const updatedOld = { ...oldSubject, attendedClasses: oldNextA, totalClasses: oldNextT };
        nextSubjects = nextSubjects.map((s) => (s.id === oldSubject.id ? updatedOld : s));
        modifiedSubjects.push(updatedOld);
      }
      if (newImpact.attended !== 0 || newImpact.total !== 0) {
        const newNextT = Math.max(0, newSubject.totalClasses + newImpact.total);
        const newNextA = Math.min(newNextT, Math.max(0, newSubject.attendedClasses + newImpact.attended));
        const updatedNew = { ...newSubject, attendedClasses: newNextA, totalClasses: newNextT };
        nextSubjects = nextSubjects.map((s) => (s.id === newSubject.id ? updatedNew : s));
        modifiedSubjects.push(updatedNew);
      }
    }

    const cleanTopic = updates.topic.trim() || `${newSubject.name} Session`;

    if (isFirebaseLive) {
      await Promise.all([
        updateAttendanceLogDoc(logId, {
          subjectId: newSubject.id,
          courseCode: newSubject.code,
          subjectName: newSubject.name,
          status: updates.status,
          dateISO: updates.dateISO,
          topic: cleanTopic,
        }),
        ...modifiedSubjects.map((sub) => updateSubjectDoc(sub.id, sub)),
      ]);
    } else {
      setSubjects(nextSubjects);
      syncTodayTrendPoint(nextSubjects);
      setClassLogs((prev) =>
        prev
          .map((log) =>
            log.id === logId
              ? {
                  ...log,
                  subjectId: newSubject.id,
                  courseCode: newSubject.code,
                  subjectName: newSubject.name,
                  status: updates.status,
                  dateISO: updates.dateISO,
                  topic: cleanTopic,
                }
              : log,
          )
          .sort((a, b) => b.dateISO.localeCompare(a.dateISO)),
      );
    }

    showToast(`Updated ${newSubject.code} log entry`, 'success');
  };

  const deleteClassLog = async (logId: string) => {
    const existingLog = classLogs.find((l) => l.id === logId);
    if (!existingLog) return;

    const targetSubject = subjects.find(
      (s) => s.id === existingLog.subjectId || s.code === existingLog.courseCode,
    );
    const oldImpact = statusImpact(existingLog.status);

    let updatedSub: SubjectRecord | null = null;
    if (targetSubject && (oldImpact.attended !== 0 || oldImpact.total !== 0)) {
      const nextTotal = Math.max(0, targetSubject.totalClasses - oldImpact.total);
      const nextAttended = Math.min(
        nextTotal,
        Math.max(0, targetSubject.attendedClasses - oldImpact.attended),
      );
      updatedSub = {
        ...targetSubject,
        attendedClasses: nextAttended,
        totalClasses: nextTotal,
      };
    }

    if (isFirebaseLive) {
      await Promise.all([
        deleteAttendanceLogDoc(logId),
        ...(updatedSub ? [updateSubjectDoc(updatedSub.id, updatedSub)] : []),
      ]);
    } else {
      if (updatedSub) {
        const nextSubjects = subjects.map((s) => (s.id === updatedSub!.id ? updatedSub! : s));
        setSubjects(nextSubjects);
        syncTodayTrendPoint(nextSubjects);
      }
      setClassLogs((prev) => prev.filter((l) => l.id !== logId));
    }

    showToast(`Removed log entry for ${existingLog.courseCode}`, 'info');
  };

  const addTimetableSlot = async (input: TimetableSlotFormInput) => {
    const cleanSlot = {
      day: input.day,
      timeRange: input.timeRange.trim() || '09:00 – 09:55',
      courseCode: input.courseCode.trim().toUpperCase(),
      subjectName: input.subjectName.trim(),
      room: input.room.trim() || 'LH-101',
      sessionType: input.sessionType,
      professor: input.professor?.trim() || undefined,
    };

    if (isFirebaseLive && firebaseUid) {
      await createTimetableSlotDoc(firebaseUid, cleanSlot);
      showToast(`Added ${cleanSlot.courseCode} to ${cleanSlot.day} timetable`, 'success');
      return;
    }

    setWeeklyTimetable((prev) => [...prev, { id: `tt_${Date.now()}`, ...cleanSlot }]);
    showToast(`Added ${cleanSlot.courseCode} to ${cleanSlot.day} timetable`, 'success');
  };

  const deleteTimetableSlot = async (slotId: string) => {
    if (isFirebaseLive) {
      await deleteTimetableSlotDoc(slotId);
      showToast('Removed timetable slot', 'info');
      return;
    }
    setWeeklyTimetable((prev) => prev.filter((slot) => slot.id !== slotId));
    showToast('Removed timetable slot', 'info');
  };

  const markTimetableSlotAttended = async (slot: TimetableSlot) => {
    if (slot.day === todayWeekday) {
      await checkInTimetableSlot(slot, 'present');
      return;
    }
    const matchedSubject = subjects.find((s) => s.code === slot.courseCode);
    if (!matchedSubject) {
      showToast(`No enrolled course matched ${slot.courseCode}`, 'error');
      return;
    }

    await logClassSession({
      subjectId: matchedSubject.id,
      status: 'present',
      dateISO: todayDateISO,
      topic: `${slot.subjectName} (${slot.sessionType} · ${slot.timeRange})`,
      timetableSlotId: slot.id,
    });
  };

  const addExamItem = async (input: ExamFormInput) => {
    const refDate = new Date(`${todayDateISO}T00:00:00`);
    const targetDate = new Date(`${input.dateISO}T00:00:00`);
    const diffDays = Number.isFinite(targetDate.getTime())
      ? Math.max(0, Math.min(365, Math.round((targetDate.getTime() - refDate.getTime()) / 86400000)))
      : 7;
    const displayDate = Number.isFinite(targetDate.getTime())
      ? targetDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: '2-digit' })
      : input.dateISO;

    const payload = {
      courseCode: input.courseCode.trim().toUpperCase(),
      subjectName: input.subjectName.trim(),
      examTitle: input.examTitle.trim(),
      dateISO: input.dateISO,
      displayDate,
      daysRemaining: diffDays,
      room: input.room.trim() || 'TBA',
      syllabusProgress: Math.min(100, Math.max(0, Math.round(input.syllabusProgress ?? 0))),
      itemType: input.itemType,
      dueTime: input.dueTime?.trim() || '09:00',
    };

    if (isFirebaseLive && firebaseUid) {
      await createExamDoc(firebaseUid, payload);
      showToast(`Added ${payload.itemType.toLowerCase()} for ${payload.courseCode}`, 'success');
      return;
    }

    setExams((prev) =>
      [...prev, { id: `ex_${Date.now()}`, ...payload }].sort(
        (a, b) => a.daysRemaining - b.daysRemaining,
      ),
    );
    showToast(`Added ${payload.itemType.toLowerCase()} for ${payload.courseCode}`, 'success');
  };

  const updateExamSyllabus = async (examId: string, progress: number) => {
    const clamped = Math.min(100, Math.max(0, Math.round(progress)));
    setExams((prev) =>
      prev.map((ex) => (ex.id === examId ? { ...ex, syllabusProgress: clamped } : ex)),
    );

    if (isFirebaseLive) {
      await updateExamDoc(examId, { syllabusProgress: clamped });
      showToast(`Syllabus progress updated to ${clamped}%`, 'success');
      return;
    }
    showToast(`Syllabus readiness set to ${clamped}%`, 'success');
  };

  const deleteExamItem = async (examId: string) => {
    if (isFirebaseLive) {
      await deleteExamDoc(examId);
      showToast('Removed exam / deadline item', 'info');
      return;
    }
    setExams((prev) => prev.filter((ex) => ex.id !== examId));
    showToast('Removed exam / deadline item', 'info');
  };

  const toggleStudyTask = async (taskId: string) => {
    const target = studyTasks.find((t) => t.id === taskId);
    if (!target) return;
    const nextCompleted = !target.completed;

    if (isFirebaseLive) {
      await updateStudyTaskDoc(taskId, { completed: nextCompleted });
      showToast(
        nextCompleted ? 'Study task marked complete' : 'Study task reopened',
        'success',
      );
      return;
    }

    setStudyTasks((prev) =>
      prev.map((task) => (task.id === taskId ? { ...task, completed: nextCompleted } : task)),
    );
    showToast(
      nextCompleted ? 'Study task marked complete' : 'Study task reopened',
      'success',
    );
  };

  const addStudyTask = async (input: StudyTaskFormInput) => {
    const trimmed = input.title.trim();
    if (!trimmed) return;

    const payload = {
      title: trimmed,
      courseCode: input.courseCode,
      dueLabel: input.dueLabel.trim() || 'This Week',
      estimatedMinutes: Math.min(600, Math.max(5, Math.round(input.estimatedMinutes || 45))),
      completed: false,
      ...(input.linkedExamId ? { linkedExamId: input.linkedExamId } : {}),
      ...(input.linkedExamLabel ? { linkedExamLabel: input.linkedExamLabel } : {}),
    };

    if (isFirebaseLive && firebaseUid) {
      await createStudyTaskDoc(firebaseUid, payload);
      showToast('Added study task to Firestore', 'success');
      return;
    }

    setStudyTasks((prev) => [{ id: `tsk_${Date.now()}`, ...payload }, ...prev]);
    showToast('Added study task', 'success');
  };

  const deleteStudyTask = async (taskId: string) => {
    if (isFirebaseLive) {
      await deleteStudyTaskDoc(taskId);
      showToast('Removed study task', 'info');
      return;
    }
    setStudyTasks((prev) => prev.filter((t) => t.id !== taskId));
    showToast('Removed study task', 'info');
  };

  const updateDailyStudyGoal = async (hours: number) => {
    const clamped = Math.min(16, Math.max(0.5, Number(hours.toFixed(1))));
    const nextProfile = { ...student, dailyStudyGoalHours: clamped };
    setStudent(nextProfile);

    if (isFirebaseLive && firebaseUid) {
      await upsertUserProfile(firebaseUid, nextProfile, false);
    }
    showToast(`Daily study goal set to ${clamped} hrs`, 'success');
  };

  const addMarkRecord = async (input: MarkFormInput) => {
    if (isFirebaseLive && firebaseUid) {
      await createMarkDoc(firebaseUid, input);
      showToast(`Saved ${input.assessmentTitle} score`, 'success');
      return;
    }

    setMarks((prev) => [{ id: `mrk_${Date.now()}`, ...input }, ...prev]);
    showToast(`Saved ${input.assessmentTitle} score`, 'success');
  };

  const deleteMarkRecord = async (markId: string) => {
    if (isFirebaseLive) {
      await deleteMarkDoc(markId);
      showToast('Removed assessment score', 'info');
      return;
    }
    setMarks((prev) => prev.filter((m) => m.id !== markId));
    showToast('Removed assessment score', 'info');
  };

  const generateMonthlyReportSnapshot = async () => {
    const topSub = [...subjects].sort(
      (a, b) =>
        b.attendedClasses / Math.max(1, b.totalClasses) -
        a.attendedClasses / Math.max(1, a.totalClasses),
    )[0];
    const topPct = topSub
      ? ((topSub.attendedClasses / Math.max(1, topSub.totalClasses)) * 100).toFixed(1)
      : '0.0';

    const payload = {
      monthLabel: `Snapshot · Nov 23, 2026`,
      attendanceRate: overallStats.percentage,
      classesAttended: overallStats.attended,
      classesHeld: overallStats.total,
      statusLabel:
        overallStats.percentage >= student.targetAttendance ? 'Above Target' : 'Below Target',
      topSubject: topSub ? `${topSub.name} (${topPct}%)` : 'N/A',
    };

    if (isFirebaseLive && firebaseUid) {
      await createMonthlyReportDoc(firebaseUid, payload);
      showToast('Saved monthly report snapshot to Firestore', 'success');
      return;
    }

    setMonthlyReports((prev) => [{ id: `rep_${Date.now()}`, ...payload }, ...prev]);
    showToast('Generated monthly report snapshot', 'success');
  };

  const markNotificationRead = async (notificationId: string) => {
    if (isFirebaseLive) {
      await updateNotificationDoc(notificationId, true);
      showToast('Alert marked as read', 'info');
      return;
    }

    setNotifications((prev) =>
      prev.map((item) => (item.id === notificationId ? { ...item, read: true } : item)),
    );
    showToast('Alert marked as read', 'info');
  };

  const markAllNotificationsRead = async () => {
    if (isFirebaseLive) {
      const unread = notifications.filter((n) => !n.read);
      await Promise.all(unread.map((n) => updateNotificationDoc(n.id, true)));
      showToast('All notifications marked as read', 'info');
      return;
    }

    setNotifications((prev) => prev.map((item) => ({ ...item, read: true })));
    showToast('All notifications marked as read', 'info');
  };

  const updateTargetAttendance = async (target: number) => {
    const clamped = Math.min(95, Math.max(50, Math.round(target)));
    const nextProfile = { ...student, targetAttendance: clamped };
    setStudent(nextProfile);

    if (isFirebaseLive && firebaseUid) {
      await upsertUserProfile(firebaseUid, nextProfile, false);
    }
    showToast(`Attendance benchmark updated to ${clamped}%`, 'success');
  };

  const updateStudentProfile = async (
    updates: Partial<
      Pick<
        StudentProfile,
        | 'name'
        | 'studentId'
        | 'college'
        | 'branch'
        | 'program'
        | 'semester'
        | 'semesterNumber'
        | 'semesterStart'
        | 'semesterEnd'
        | 'onboardingCompleted'
      >
    >,
  ) => {
    const nextProfile = { ...student, ...updates };
    setStudent(nextProfile);

    if (isFirebaseLive && firebaseUid) {
      await upsertUserProfile(firebaseUid, nextProfile, false);
      showToast('Profile saved to Cloud Firestore', 'success');
      return;
    }
    showToast('Profile updated locally', 'success');
  };

  const completeOnboarding: AcademicContextValue['completeOnboarding'] = async (payload) => {
    const cleanBranch = payload.branch.trim() || 'B.Tech Computer Engineering';
    const cleanSemNum = Math.min(12, Math.max(1, Math.round(payload.semesterNumber || 1)));
    const nextProfile: StudentProfile = {
      ...student,
      name: payload.name.trim() || student.name,
      college: payload.college.trim(),
      branch: cleanBranch,
      program: cleanBranch,
      semesterNumber: cleanSemNum,
      semester: `Semester ${cleanSemNum}`,
      studentId: payload.studentId.trim(),
      targetAttendance: Math.min(95, Math.max(50, Math.round(payload.targetAttendance || 75))),
      semesterStart: payload.semesterStart || student.semesterStart,
      semesterEnd: payload.semesterEnd || student.semesterEnd,
      onboardingCompleted: true,
    };

    setStudent(nextProfile);

    const cleanSubjects = payload.initialSubjects.filter(
      (s) => s.name.trim().length > 0 && s.code.trim().length > 0,
    );

    if (isFirebaseLive && firebaseUid) {
      await upsertUserProfile(firebaseUid, nextProfile, false);
      const existingCodes = new Set(subjects.map((s) => s.code.toUpperCase()));
      await Promise.all(
        cleanSubjects
          .filter((s) => !existingCodes.has(s.code.trim().toUpperCase()))
          .map((sub) =>
            createSubjectDoc(firebaseUid, {
              code: sub.code.trim().toUpperCase(),
              name: sub.name.trim(),
              instructor: 'Faculty Assigned',
              credits: Math.max(1, Math.min(6, Number(sub.credits) || 3)),
              attendedClasses: Math.max(0, Math.min(sub.totalClasses, sub.attendedClasses)),
              totalClasses: Math.max(0, sub.totalClasses),
              weeklyHours: Math.max(1, Math.min(10, Number(sub.weeklyHours) || 3)),
              gradePoint: 8.5,
              currentGrade: 'A',
            }),
          ),
      );

      if (payload.loadUitSchedulePreset) {
        if (weeklyTimetable.length === 0) {
          await Promise.all(
            INITIAL_TIMETABLE.map((slot) =>
              createTimetableSlotDoc(firebaseUid, {
                day: slot.day,
                timeRange: slot.timeRange,
                courseCode: slot.courseCode,
                subjectName: slot.subjectName,
                room: slot.room,
                sessionType: slot.sessionType,
                professor: slot.professor,
              }),
            ),
          );
        }
        if (exams.length === 0) {
          await Promise.all(
            INITIAL_EXAMS.map((ex) =>
              createExamDoc(firebaseUid, {
                courseCode: ex.courseCode,
                subjectName: ex.subjectName,
                examTitle: ex.examTitle,
                dateISO: ex.dateISO,
                displayDate: ex.displayDate,
                daysRemaining: ex.daysRemaining,
                room: ex.room,
                syllabusProgress: ex.syllabusProgress,
                itemType: ex.itemType,
                dueTime: ex.dueTime,
              }),
            ),
          );
        }
      }
      showToast('Academic workspace configured & synced to Firestore', 'success');
      return;
    }

    if (cleanSubjects.length > 0) {
      const existingCodes = new Set(subjects.map((s) => s.code.toUpperCase()));
      const additions: SubjectRecord[] = cleanSubjects
        .filter((s) => !existingCodes.has(s.code.trim().toUpperCase()))
        .map((sub, idx) => ({
          id: `sub_${Date.now()}_${idx}`,
          code: sub.code.trim().toUpperCase(),
          name: sub.name.trim(),
          instructor: 'Faculty Assigned',
          credits: Math.max(1, Math.min(6, Number(sub.credits) || 3)),
          attendedClasses: Math.max(0, Math.min(sub.totalClasses, sub.attendedClasses)),
          totalClasses: Math.max(0, sub.totalClasses),
          weeklyHours: Math.max(1, Math.min(10, Number(sub.weeklyHours) || 3)),
          gradePoint: 8.5,
          currentGrade: 'A',
        }));
      const merged = [...subjects, ...additions];
      setSubjects(merged);
      syncTodayTrendPoint(merged);
    }
    if (payload.loadUitSchedulePreset) {
      if (weeklyTimetable.length === 0) {
        setWeeklyTimetable(INITIAL_TIMETABLE);
      }
      if (exams.length === 0) {
        setExams(INITIAL_EXAMS);
      }
    }
    showToast('Academic workspace configured', 'success');
  };

  const skipOnboarding = async () => {
    const nextProfile: StudentProfile = {
      ...student,
      onboardingCompleted: true,
    };
    setStudent(nextProfile);
    if (isFirebaseLive && firebaseUid) {
      await upsertUserProfile(firebaseUid, nextProfile, false);
    }
    showToast('Skipped setup — customize anytime in Settings', 'info');
  };

  const loadUitSem1Preset = async () => {
    const presetProfile: StudentProfile = {
      ...DEFAULT_STUDENT,
      id: student.id || DEFAULT_STUDENT.id,
      name: student.name || DEFAULT_STUDENT.name,
      email: student.email || DEFAULT_STUDENT.email,
      studentId: student.studentId || DEFAULT_STUDENT.studentId,
      onboardingCompleted: true,
      isGuest: student.isGuest,
    };

    if (isFirebaseLive && firebaseUid) {
      setIsDataLoading(true);
      try {
        await resetAndSeedUserData(
          firebaseUid,
          { displayName: presetProfile.name, email: presetProfile.email },
          {
            profile: presetProfile,
            subjects: INITIAL_SUBJECTS,
            classLogs: INITIAL_CLASS_LOGS,
            timetable: INITIAL_TIMETABLE,
            exams: INITIAL_EXAMS,
            studyTasks: INITIAL_STUDY_TASKS,
            marks: INITIAL_MARKS,
            notifications: INITIAL_NOTIFICATIONS,
            achievements: INITIAL_ACHIEVEMENTS,
            monthlyReports: INITIAL_REPORTS,
          },
        );
        setStudent(presetProfile);
        setTodayClasses(INITIAL_TODAY_CLASSES);
        setAttendanceTrend(INITIAL_TREND);
        showToast('Loaded Karnavati UIT Sem 1 ECE (Section A) preset in Firestore', 'success');
      } finally {
        setIsDataLoading(false);
      }
      return;
    }

    setStudent(presetProfile);
    setSubjects(INITIAL_SUBJECTS);
    setClassLogs(INITIAL_CLASS_LOGS);
    setTodayClasses(INITIAL_TODAY_CLASSES);
    setExams(INITIAL_EXAMS);
    setStudyTasks(INITIAL_STUDY_TASKS);
    setMarks(INITIAL_MARKS);
    setAttendanceTrend(INITIAL_TREND);
    setNotifications(INITIAL_NOTIFICATIONS);
    setWeeklyTimetable(INITIAL_TIMETABLE);
    setAchievements(INITIAL_ACHIEVEMENTS);
    setMonthlyReports(INITIAL_REPORTS);
    showToast('Loaded Karnavati UIT Sem 1 ECE (Section A) preset', 'success');
  };

  const updateAlertPreferences = async (
    updates: Partial<Pick<StudentProfile, 'alertLowAttendance' | 'alertExamReminders' | 'alertWeeklyDigest'>>,
  ) => {
    const nextProfile = { ...student, ...updates };
    setStudent(nextProfile);

    if (isFirebaseLive && firebaseUid) {
      await upsertUserProfile(firebaseUid, nextProfile, false);
      showToast('Notification preferences synced to Firestore', 'success');
      return;
    }
    showToast('Notification preferences updated', 'success');
  };

  const resetSampleData = async () => {
    if (isFirebaseLive && firebaseUid) {
      setIsDataLoading(true);
      try {
        await resetAndSeedUserData(
          firebaseUid,
          { displayName: student.name, email: student.email },
          {
            profile: {
              ...DEFAULT_STUDENT,
              name: student.name,
              email: student.email,
            },
            subjects: INITIAL_SUBJECTS,
            classLogs: INITIAL_CLASS_LOGS,
            timetable: INITIAL_TIMETABLE,
            exams: INITIAL_EXAMS,
            studyTasks: INITIAL_STUDY_TASKS,
            marks: INITIAL_MARKS,
            notifications: INITIAL_NOTIFICATIONS,
            achievements: INITIAL_ACHIEVEMENTS,
            monthlyReports: INITIAL_REPORTS,
          },
        );
        setTodayClasses(INITIAL_TODAY_CLASSES);
        setAttendanceTrend(INITIAL_TREND);
        showToast('Sample academic dataset restored in Firestore', 'success');
      } finally {
        setIsDataLoading(false);
      }
      return;
    }

    setStudent(DEFAULT_STUDENT);
    setSubjects(INITIAL_SUBJECTS);
    setClassLogs(INITIAL_CLASS_LOGS);
    setTodayClasses(INITIAL_TODAY_CLASSES);
    setExams(INITIAL_EXAMS);
    setStudyTasks(INITIAL_STUDY_TASKS);
    setMarks(INITIAL_MARKS);
    setAttendanceTrend(INITIAL_TREND);
    setNotifications(INITIAL_NOTIFICATIONS);
    setWeeklyTimetable(INITIAL_TIMETABLE);
    setAchievements(INITIAL_ACHIEVEMENTS);
    setMonthlyReports(INITIAL_REPORTS);
    showToast('Sample academic dataset restored', 'success');
  };

  const value: AcademicContextValue = {
    student,
    isAuthenticated,
    isAuthLoading,
    isDataLoading,
    isFirebaseLive,
    subjects,
    classLogs,
    todayClasses,
    exams,
    studyTasks,
    marks,
    attendanceTrend,
    notifications,
    weeklyTimetable,
    achievements,
    monthlyReports,
    overallStats,
    unreadCount,
    login,
    register,
    loginWithGoogle,
    loginAsGuest,
    logout,
    todayDateISO,
    todayWeekday,
    todayScheduledSlots,
    checkInTimetableSlot,
    undoTimetableCheckIn,
    markTodayClass,
    adjustSubjectAttendance,
    addSubject,
    updateSubject,
    bulkSyncImportedSubjects,
    deleteSubject,
    logClassSession,
    updateClassLog,
    deleteClassLog,
    addTimetableSlot,
    deleteTimetableSlot,
    markTimetableSlotAttended,
    addExamItem,
    updateExamSyllabus,
    deleteExamItem,
    toggleStudyTask,
    addStudyTask,
    deleteStudyTask,
    updateDailyStudyGoal,
    addMarkRecord,
    deleteMarkRecord,
    generateMonthlyReportSnapshot,
    markNotificationRead,
    markAllNotificationsRead,
    updateTargetAttendance,
    updateStudentProfile,
    completeOnboarding,
    skipOnboarding,
    loadUitSem1Preset,
    updateAlertPreferences,
    resetSampleData,
    getEffectiveTarget,
    getSubjectStanding,
    getClassesNeededForTarget,
    getSafeBunksAvailable,
  };

  return <AcademicContext.Provider value={value}>{children}</AcademicContext.Provider>;
}

export function useAcademic() {
  const ctx = useContext(AcademicContext);
  if (!ctx) {
    throw new Error('useAcademic must be used inside AcademicProvider');
  }
  return ctx;
}
