import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowUpRight,
  Calendar,
  Check,
  Minus,
  Plus,
  Sparkles,
  X,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  PolarAngleAxis,
  RadialBar,
  RadialBarChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { StandingText } from '../components/StandingText';
import { TodayCheckInBar } from '../components/TodayCheckInBar';
import { useAcademic } from '../context/AcademicContext';
import {
  UIT_OFFICIAL_MILESTONES,
  computeRemainingInstructionalCalendar,
  isUitAcademicProfile,
} from '../data/uitAcademicCalendar';

export function DashboardPage() {
  const {
    student,
    subjects,
    exams,
    studyTasks,
    attendanceTrend,
    notifications,
    weeklyTimetable,
    todayDateISO,
    overallStats,
    toggleStudyTask,
    markNotificationRead,
    updateTargetAttendance,
    loadUitSem1Preset,
    getEffectiveTarget,
    getSubjectStanding,
    getClassesNeededForTarget,
  } = useAcademic();

  const [isApplyingUit, setIsApplyingUit] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(() => {
    try {
      return sessionStorage.getItem('attendiq_uit_banner_dismissed') === '1';
    } catch {
      return false;
    }
  });

  const isUitPresetActive = useMemo(() => {
    const codes = new Set(subjects.map((s) => s.code.toUpperCase()));
    const hasUitSubjects =
      codes.has('DTI-101') && codes.has('BEEE-102') && codes.has('MATH-101');
    return isUitAcademicProfile(student) && hasUitSubjects && weeklyTimetable.length >= 10;
  }, [student, subjects, weeklyTimetable.length]);

  const uitCalendarSummary = useMemo(() => {
    if (!isUitPresetActive) return null;
    return computeRemainingInstructionalCalendar({
      subjects,
      weeklyTimetable,
      startDateISO: todayDateISO,
      endDateISO: student.semesterEnd || UIT_OFFICIAL_MILESTONES.lastTeachingDay,
      applyUitExclusions: true,
    });
  }, [isUitPresetActive, subjects, weeklyTimetable, todayDateISO, student.semesterEnd]);

  const handleApplyUitPreset = async () => {
    setIsApplyingUit(true);
    try {
      await loadUitSem1Preset();
    } finally {
      setIsApplyingUit(false);
    }
  };

  const handleDismissBanner = () => {
    setBannerDismissed(true);
    try {
      sessionStorage.setItem('attendiq_uit_banner_dismissed', '1');
    } catch {
      // ignore
    }
  };

  const atRiskSubjects = useMemo(() => {
    return subjects
      .map((sub) => {
        const effectiveTarget = getEffectiveTarget(sub);
        const pct =
          sub.totalClasses > 0
            ? Number(((sub.attendedClasses / sub.totalClasses) * 100).toFixed(1))
            : 0;
        const standing = getSubjectStanding(sub.attendedClasses, sub.totalClasses, effectiveTarget);
        const classesNeeded = getClassesNeededForTarget(
          sub.attendedClasses,
          sub.totalClasses,
          effectiveTarget,
        );
        return { ...sub, pct, effectiveTarget, standing, classesNeeded };
      })
      .filter((sub) => sub.pct < sub.effectiveTarget)
      .sort((a, b) => a.pct - b.pct)
      .slice(0, 3);
  }, [subjects, getEffectiveTarget, getSubjectStanding, getClassesNeededForTarget]);

  const completedTasksCount = useMemo(
    () => studyTasks.filter((t) => t.completed).length,
    [studyTasks],
  );
  const taskProgressPct =
    studyTasks.length > 0 ? Math.round((completedTasksCount / studyTasks.length) * 100) : 0;

  const topUnreadAlerts = useMemo(
    () => notifications.filter((n) => !n.read).slice(0, 2),
    [notifications],
  );

  const upcomingExamsSnippet = useMemo(() => exams.slice(0, 3), [exams]);

  const radialData = useMemo(
    () => [
      {
        name: 'Overall Attendance',
        value: overallStats.percentage,
        fill: overallStats.percentage >= student.targetAttendance ? '#2F466F' : '#8B2626',
      },
    ],
    [overallStats.percentage, student.targetAttendance],
  );

  return (
    <div className="space-y-6">
      {/* 1. Welcome Header with Student Name & Current Semester Week */}
      <section className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between pb-5 border-b border-[#D3D1CE]">
        <div className="min-w-0">
          <p className="text-xs font-medium text-[#262E36] tabular-nums">
            {student.semester} · Week {student.currentWeek} of {student.totalWeeks}
          </p>
          <h1 className="mt-1 font-display text-2xl sm:text-[30px] font-semibold tracking-tight text-[#0A0A0A] text-balance">
            Welcome back, {student.name}
          </h1>
          <p className="mt-1 text-sm text-[#262E36]">
            {student.program} · Benchmark set to{' '}
            <span className="font-mono-tabular font-semibold text-[#0A0A0A]">
              {student.targetAttendance}%
            </span>
          </p>
        </div>

        <Link
          to="/settings"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#2F466F] hover:text-[#0F223A] transition-colors whitespace-nowrap shrink-0 self-start sm:self-auto"
        >
          <span>Academic Profile & Benchmark</span>
          <ArrowUpRight className="w-3.5 h-3.5" aria-hidden="true" />
        </Link>
      </section>

      {!isUitPresetActive && !bannerDismissed && (
        <section
          aria-label="UIT Semester 1 Preset"
          className="luxury-card rounded-xl p-4 sm:p-5 border-[#2F466F]/40 bg-white flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
        >
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[#2F466F]">
              Official Academic Dataset Available
            </p>
            <h2 className="mt-0.5 font-display text-sm sm:text-base font-semibold text-[#0A0A0A]">
              Karnavati University (UIT) — B.Tech ECE, Sem 1 (Section A)
            </h2>
            <p className="mt-1 text-xs text-[#262E36]">
              Sync the 7 core Sem 1 courses, 19-slot Mon–Fri timetable (Rooms I16, I13, I5, I3, MAKERS LAB 4), and 2026–27 holiday &amp; exam calendar into your account.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              disabled={isApplyingUit}
              onClick={() => void handleApplyUitPreset()}
              className="min-h-[44px] px-4 py-2 rounded-lg bg-[#0F223A] text-white text-xs font-medium hover:bg-[#2F466F] transition-colors inline-flex items-center gap-2 whitespace-nowrap cursor-pointer disabled:opacity-50"
            >
              <Sparkles className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span>{isApplyingUit ? 'Syncing Preset...' : 'Load Preset: UIT Sem 1 ECE (Section A)'}</span>
            </button>
            <button
              type="button"
              onClick={handleDismissBanner}
              aria-label="Dismiss preset banner"
              className="min-h-[44px] min-w-[44px] rounded-lg border border-[#D3D1CE] text-[#536878] hover:text-[#0A0A0A] hover:border-[#2F466F] flex items-center justify-center cursor-pointer"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        </section>
      )}

      {isUitPresetActive && uitCalendarSummary && (
        <section
          aria-label="UIT Academic Calendar Status"
          className="luxury-card rounded-xl px-4 py-3.5 sm:px-5 bg-white flex flex-col md:flex-row md:items-center md:justify-between gap-3"
        >
          <div className="flex items-start sm:items-center gap-2.5 min-w-0">
            <Calendar className="w-4 h-4 text-[#2F466F] shrink-0 mt-0.5 sm:mt-0" aria-hidden="true" />
            <p className="text-xs text-[#262E36] leading-relaxed">
              <span className="font-semibold text-[#0A0A0A]">Karnavati UIT · Sem 1 ECE (Sec A)</span>
              {' · '}
              <span className="tabular-nums">
                {uitCalendarSummary.instructionalDays} teaching weekdays left before Dec 16, 2026
              </span>
              {' · '}
              <span>End-Sem Exams: Dec 17–30</span>
            </p>
          </div>
          <div className="flex items-center gap-4 shrink-0">
            <Link
              to="/timetable-exams"
              className="text-xs font-semibold text-[#2F466F] hover:text-[#0F223A] whitespace-nowrap"
            >
              View Timetable &amp; Holidays
            </Link>
            <Link
              to="/predictor"
              className="text-xs font-semibold text-[#0F223A] hover:text-[#2F466F] whitespace-nowrap"
            >
              Forecast Dec 16
            </Link>
          </div>
        </section>
      )}

      {/* Primary Executive Row: Overall Radial Gauge + Subjects Needing Attention */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        {/* 2. Overall Attendance Radial Gauge (Configurable 75% Benchmark) */}
        <section className="lg:col-span-5 luxury-card rounded-xl p-5 sm:p-6 flex flex-col justify-between">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-display text-base font-semibold text-[#1C1C1C]">
                Overall Attendance
              </h2>
              <p className="text-xs text-[#262E36] mt-0.5 tabular-nums">
                {overallStats.attended} of {overallStats.total} classes attended
              </p>
            </div>
            <Link
              to="/attendance"
              className="inline-flex items-center gap-1 text-xs font-medium text-[#2F466F] hover:text-[#0F223A] whitespace-nowrap shrink-0"
            >
              <span>All Courses</span>
              <ArrowUpRight className="w-3.5 h-3.5" aria-hidden="true" />
            </Link>
          </div>

          <div className="relative h-[200px] w-full my-2 flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <RadialBarChart
                cx="50%"
                cy="55%"
                innerRadius="72%"
                outerRadius="96%"
                barSize={14}
                data={radialData}
                startAngle={210}
                endAngle={-30}
              >
                <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
                <RadialBar
                  background={{ fill: '#EDEAE6' }}
                  dataKey="value"
                  cornerRadius={8}
                  isAnimationActive={false}
                />
              </RadialBarChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pt-3 pointer-events-none">
              <span className="font-display text-4xl font-semibold tracking-tight text-[#0A0A0A] tabular-nums">
                {overallStats.percentage.toFixed(1)}%
              </span>
              <div className="mt-1">
                <StandingText standing={overallStats.standing} />
              </div>
              <span className="mt-1 text-xs text-[#262E36] tabular-nums">
                {overallStats.marginDelta >= 0 ? '+' : ''}
                {overallStats.marginDelta.toFixed(1)}% vs {student.targetAttendance}% target
              </span>
            </div>
          </div>

          <div className="pt-4 border-t border-[#EDEAE6] flex items-center justify-between gap-3">
            <span className="text-xs font-medium text-[#262E36]">Benchmark Target</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => updateTargetAttendance(student.targetAttendance - 1)}
                aria-label="Decrease attendance benchmark"
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg border border-[#D3D1CE] text-[#1C1C1C] hover:border-[#2F466F] transition-colors cursor-pointer"
              >
                <Minus className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
              <span className="w-12 text-center font-mono-tabular text-sm font-semibold text-[#0A0A0A]">
                {student.targetAttendance}%
              </span>
              <button
                type="button"
                onClick={() => updateTargetAttendance(student.targetAttendance + 1)}
                aria-label="Increase attendance benchmark"
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg border border-[#D3D1CE] text-[#1C1C1C] hover:border-[#2F466F] transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            </div>
          </div>
        </section>

        {/* 3. Subjects Needing Attention (Max 3 at-risk subjects) */}
        <section className="lg:col-span-7 luxury-card rounded-xl p-5 sm:p-6 flex flex-col justify-between">
          <div className="flex items-start justify-between gap-3 pb-4 border-b border-[#EDEAE6]">
            <div>
              <h2 className="font-display text-base font-semibold text-[#1C1C1C]">
                Subjects Needing Attention
              </h2>
              <p className="text-xs text-[#262E36] mt-0.5">
                Courses currently below your {student.targetAttendance}% benchmark
              </p>
            </div>
            <Link
              to="/recovery"
              className="inline-flex items-center gap-1 text-xs font-medium text-[#2F466F] hover:text-[#0F223A] whitespace-nowrap shrink-0"
            >
              <span>Recovery Calculator</span>
              <ArrowUpRight className="w-3.5 h-3.5" aria-hidden="true" />
            </Link>
          </div>

          {subjects.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-sm font-medium text-[#0A0A0A]">No enrolled subjects yet</p>
              <p className="mt-1 text-xs text-[#262E36]">
                Add your semester courses to monitor attendance thresholds and recovery targets.
              </p>
              <Link
                to="/attendance"
                className="mt-4 min-h-[44px] inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#0F223A] text-white text-xs font-medium hover:bg-[#2F466F] transition-colors"
              >
                <span>Add Courses</span>
              </Link>
            </div>
          ) : atRiskSubjects.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-sm font-medium text-[#1F5E3B]">
                All enrolled subjects meet your {student.targetAttendance}% target.
              </p>
              <p className="mt-1 text-xs text-[#262E36]">
                Use the What-If Simulator to test planned absences safely.
              </p>
              <Link
                to="/simulator"
                className="mt-4 min-h-[44px] inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#0F223A] text-white text-xs font-medium hover:bg-[#2F466F] transition-colors"
              >
                <span>Open What-If Simulator</span>
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-[#EDEAE6] flex-1 flex flex-col justify-center">
              {atRiskSubjects.map((subject) => (
                <div
                  key={subject.id}
                  className="py-3.5 first:pt-2 last:pb-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-xs text-[#536878]">
                      <span className="font-mono-tabular font-medium text-[#1C1C1C]">
                        {subject.code}
                      </span>
                      <span aria-hidden="true">·</span>
                      <StandingText standing={subject.standing} compact />
                    </div>
                    <h3 className="mt-0.5 text-sm font-semibold text-[#0A0A0A] truncate">
                      {subject.name}
                    </h3>
                    <p className="mt-0.5 text-xs text-[#262E36] tabular-nums">
                      {subject.attendedClasses}/{subject.totalClasses} attended · Attend next{' '}
                      <span className="font-semibold text-[#0A0A0A]">{subject.classesNeeded}</span>{' '}
                      consecutive to clear {subject.effectiveTarget}%
                    </p>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0">
                    <span className="font-mono-tabular text-lg font-semibold text-[#0A0A0A]">
                      {subject.pct.toFixed(1)}%
                    </span>
                    <Link
                      to="/recovery"
                      className="min-h-[44px] inline-flex items-center px-3.5 py-2 rounded-lg border border-[#D3D1CE] text-xs font-medium text-[#1C1C1C] hover:border-[#2F466F] hover:text-[#2F466F] transition-colors whitespace-nowrap"
                    >
                      Plan
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="pt-3 border-t border-[#EDEAE6] flex items-center justify-between text-xs text-[#262E36]">
            <span>Showing top {atRiskSubjects.length} priority courses</span>
            <Link to="/predictor" className="font-medium text-[#2F466F] hover:text-[#0F223A]">
              View semester projection
            </Link>
          </div>
        </section>
      </div>

      {/* Secondary Row: Today's Smart Check-In + Exams Countdown & Study Progress */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        <div className="lg:col-span-7 min-w-0">
          <TodayCheckInBar />
        </div>

        {/* Right Stack: Upcoming Exams Countdown + Study Task Progress Bar */}
        <div className="lg:col-span-5 flex flex-col gap-5">
          {/* 5. Upcoming Exams Countdown Snippet */}
          <section className="luxury-card rounded-xl p-5 sm:p-6 flex-1">
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-[#EDEAE6]">
              <div>
                <h2 className="font-display text-base font-semibold text-[#1C1C1C]">
                  Upcoming Exams
                </h2>
                <p className="text-xs text-[#262E36] mt-0.5">Next scheduled assessments</p>
              </div>
              <Link
                to="/timetable-exams"
                className="inline-flex items-center gap-1 text-xs font-medium text-[#2F466F] hover:text-[#0F223A] whitespace-nowrap shrink-0"
              >
                <span>Exam Calendar</span>
                <ArrowUpRight className="w-3.5 h-3.5" aria-hidden="true" />
              </Link>
            </div>

            {upcomingExamsSnippet.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-sm font-medium text-[#0A0A0A]">No upcoming deadlines</p>
                <p className="mt-1 text-xs text-[#262E36]">
                  Add exams or assignment dates in Timetable & Exams.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-[#EDEAE6]">
                {upcomingExamsSnippet.map((exam) => (
                  <div key={exam.id} className="py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 text-xs text-[#536878]">
                        <span className="font-mono-tabular font-medium text-[#1C1C1C]">
                          {exam.courseCode}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{exam.displayDate}</span>
                      </div>
                      <p className="mt-0.5 text-sm font-medium text-[#0A0A0A] truncate">
                        {exam.examTitle}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="font-mono-tabular text-sm font-semibold text-[#0F223A]">
                        {exam.daysRemaining}d
                      </span>
                      <span className="block text-[11px] text-[#262E36]">remaining</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* 6. Study Task Progress Bar */}
          <section className="luxury-card rounded-xl p-5 sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-base font-semibold text-[#1C1C1C]">
                  Study Task Progress
                </h2>
                <p className="text-xs text-[#262E36] mt-0.5 tabular-nums">
                  {completedTasksCount} of {studyTasks.length} revision tasks completed
                </p>
              </div>
              <Link
                to="/study-planner"
                className="inline-flex items-center gap-1 text-xs font-medium text-[#2F466F] hover:text-[#0F223A] whitespace-nowrap shrink-0"
              >
                <span>Study Planner</span>
                <ArrowUpRight className="w-3.5 h-3.5" aria-hidden="true" />
              </Link>
            </div>

            <div className="mt-4">
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="text-[#262E36]">Weekly Revision Goal</span>
                <span className="font-mono-tabular font-semibold text-[#0A0A0A]">
                  {taskProgressPct}%
                </span>
              </div>
              <div
                role="progressbar"
                aria-valuenow={taskProgressPct}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Study task completion progress"
                className="h-2.5 w-full rounded-full bg-[#EDEAE6] overflow-hidden"
              >
                <div
                  className="h-full bg-[#2F466F] rounded-full transition-all duration-200"
                  style={{ width: `${taskProgressPct}%` }}
                />
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-[#EDEAE6] space-y-1">
              {studyTasks.length === 0 ? (
                <p className="py-3 text-xs text-[#262E36]">
                  No study tasks scheduled yet. Open Study Planner to add blocks.
                </p>
              ) : (
                studyTasks.slice(0, 2).map((task) => (
                  <button
                    key={task.id}
                    type="button"
                    onClick={() => toggleStudyTask(task.id)}
                    className="w-full min-h-[44px] flex items-center justify-between gap-3 text-left group cursor-pointer"
                  >
                    <span className="flex items-center gap-2.5 min-w-0">
                      <span
                        className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                          task.completed
                            ? 'bg-[#2F466F] border-[#2F466F] text-white'
                            : 'border-[#536878] bg-white group-hover:border-[#0F223A]'
                        }`}
                      >
                        {task.completed && <Check className="w-3 h-3" aria-hidden="true" />}
                      </span>
                      <span
                        className={`text-xs truncate ${
                          task.completed ? 'line-through text-[#536878]' : 'text-[#1C1C1C]'
                        }`}
                      >
                        {task.title}
                      </span>
                    </span>
                    <span className="font-mono-tabular text-[11px] text-[#536878] shrink-0">
                      {task.courseCode}
                    </span>
                  </button>
                ))
              )}
            </div>
          </section>
        </div>
      </div>

      {/* 7. Compact 14-Day Attendance Trend Chart + Top 2 Unread Alerts */}
      <section className="luxury-card rounded-xl p-5 sm:p-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* 14-Day Attendance Trend Chart */}
          <div className="lg:col-span-7 min-w-0">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <h2 className="font-display text-base font-semibold text-[#1C1C1C]">
                  14-Day Attendance Trend
                </h2>
                <p className="text-xs text-[#262E36] mt-0.5">
                  Daily cumulative attendance rate vs {student.targetAttendance}% benchmark
                </p>
              </div>
              <Link
                to="/insights"
                className="inline-flex items-center gap-1 text-xs font-medium text-[#2F466F] hover:text-[#0F223A] whitespace-nowrap shrink-0"
              >
                <span>Academic Insights</span>
                <ArrowUpRight className="w-3.5 h-3.5" aria-hidden="true" />
              </Link>
            </div>

            {attendanceTrend.length === 0 ? (
              <div className="h-[190px] w-full flex flex-col items-center justify-center text-center border border-dashed border-[#D3D1CE] rounded-lg px-4">
                <p className="text-sm font-medium text-[#0A0A0A]">No attendance trend history yet</p>
                <p className="mt-1 text-xs text-[#262E36]">
                  Log daily class sessions to populate your 14-day attendance curve.
                </p>
              </div>
            ) : (
              <div className="h-[190px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={attendanceTrend}
                    margin={{ top: 8, right: 8, left: -20, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="attendiqTrendFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#2F466F" stopOpacity={0.18} />
                        <stop offset="95%" stopColor="#2F466F" stopOpacity={0.01} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#EDEAE6" vertical={false} />
                    <XAxis
                      dataKey="dateLabel"
                      tick={{ fontSize: 11, fill: '#262E36' }}
                      axisLine={{ stroke: '#D3D1CE' }}
                      tickLine={false}
                      interval={2}
                    />
                    <YAxis
                      domain={[68, 86]}
                      tick={{ fontSize: 11, fill: '#262E36' }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(val) => `${val}%`}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#FFFFFF',
                        border: '1px solid #D3D1CE',
                        borderRadius: '8px',
                        fontSize: '12px',
                      }}
                      formatter={(value) => [`${value ?? 0}%`, 'Attendance']}
                    />
                    <ReferenceLine
                      y={student.targetAttendance}
                      stroke="#536878"
                      strokeDasharray="4 4"
                    />
                    <Area
                      type="monotone"
                      dataKey="rate"
                      stroke="#2F466F"
                      strokeWidth={2}
                      fill="url(#attendiqTrendFill)"
                      isAnimationActive={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Top 2 Unread Alerts */}
          <div className="lg:col-span-5 lg:border-l lg:border-[#EDEAE6] lg:pl-6 min-w-0">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <h2 className="font-display text-base font-semibold text-[#1C1C1C]">
                  Priority Alerts
                </h2>
                <p className="text-xs text-[#262E36] mt-0.5 tabular-nums">
                  Top {topUnreadAlerts.length} unread notices
                </p>
              </div>
              <Link
                to="/notifications"
                className="inline-flex items-center gap-1 text-xs font-medium text-[#2F466F] hover:text-[#0F223A] whitespace-nowrap shrink-0"
              >
                <span>All Notifications</span>
                <ArrowUpRight className="w-3.5 h-3.5" aria-hidden="true" />
              </Link>
            </div>

            {topUnreadAlerts.length === 0 ? (
              <div className="py-8 text-center border-t border-[#EDEAE6]">
                <p className="text-sm font-medium text-[#1C1C1C]">No unread alerts</p>
                <p className="mt-1 text-xs text-[#262E36]">
                  All threshold and exam reminders have been reviewed.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-[#EDEAE6] border-t border-[#EDEAE6]">
                {topUnreadAlerts.map((alert) => (
                  <div key={alert.id} className="py-3.5">
                    <div className="flex items-center justify-between gap-2 text-xs text-[#536878]">
                      <span
                        className={`font-medium ${
                          alert.severity === 'critical'
                            ? 'text-[#8B2626]'
                            : alert.severity === 'warning'
                              ? 'text-[#8C5A12]'
                              : 'text-[#2F466F]'
                        }`}
                      >
                        {alert.severity === 'critical'
                          ? 'Threshold Alert'
                          : alert.severity === 'warning'
                            ? 'Watch Notice'
                            : 'Exam Notice'}
                      </span>
                      <span>{alert.timestamp}</span>
                    </div>
                    <p className="mt-1 text-sm font-semibold text-[#0A0A0A]">{alert.title}</p>
                    <p className="mt-0.5 text-xs text-[#262E36] leading-relaxed">
                      {alert.description}
                    </p>
                    <div className="mt-1.5 flex items-center gap-4">
                      <Link
                        to={alert.actionRoute}
                        className="min-h-[44px] inline-flex items-center text-xs font-semibold text-[#2F466F] hover:text-[#0F223A]"
                      >
                        Review Action
                      </Link>
                      <button
                        type="button"
                        onClick={() => markNotificationRead(alert.id)}
                        className="min-h-[44px] inline-flex items-center text-xs text-[#536878] hover:text-[#0A0A0A] cursor-pointer"
                      >
                        Mark as read
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
