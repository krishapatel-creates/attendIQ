import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { auth, db, isFirebaseConfigured } from '../config/firebase';

export const OperationType = {
  CREATE: 'create',
  UPDATE: 'update',
  DELETE: 'delete',
  LIST: 'list',
  GET: 'get',
  WRITE: 'write',
};

/**
 * Structured Firestore error handler conforming to FirestoreErrorInfo.
 * Surfaces auth state, operation type, and path context for debugging.
 * @param {unknown} error
 * @param {string} operationType
 * @param {string | null} path
 */
export function handleFirestoreError(error, operationType, path) {
  const currentUser = auth?.currentUser ?? null;
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: currentUser?.uid ?? null,
      email: currentUser?.email ?? null,
      emailVerified: currentUser?.emailVerified ?? null,
      isAnonymous: currentUser?.isAnonymous ?? null,
      tenantId: currentUser?.tenantId ?? null,
      providerInfo:
        currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId ?? null,
          email: provider.email ?? null,
        })) ?? [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

function ensureConfigured() {
  if (!isFirebaseConfigured || !db) {
    throw new Error('Firebase is not configured. Running in offline/demo mode.');
  }
}

function sanitizeIdPart(raw) {
  return String(raw || 'user').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 24) || 'user';
}

function clampString(val, maxLen, fallback = '') {
  const str = typeof val === 'string' ? val.trim() : fallback;
  return str.slice(0, maxLen);
}

// ============================================================================
// 1. users/{uid}
// ============================================================================
export function subscribeUserProfile(uid, onData, onError) {
  if (!isFirebaseConfigured || !db || !uid) return () => {};
  const path = `users/${uid}`;
  return onSnapshot(
    doc(db, 'users', uid),
    (snap) => {
      onData(snap.exists() ? snap.data() : null);
    },
    (error) => {
      if (onError) onError(error);
      handleFirestoreError(error, OperationType.GET, path);
    },
  );
}

