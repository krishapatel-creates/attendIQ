import type {
  ExamItem,
  MarkRecord,
  StudentProfile,
  StudyTask,
  SubjectRecord,
  SubjectStanding,
  TimetableSlot,
} from '../types/academic';
import {
  UIT_OFFICIAL_MILESTONES,
  UIT_SEM1_HOLIDAYS,
  computeRemainingInstructionalCalendar,
  getTodayLocalISO,
  isUitAcademicProfile,
  parseSlotStartMinutes,
} from '../data/uitAcademicCalendar';
import { calculateAttendancePercent, calculateRecoveryMetrics } from './attendanceMath';

export interface AcademicSnapshotInput {
  student: StudentProfile;
  overallStats: {
    attended: number;
    total: number;
    percentage: number;
    marginDelta: number;
    standing: SubjectStanding;
  };
  subjects: SubjectRecord[];
  exams: ExamItem[];
  marks: MarkRecord[];
  studyTasks: StudyTask[];
  weeklyTimetable?: TimetableSlot[];
}

const DAY_ORDER: Record<TimetableSlot['day'], number> = {
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
};

export function buildAcademicSnapshot(input: AcademicSnapshotInput) {
  const {
    student,
    overallStats,
    subjects,
    exams,
    marks,
    studyTasks,
    weeklyTimetable = [],
  } = input;

  const referenceDate = getTodayLocalISO();
  const isUit = isUitAcademicProfile(student);
  const semesterStart = student.semesterStart || UIT_OFFICIAL_MILESTONES.commencementDate;
  const semesterEnd = student.semesterEnd || UIT_OFFICIAL_MILESTONES.lastTeachingDay;

  const calendarProjection = computeRemainingInstructionalCalendar({
    subjects,
    weeklyTimetable,
    startDateISO: referenceDate,
    endDateISO: semesterEnd,
    applyUitExclusions: isUit,
  });

  const sortedTimetable = [...weeklyTimetable].sort((a, b) => {
    const dayDiff = (DAY_ORDER[a.day] ?? 9) - (DAY_ORDER[b.day] ?? 9);
    if (dayDiff !== 0) return dayDiff;
    return parseSlotStartMinutes(a.timeRange) - parseSlotStartMinutes(b.timeRange);
  });

  return {
    referenceDate,
    student: {
      name: student.name,
      studentId: student.studentId,
      college: student.college || null,
      branch: student.branch || student.program,
      program: student.program,
      semester: student.semester,
      semesterNumber: student.semesterNumber ?? null,
      currentWeek: student.currentWeek,
      totalWeeks: student.totalWeeks,
      targetAttendance: student.targetAttendance,
      semesterStart,
      semesterEnd,
      dailyStudyGoalHours: student.dailyStudyGoalHours ?? 3,
    },
    overallAttendance: {
      attended: overallStats.attended,
      total: overallStats.total,
      percentage: overallStats.percentage,
      marginDelta: overallStats.marginDelta,
      standing: overallStats.standing,
    },
    subjects: subjects.map((sub) => {
      const target = sub.targetAttendance ?? student.targetAttendance;
      const pct = Number(
        calculateAttendancePercent(sub.attendedClasses, sub.totalClasses).toFixed(1),
      );
      const metrics = calculateRecoveryMetrics(
        sub.attendedClasses,
        sub.totalClasses,
        target,
      );
      const remainingClassesBeforeEnd =
        calendarProjection.remainingByCourse[sub.code.toUpperCase()] ?? 0;
      return {
        code: sub.code,
        name: sub.name,
        instructor: sub.instructor,
        credits: sub.credits,
        attendedClasses: sub.attendedClasses,
        totalClasses: sub.totalClasses,
        attendancePercent: pct,
        targetAttendance: target,
        weeklyHours: sub.weeklyHours,
        classesNeededForTarget: metrics.classesNeeded,
        safeSkipsAvailable: metrics.safeToMiss,
        remainingClassesBeforeEnd,
        currentGrade: sub.currentGrade,
        gradePoint: sub.gradePoint,
      };
    }),
    weeklyTimetable: sortedTimetable.map((slot) => ({
      day: slot.day,
      timeRange: slot.timeRange,
      courseCode: slot.courseCode,
      subjectName: slot.subjectName,
      room: slot.room,
      sessionType: slot.sessionType,
      professor: slot.professor ?? null,
    })),
    academicCalendar: {
      isUitCalendarActive: isUit,
      semesterStart,
      lastTeachingDay: semesterEnd,
      remainingInstructionalDays: calendarProjection.instructionalDays,
      midTermExams: isUit ? UIT_OFFICIAL_MILESTONES.midTermDatesLabel : null,
      endSemExams: isUit ? UIT_OFFICIAL_MILESTONES.endSemDatesLabel : null,
      holidays: isUit
        ? UIT_SEM1_HOLIDAYS.map((h) => ({
            date: h.displayDate,
            label: h.label,
            kind: h.kind,
          }))
        : [],
    },
    upcomingExamsAndDeadlines: exams.map((ex) => ({
      id: ex.id,
      courseCode: ex.courseCode,
      subjectName: ex.subjectName,
      examTitle: ex.examTitle,
      itemType: ex.itemType ?? 'Exam',
      dateISO: ex.dateISO,
      displayDate: ex.displayDate,
      dueTime: ex.dueTime ?? '09:00',
      daysRemaining: ex.daysRemaining,
      room: ex.room,
      syllabusProgress: ex.syllabusProgress,
    })),
    marks: marks.map((m) => ({
      courseCode: m.courseCode,
      subjectName: m.subjectName,
      assessmentTitle: m.assessmentTitle,
      assessmentType: m.assessmentType ?? 'Exam',
      scoreObtained: m.scoreObtained,
      maxScore: m.maxScore,
      percentage: Number(((m.scoreObtained / Math.max(1, m.maxScore)) * 100).toFixed(1)),
      weightagePercent: m.weightagePercent,
      dateISO: m.dateISO,
    })),
    pendingStudyTasks: studyTasks
      .filter((t) => !t.completed)
      .map((t) => ({
        title: t.title,
        courseCode: t.courseCode,
        dueLabel: t.dueLabel,
        estimatedMinutes: t.estimatedMinutes,
        linkedExamLabel: t.linkedExamLabel ?? null,
      })),
    completedStudyTasksCount: studyTasks.filter((t) => t.completed).length,
  };
}