export async function getUserProfile(uid) {
  ensureConfigured();
  const path = `users/${uid}`;
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    return snap.exists() ? snap.data() : null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function upsertUserProfile(uid, profile, isCreate = false) {
  ensureConfigured();
  const path = `users/${uid}`;
  const rawGoal = Number(profile.dailyStudyGoalHours);
  const dailyStudyGoalHours = Number.isFinite(rawGoal)
    ? Math.min(16, Math.max(0.5, Number(rawGoal.toFixed(1))))
    : 3;

  const rawSem = Number(profile.semesterNumber);
  const semesterNumber = Number.isFinite(rawSem)
    ? Math.min(12, Math.max(1, Math.round(rawSem)))
    : 1;

  const payload = {
    userId: uid,
    name: clampString(profile.name, 100, 'Student') || 'Student',
    email: clampString(profile.email, 160, 'student@karnavatiuniversity.edu.in') || 'student@karnavatiuniversity.edu.in',
    studentId: clampString(profile.studentId, 40, ''),
    college: clampString(profile.college, 120, ''),
    branch: clampString(profile.branch || profile.program, 120, 'B.Tech Electronics & Communication Engineering (ECE) — Section A'),
    program: clampString(profile.program || profile.branch, 120, 'B.Tech Electronics & Communication Engineering (ECE) — Section A'),
    semester: clampString(profile.semester, 80, `Semester ${semesterNumber}`),
    semesterNumber,
    currentWeek: Math.min(30, Math.max(1, Number(profile.currentWeek) || 18)),
    totalWeeks: Math.min(30, Math.max(1, Number(profile.totalWeeks) || 21)),
    targetAttendance: Math.min(95, Math.max(50, Math.round(Number(profile.targetAttendance) || 75))),
    semesterStart: clampString(profile.semesterStart, 20, '2026-07-28'),
    semesterEnd: clampString(profile.semesterEnd, 20, '2026-12-16'),
    dailyStudyGoalHours,
    alertLowAttendance: profile.alertLowAttendance !== undefined ? Boolean(profile.alertLowAttendance) : true,
    alertExamReminders: profile.alertExamReminders !== undefined ? Boolean(profile.alertExamReminders) : true,
    alertWeeklyDigest: profile.alertWeeklyDigest !== undefined ? Boolean(profile.alertWeeklyDigest) : true,
    onboardingCompleted:
      profile.onboardingCompleted !== undefined ? Boolean(profile.onboardingCompleted) : true,
  };
  try {
    if (isCreate) {
      await setDoc(doc(db, 'users', uid), payload);
    } else {
      const { userId: _uid, ...updateFields } = payload;
      await updateDoc(doc(db, 'users', uid), updateFields);
    }
    return payload;
  } catch (error) {
    handleFirestoreError(error, isCreate ? OperationType.CREATE : OperationType.UPDATE, path);
  }
}

// Generic helper for userId-scoped collections
function subscribeUserCollection(collectionName, uid, onData, onError) {
  if (!isFirebaseConfigured || !db || !uid) return () => {};
  const q = query(collection(db, collectionName), where('userId', '==', uid));
  return onSnapshot(
    q,
    (snapshot) => {
      const items = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      onData(items);
    },
    (error) => {
      if (onError) onError(error);
      handleFirestoreError(error, OperationType.LIST, collectionName);
    },
  );
}

// ============================================================================
// 2. subjects
// ============================================================================
export function subscribeSubjects(uid, onData, onError) {
  return subscribeUserCollection('subjects', uid, onData, onError);
}

export async function createSubjectDoc(uid, subject) {
  ensureConfigured();
  const docRef = doc(collection(db, 'subjects'));
  const totalClasses = Math.max(0, Number(subject.totalClasses) || 0);
  const attendedClasses = Math.min(totalClasses, Math.max(0, Number(subject.attendedClasses) || 0));
  const rawTarget = Number(subject.targetAttendance);
  const hasTarget =
    subject.targetAttendance !== undefined &&
    subject.targetAttendance !== null &&
    Number.isFinite(rawTarget);
  const payload = {
    userId: uid,
    code: clampString(subject.code, 20, 'SUB').toUpperCase(),
    name: clampString(subject.name, 120, 'Untitled Subject'),
    instructor: clampString(subject.instructor, 100, 'Faculty Assigned'),
    credits: Math.min(10, Math.max(1, Number(subject.credits) || 3)),
    attendedClasses,
    totalClasses,
    weeklyHours: Math.min(20, Math.max(1, Number(subject.weeklyHours) || 3)),
    gradePoint: Math.min(10, Math.max(0, Number(subject.gradePoint) || 8.5)),
    currentGrade: clampString(subject.currentGrade, 8, 'A'),
    ...(hasTarget ? { targetAttendance: Math.min(95, Math.max(50, Math.round(rawTarget))) } : {}),
  };
  try {
    await setDoc(docRef, payload);
    return { id: docRef.id, ...payload };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `subjects/${docRef.id}`);
  }
}

export async function updateSubjectDoc(subjectId, updates) {
  ensureConfigured();
  const path = `subjects/${subjectId}`;
  const totalClasses = Math.max(0, Number(updates.totalClasses) || 0);
  const attendedClasses = Math.min(totalClasses, Math.max(0, Number(updates.attendedClasses) || 0));
  const rawTarget = Number(updates.targetAttendance);
  const hasTarget =
    updates.targetAttendance !== undefined &&
    updates.targetAttendance !== null &&
    Number.isFinite(rawTarget);
  const payload = {
    code: clampString(updates.code, 20, 'SUB').toUpperCase(),
    name: clampString(updates.name, 120, 'Untitled Subject'),
    instructor: clampString(updates.instructor, 100, 'Faculty Assigned'),
    credits: Math.min(10, Math.max(1, Number(updates.credits) || 3)),
    attendedClasses,
    totalClasses,
    weeklyHours: Math.min(20, Math.max(1, Number(updates.weeklyHours) || 3)),
    gradePoint: Math.min(10, Math.max(0, Number(updates.gradePoint) || 8.5)),
    currentGrade: clampString(updates.currentGrade, 8, 'A'),
    targetAttendance: hasTarget
      ? Math.min(95, Math.max(50, Math.round(rawTarget)))
      : deleteField(),
  };
  try {
    await updateDoc(doc(db, 'subjects', subjectId), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteSubjectDoc(subjectId) {
  ensureConfigured();
  const path = `subjects/${subjectId}`;
  try {
    await deleteDoc(doc(db, 'subjects', subjectId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// ============================================================================
// 3. attendance (Class logs)
// ============================================================================
export function subscribeAttendanceLogs(uid, onData, onError) {
  return subscribeUserCollection('attendance', uid, onData, onError);
}

export async function createAttendanceLogDoc(uid, entry) {
  ensureConfigured();
  const docRef = doc(collection(db, 'attendance'));
  const status = ['present', 'absent', 'cancelled'].includes(entry.status)
    ? entry.status
    : 'present';
  const timetableSlotId = clampString(entry.timetableSlotId, 128);
  const payload = {
    userId: uid,
    subjectId: clampString(entry.subjectId, 128),
    courseCode: clampString(entry.courseCode, 20).toUpperCase(),
    subjectName: clampString(entry.subjectName, 120),
    status,
    dateISO: clampString(entry.dateISO, 20, new Date().toISOString().slice(0, 10)),
    topic: clampString(entry.topic, 200, 'Class Session'),
    ...(timetableSlotId ? { timetableSlotId } : {}),
  };
  try {
    await setDoc(docRef, payload);
    return { id: docRef.id, ...payload };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `attendance/${docRef.id}`);
  }
}

export async function updateAttendanceLogDoc(logId, updates) {
  ensureConfigured();
  const path = `attendance/${logId}`;
  const safeUpdates = {};
  if (updates.subjectId !== undefined) safeUpdates.subjectId = clampString(updates.subjectId, 128);
  if (updates.courseCode !== undefined) {
    safeUpdates.courseCode = clampString(updates.courseCode, 20).toUpperCase();
  }
  if (updates.subjectName !== undefined) {
    safeUpdates.subjectName = clampString(updates.subjectName, 120);
  }
  if (updates.status !== undefined && ['present', 'absent', 'cancelled'].includes(updates.status)) {
    safeUpdates.status = updates.status;
  }
  if (updates.dateISO !== undefined) {
    safeUpdates.dateISO = clampString(updates.dateISO, 20);
  }
  if (updates.topic !== undefined) {
    safeUpdates.topic = clampString(updates.topic, 200);
  }
  if (updates.timetableSlotId !== undefined) {
    const slotId = clampString(updates.timetableSlotId, 128);
    safeUpdates.timetableSlotId = slotId || deleteField();
  }
  try {
    await updateDoc(doc(db, 'attendance', logId), safeUpdates);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteAttendanceLogDoc(logId) {
  ensureConfigured();
  try {
    await deleteDoc(doc(db, 'attendance', logId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `attendance/${logId}`);
  }
}

// ============================================================================
// 4. timetable
// ============================================================================
export function subscribeTimetable(uid, onData, onError) {
  return subscribeUserCollection('timetable', uid, onData, onError);
}

export async function createTimetableSlotDoc(uid, slot) {
  ensureConfigured();
  const docRef = doc(collection(db, 'timetable'));
  const validDay = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].includes(slot.day)
    ? slot.day
    : 'Monday';
  const validType = ['Lecture', 'Laboratory', 'Tutorial'].includes(slot.sessionType)
    ? slot.sessionType
    : 'Lecture';
  const professor = clampString(slot.professor, 100);
  const payload = {
    userId: uid,
    day: validDay,
    timeRange: clampString(slot.timeRange, 40, '09:00 – 09:55'),
    courseCode: clampString(slot.courseCode, 20).toUpperCase(),
    subjectName: clampString(slot.subjectName, 120),
    room: clampString(slot.room, 40, 'LH-101'),
    sessionType: validType,
    ...(professor ? { professor } : {}),
  };
  try {
    await setDoc(docRef, payload);
    return { id: docRef.id, ...payload };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `timetable/${docRef.id}`);
  }
}

export async function deleteTimetableSlotDoc(slotId) {
  ensureConfigured();
  try {
    await deleteDoc(doc(db, 'timetable', slotId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `timetable/${slotId}`);
  }
}

// ============================================================================
// 5. exams
// ============================================================================
export function subscribeExams(uid, onData, onError) {
  return subscribeUserCollection('exams', uid, onData, onError);
}

export async function createExamDoc(uid, exam) {
  ensureConfigured();
  const docRef = doc(collection(db, 'exams'));
  const itemType = ['Exam', 'Assignment', 'Quiz'].includes(exam.itemType) ? exam.itemType : 'Exam';
  const dueTime = clampString(exam.dueTime, 10, '09:00') || '09:00';
  const payload = {
    userId: uid,
    courseCode: clampString(exam.courseCode, 20).toUpperCase(),
    subjectName: clampString(exam.subjectName, 120),
    examTitle: clampString(exam.examTitle, 140),
    dateISO: clampString(exam.dateISO, 20, '2026-12-01'),
    displayDate: clampString(exam.displayDate, 40, 'Dec 01'),
    daysRemaining: Math.min(365, Math.max(0, Math.round(Number(exam.daysRemaining) || 0))),
    room: clampString(exam.room, 40, 'TBA'),
    syllabusProgress: Math.min(100, Math.max(0, Math.round(Number(exam.syllabusProgress) || 0))),
    itemType,
    dueTime,
  };
  try {
    await setDoc(docRef, payload);
    return { id: docRef.id, ...payload };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `exams/${docRef.id}`);
  }
}

export async function updateExamDoc(examId, updates) {
  ensureConfigured();
  const safeUpdates = {};
  if (updates.syllabusProgress !== undefined) {
    safeUpdates.syllabusProgress = Math.min(100, Math.max(0, Math.round(Number(updates.syllabusProgress) || 0)));
  }
  if (updates.examTitle !== undefined) {
    safeUpdates.examTitle = clampString(updates.examTitle, 140);
  }
  if (updates.dateISO !== undefined) {
    safeUpdates.dateISO = clampString(updates.dateISO, 20);
  }
  if (updates.displayDate !== undefined) {
    safeUpdates.displayDate = clampString(updates.displayDate, 40);
  }
  if (updates.daysRemaining !== undefined) {
    safeUpdates.daysRemaining = Math.min(365, Math.max(0, Math.round(Number(updates.daysRemaining) || 0)));
  }
  if (updates.room !== undefined) {
    safeUpdates.room = clampString(updates.room, 40);
  }
  if (updates.itemType !== undefined && ['Exam', 'Assignment', 'Quiz'].includes(updates.itemType)) {
    safeUpdates.itemType = updates.itemType;
  }
  if (updates.dueTime !== undefined) {
    safeUpdates.dueTime = clampString(updates.dueTime, 10);
  }
  try {
    await updateDoc(doc(db, 'exams', examId), safeUpdates);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `exams/${examId}`);
  }
}

export async function deleteExamDoc(examId) {
  ensureConfigured();
  try {
    await deleteDoc(doc(db, 'exams', examId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `exams/${examId}`);
  }
}

// ============================================================================
// 6. studyTasks
// ============================================================================
export function subscribeStudyTasks(uid, onData, onError) {
  return subscribeUserCollection('studyTasks', uid, onData, onError);
}

export async function createStudyTaskDoc(uid, task) {
  ensureConfigured();
  const docRef = doc(collection(db, 'studyTasks'));
  const linkedExamId = clampString(task.linkedExamId, 128);
  const linkedExamLabel = clampString(task.linkedExamLabel, 140);
  const payload = {
    userId: uid,
    title: clampString(task.title, 200),
    courseCode: clampString(task.courseCode, 20).toUpperCase(),
    dueLabel: clampString(task.dueLabel, 40, 'This Week'),
    estimatedMinutes: Math.min(600, Math.max(1, Math.round(Number(task.estimatedMinutes) || 45))),
    completed: Boolean(task.completed),
    ...(linkedExamId ? { linkedExamId } : {}),
    ...(linkedExamLabel ? { linkedExamLabel } : {}),
  };
  try {
    await setDoc(docRef, payload);
    return { id: docRef.id, ...payload };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `studyTasks/${docRef.id}`);
  }
}

export async function updateStudyTaskDoc(taskId, updates) {
  ensureConfigured();
  const safeUpdates = {};
  if (updates.completed !== undefined) safeUpdates.completed = Boolean(updates.completed);
  if (updates.title !== undefined) safeUpdates.title = clampString(updates.title, 200);
  if (updates.dueLabel !== undefined) safeUpdates.dueLabel = clampString(updates.dueLabel, 40);
  if (updates.estimatedMinutes !== undefined) {
    safeUpdates.estimatedMinutes = Math.min(600, Math.max(1, Math.round(Number(updates.estimatedMinutes) || 45)));
  }
  try {
    await updateDoc(doc(db, 'studyTasks', taskId), safeUpdates);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `studyTasks/${taskId}`);
  }
}

export async function deleteStudyTaskDoc(taskId) {
  ensureConfigured();
  try {
    await deleteDoc(doc(db, 'studyTasks', taskId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `studyTasks/${taskId}`);
  }
}

// ============================================================================
// 7. marks
// ============================================================================
export function subscribeMarks(uid, onData, onError) {
  return subscribeUserCollection('marks', uid, onData, onError);
}

export async function createMarkDoc(uid, mark) {
  ensureConfigured();
  const docRef = doc(collection(db, 'marks'));
  const maxScore = Math.max(1, Number(mark.maxScore) || 100);
  const scoreObtained = Math.min(maxScore, Math.max(0, Number(mark.scoreObtained) || 0));
  const assessmentType = ['Exam', 'Quiz', 'Assignment'].includes(mark.assessmentType)
    ? mark.assessmentType
    : 'Exam';
  const payload = {
    userId: uid,
    courseCode: clampString(mark.courseCode, 20).toUpperCase(),
    subjectName: clampString(mark.subjectName, 120),
    assessmentTitle: clampString(mark.assessmentTitle, 140),
    assessmentType,
    scoreObtained,
    maxScore,
    weightagePercent: Math.min(100, Math.max(0, Number(mark.weightagePercent) || 20)),
    dateISO: clampString(mark.dateISO, 20, new Date().toISOString().slice(0, 10)),
  };
  try {
    await setDoc(docRef, payload);
    return { id: docRef.id, ...payload };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `marks/${docRef.id}`);
  }
}

export async function updateMarkDoc(markId, updates) {
  ensureConfigured();
  try {
    await updateDoc(doc(db, 'marks', markId), updates);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `marks/${markId}`);
  }
}

export async function deleteMarkDoc(markId) {
  ensureConfigured();
  try {
    await deleteDoc(doc(db, 'marks', markId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `marks/${markId}`);
  }
}

// ============================================================================
// 8. notifications
// ============================================================================
export function subscribeNotifications(uid, onData, onError) {
  return subscribeUserCollection('notifications', uid, onData, onError);
}

export async function createNotificationDoc(uid, item) {
  ensureConfigured();
  const docRef = doc(collection(db, 'notifications'));
  const payload = {
    userId: uid,
    title: clampString(item.title, 160),
    description: clampString(item.description, 400),
    timestamp: clampString(item.timestamp, 40, 'Just now'),
    severity: ['critical', 'warning', 'info', 'milestone'].includes(item.severity)
      ? item.severity
      : 'info',
    read: Boolean(item.read),
    actionRoute: clampString(item.actionRoute, 60, '/dashboard'),
  };
  try {
    await setDoc(docRef, payload);
    return { id: docRef.id, ...payload };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `notifications/${docRef.id}`);
  }
}

export async function updateNotificationDoc(notificationId, read) {
  ensureConfigured();
  try {
    await updateDoc(doc(db, 'notifications', notificationId), { read: Boolean(read) });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `notifications/${notificationId}`);
  }
}

// ============================================================================
// 9. achievements
// ============================================================================
export function subscribeAchievements(uid, onData, onError) {
  return subscribeUserCollection('achievements', uid, onData, onError);
}

export async function upsertAchievementDoc(uid, achievementId, item) {
  ensureConfigured();
  const docRef = achievementId
    ? doc(db, 'achievements', achievementId)
    : doc(collection(db, 'achievements'));
  const payload = {
    userId: uid,
    title: clampString(item.title, 120),
    criteria: clampString(item.criteria, 240),
    earned: Boolean(item.earned),
    progressCurrent: Math.max(0, Number(item.progressCurrent) || 0),
    progressTarget: Math.max(1, Number(item.progressTarget) || 1),
    ...(item.earnedDate ? { earnedDate: clampString(item.earnedDate, 40) } : {}),
  };
  try {
    await setDoc(docRef, payload);
    return { id: docRef.id, ...payload };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `achievements/${docRef.id}`);
  }
}

// ============================================================================
// 10. monthlyReports
// ============================================================================
export function subscribeMonthlyReports(uid, onData, onError) {
  return subscribeUserCollection('monthlyReports', uid, onData, onError);
}

export async function createMonthlyReportDoc(uid, report) {
  ensureConfigured();
  const docRef = doc(collection(db, 'monthlyReports'));
  const classesHeld = Math.max(0, Number(report.classesHeld) || 0);
  const classesAttended = Math.min(classesHeld, Math.max(0, Number(report.classesAttended) || 0));
  const payload = {
    userId: uid,
    monthLabel: clampString(report.monthLabel, 60),
    attendanceRate: Math.min(100, Math.max(0, Number(report.attendanceRate) || 0)),
    classesAttended,
    classesHeld,
    statusLabel: clampString(report.statusLabel, 40),
    topSubject: clampString(report.topSubject, 140),
  };
  try {
    await setDoc(docRef, payload);
    return { id: docRef.id, ...payload };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `monthlyReports/${docRef.id}`);
  }
}

function appendSeedOperations(uid, authUser, defaults, operations, includeProfile) {
  const prefix = sanitizeIdPart(uid);

  if (includeProfile) {
    const rawSem = Number(defaults.profile.semesterNumber);
    const semesterNumber = Number.isFinite(rawSem)
      ? Math.min(12, Math.max(1, Math.round(rawSem)))
      : 1;
    operations.push({
      ref: doc(db, 'users', uid),
      data: {
        userId: uid,
        name: clampString(authUser?.displayName || defaults.profile.name, 100) || 'Student',
        email: clampString(authUser?.email || defaults.profile.email, 160),
        studentId: clampString(defaults.profile.studentId, 40, ''),
        college: clampString(defaults.profile.college, 120, ''),
        branch: clampString(defaults.profile.branch || defaults.profile.program, 120, 'B.Tech Electronics & Communication Engineering (ECE) — Section A'),
        program: clampString(defaults.profile.program, 120, 'B.Tech Electronics & Communication Engineering (ECE) — Section A'),
        semester: clampString(defaults.profile.semester, 80, `Semester ${semesterNumber}`),
        semesterNumber,
        currentWeek: defaults.profile.currentWeek,
        totalWeeks: defaults.profile.totalWeeks,
        targetAttendance: defaults.profile.targetAttendance ?? 75,
        semesterStart: defaults.profile.semesterStart ?? '2026-07-28',
        semesterEnd: defaults.profile.semesterEnd ?? '2026-12-16',
        dailyStudyGoalHours: defaults.profile.dailyStudyGoalHours ?? 3,
        alertLowAttendance: defaults.profile.alertLowAttendance ?? true,
        alertExamReminders: defaults.profile.alertExamReminders ?? true,
        alertWeeklyDigest: defaults.profile.alertWeeklyDigest ?? true,
        onboardingCompleted:
          defaults.profile.onboardingCompleted !== undefined
            ? Boolean(defaults.profile.onboardingCompleted)
            : false,
      },
    });
  }

  const subjectIdMap = new Map();

  defaults.subjects.forEach((sub) => {
    const subDocId = `${prefix}_${sub.id}`;
    subjectIdMap.set(sub.id, subDocId);
    operations.push({
      ref: doc(db, 'subjects', subDocId),
      data: {
        userId: uid,
        code: sub.code,
        name: sub.name,
        instructor: sub.instructor,
        credits: sub.credits,
        attendedClasses: sub.attendedClasses,
        totalClasses: sub.totalClasses,
        weeklyHours: sub.weeklyHours,
        gradePoint: sub.gradePoint,
        currentGrade: sub.currentGrade,
      },
    });
  });

  defaults.classLogs.forEach((log) => {
    operations.push({
      ref: doc(db, 'attendance', `${prefix}_${log.id}`),
      data: {
        userId: uid,
        subjectId: subjectIdMap.get(log.subjectId) ?? `${prefix}_${log.subjectId}`,
        courseCode: log.courseCode,
        subjectName: log.subjectName,
        status: log.status,
        dateISO: log.dateISO,
        topic: log.topic,
      },
    });
  });

  defaults.timetable.forEach((slot) => {
    operations.push({
      ref: doc(db, 'timetable', `${prefix}_${slot.id}`),
      data: {
        userId: uid,
        day: slot.day,
        timeRange: slot.timeRange,
        courseCode: slot.courseCode,
        subjectName: slot.subjectName,
        room: slot.room,
        sessionType: slot.sessionType,
        ...(slot.professor ? { professor: slot.professor } : {}),
      },
    });
  });

  defaults.exams.forEach((exam) => {
    operations.push({
      ref: doc(db, 'exams', `${prefix}_${exam.id}`),
      data: {
        userId: uid,
        courseCode: exam.courseCode,
        subjectName: exam.subjectName,
        examTitle: exam.examTitle,
        dateISO: exam.dateISO,
        displayDate: exam.displayDate,
        daysRemaining: exam.daysRemaining,
        room: exam.room,
        syllabusProgress: exam.syllabusProgress,
        ...(exam.itemType ? { itemType: exam.itemType } : {}),
        ...(exam.dueTime ? { dueTime: exam.dueTime } : {}),
      },
    });
  });

  defaults.studyTasks.forEach((task) => {
    operations.push({
      ref: doc(db, 'studyTasks', `${prefix}_${task.id}`),
      data: {
        userId: uid,
        title: task.title,
        courseCode: task.courseCode,
        dueLabel: task.dueLabel,
        estimatedMinutes: task.estimatedMinutes,
        completed: task.completed,
        ...(task.linkedExamId ? { linkedExamId: `${prefix}_${task.linkedExamId}` } : {}),
        ...(task.linkedExamLabel ? { linkedExamLabel: task.linkedExamLabel } : {}),
      },
    });
  });

  defaults.marks.forEach((mark) => {
    operations.push({
      ref: doc(db, 'marks', `${prefix}_${mark.id}`),
      data: {
        userId: uid,
        courseCode: mark.courseCode,
        subjectName: mark.subjectName,
        assessmentTitle: mark.assessmentTitle,
        ...(mark.assessmentType ? { assessmentType: mark.assessmentType } : {}),
        scoreObtained: mark.scoreObtained,
        maxScore: mark.maxScore,
        weightagePercent: mark.weightagePercent,
        dateISO: mark.dateISO,
      },
    });
  });

  defaults.notifications.forEach((item) => {
    operations.push({
      ref: doc(db, 'notifications', `${prefix}_${item.id}`),
      data: {
        userId: uid,
        title: item.title,
        description: item.description,
        timestamp: item.timestamp,
        severity: item.severity,
        read: item.read,
        actionRoute: item.actionRoute,
      },
    });
  });

  defaults.achievements.forEach((ach) => {
    operations.push({
      ref: doc(db, 'achievements', `${prefix}_${ach.id}`),
      data: {
        userId: uid,
        title: ach.title,
        criteria: ach.criteria,
        earned: ach.earned,
        progressCurrent: ach.progressCurrent,
        progressTarget: ach.progressTarget,
        ...(ach.earnedDate ? { earnedDate: ach.earnedDate } : {}),
      },
    });
  });

  defaults.monthlyReports.forEach((rep) => {
    operations.push({
      ref: doc(db, 'monthlyReports', `${prefix}_${rep.id}`),
      data: {
        userId: uid,
        monthLabel: rep.monthLabel,
        attendanceRate: rep.attendanceRate,
        classesAttended: rep.classesAttended,
        classesHeld: rep.classesHeld,
        statusLabel: rep.statusLabel,
        topSubject: rep.topSubject,
      },
    });
  });
}

async function commitSetOperations(operations) {
  const CHUNK_SIZE = 450;
  for (let i = 0; i < operations.length; i += CHUNK_SIZE) {
    const batch = writeBatch(db);
    operations.slice(i, i + CHUNK_SIZE).forEach(({ ref, data }) => {
      batch.set(ref, data);
    });
    await batch.commit();
  }
}

// ============================================================================
// First-Time Authenticated User Seed (Atomic writeBatch across all 10 collections)
// ============================================================================
export async function seedInitialStudentDataIfEmpty(uid, authUser, defaults) {
  ensureConfigured();
  try {
    const existingProfileSnap = await getDoc(doc(db, 'users', uid));
    if (existingProfileSnap.exists()) {
      const profileData = existingProfileSnap.data() || {};
      const subjectsSnap = await getDocs(
        query(collection(db, 'subjects'), where('userId', '==', uid)),
      );
      const subjectCodes = new Set(
        subjectsSnap.docs.map((d) => String(d.data()?.code || '').trim().toUpperCase()),
      );
      const hasLegacySampleSeed =
        subjectCodes.has('CS301') &&
        (subjectCodes.has('EC302') || subjectCodes.has('CS303') || subjectCodes.has('MA301'));
      const hasEmptyCompletedAccount =
        subjectsSnap.empty && profileData.onboardingCompleted === true;

      if (hasLegacySampleSeed || hasEmptyCompletedAccount) {
        const preservedName =
          authUser?.displayName ||
          (profileData.name && profileData.name !== 'Aarav Mehta'
            ? profileData.name
            : defaults.profile.name);
        const preservedEmail =
          authUser?.email || profileData.email || defaults.profile.email;

        await resetAndSeedUserData(
          uid,
          { displayName: preservedName, email: preservedEmail },
          {
            ...defaults,
            profile: {
              ...defaults.profile,
              name: preservedName,
              email: preservedEmail,
              onboardingCompleted: true,
            },
          },
        );
        return true;
      }

      return false;
    }

    // New authenticated user: initialize profile with onboardingCompleted: false
    // so the 3-Step Onboarding Wizard guides them through Branch, Semester, Benchmark & Subjects.
    const operations = [];
    appendSeedOperations(
      uid,
      authUser,
      {
        ...defaults,
        profile: {
          ...defaults.profile,
          studentId: '',
          college: '',
          onboardingCompleted: false,
        },
        subjects: [],
        classLogs: [],
        timetable: [],
        exams: [],
        studyTasks: [],
        marks: [],
        notifications: [],
        achievements: [],
        monthlyReports: [],
      },
      operations,
      true,
    );

    if (operations.length > 0) {
      await commitSetOperations(operations);
    }
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `users/${uid}`);
    return false;
  }
}

// ============================================================================
// Reset & Re-Seed Sample Academic Data (Settings Workflow)
// ============================================================================
const USER_COLLECTION_NAMES = [
  'subjects',
  'attendance',
  'timetable',
  'exams',
  'studyTasks',
  'marks',
  'notifications',
  'achievements',
  'monthlyReports',
];

export async function resetAndSeedUserData(uid, authUser, defaults) {
  ensureConfigured();
  try {
    const refsToDelete = [];
    const snaps = await Promise.all(
      USER_COLLECTION_NAMES.map((colName) =>
        getDocs(query(collection(db, colName), where('userId', '==', uid))),
      ),
    );
    snaps.forEach((snap) => {
      snap.docs.forEach((d) => refsToDelete.push(d.ref));
    });

    const CHUNK_SIZE = 450;
    for (let i = 0; i < refsToDelete.length; i += CHUNK_SIZE) {
      const batch = writeBatch(db);
      refsToDelete.slice(i, i + CHUNK_SIZE).forEach((ref) => batch.delete(ref));
      await batch.commit();
    }

    const operations = [];
    appendSeedOperations(uid, authUser, defaults, operations, true);
    await commitSetOperations(operations);
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `users/${uid}`);
    return false;
  }
}
