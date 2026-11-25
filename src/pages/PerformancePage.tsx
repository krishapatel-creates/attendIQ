import React, { useMemo, useState } from 'react';
import { AlertTriangle, Plus, Trash2 } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { PageHeader } from '../components/PageHeader';
import { useAcademic } from '../context/AcademicContext';
import type { AssessmentCategory } from '../types/academic';
import { calculateAttendancePercent } from '../utils/attendanceMath';
import { getTodayLocalISO } from '../data/uitAcademicCalendar';

const ACADEMIC_FOCUS_THRESHOLD = 75;

export function PerformancePage() {
  const { student, subjects, marks, addMarkRecord, deleteMarkRecord } = useAcademic();

  const [courseCode, setCourseCode] = useState(subjects[0]?.code ?? 'MATH-101');
  const [assessmentType, setAssessmentType] = useState<AssessmentCategory>('Quiz');
  const [assessmentTitle, setAssessmentTitle] = useState('');
  const [scoreObtained, setScoreObtained] = useState(17);
  const [maxScore, setMaxScore] = useState(20);
  const [weightagePercent, setWeightagePercent] = useState(15);
  const [dateISO, setDateISO] = useState(() => getTodayLocalISO());
  const [markError, setMarkError] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'All' | AssessmentCategory>('All');

  const activeCourseCode = useMemo(() => {
    if (subjects.some((s) => s.code === courseCode)) return courseCode;
    return subjects[0]?.code ?? courseCode;
  }, [subjects, courseCode]);

  const totalCredits = useMemo(
    () => subjects.reduce((sum, s) => sum + s.credits, 0),
    [subjects],
  );

  const sgpa = useMemo(() => {
    const weighted = subjects.reduce((sum, s) => sum + s.gradePoint * s.credits, 0);
    return totalCredits > 0 ? (weighted / totalCredits).toFixed(2) : '0.00';
  }, [subjects, totalCredits]);

  // Subject-wise percentage chart aggregation
  const subjectPerformance = useMemo(() => {
    return subjects.map((sub) => {
      const courseMarks = marks.filter((m) => m.courseCode === sub.code);
      const averagePct =
        courseMarks.length > 0
          ? Number(
              (
                courseMarks.reduce(
                  (sum, m) => sum + (m.scoreObtained / Math.max(1, m.maxScore)) * 100,
                  0,
                ) / courseMarks.length
              ).toFixed(1),
            )
          : null;
      const attendancePct = calculateAttendancePercent(sub.attendedClasses, sub.totalClasses);
      const needsScoreFocus = averagePct !== null && averagePct < ACADEMIC_FOCUS_THRESHOLD;
      const needsAttendanceFocus = attendancePct < student.targetAttendance;
      return {
        id: sub.id,
        code: sub.code,
        name: sub.name,
        credits: sub.credits,
        gradePoint: sub.gradePoint,
        currentGrade: sub.currentGrade,
        assessmentsCount: courseMarks.length,
        averagePct,
        chartValue: averagePct ?? 0,
        attendancePct,
        needsScoreFocus,
        needsAttendanceFocus,
        needsFocus: needsScoreFocus || needsAttendanceFocus,
      };
    });
  }, [subjects, marks, student.targetAttendance]);

  const overallInternalAvg = useMemo(() => {
    if (marks.length === 0) return 0;
    const sum = marks.reduce(
      (acc, m) => acc + (m.scoreObtained / Math.max(1, m.maxScore)) * 100,
      0,
    );
    return Number((sum / marks.length).toFixed(1));
  }, [marks]);

  const focusSubjects = useMemo(
    () => subjectPerformance.filter((s) => s.needsFocus),
    [subjectPerformance],
  );

  const visibleMarks = useMemo(() => {
    const sorted = [...marks].sort((a, b) => b.dateISO.localeCompare(a.dateISO));
    if (categoryFilter === 'All') return sorted;
    return sorted.filter((m) => (m.assessmentType ?? 'Exam') === categoryFilter);
  }, [marks, categoryFilter]);

  const handleAddMark = async (e: React.FormEvent) => {
    e.preventDefault();
    setMarkError('');
    const numScore = Number(scoreObtained);
    const numMax = Number(maxScore);
    if (!assessmentTitle.trim()) {
      setMarkError('Assessment title is required.');
      return;
    }
    if (numMax < 1 || numScore < 0 || numScore > numMax) {
      setMarkError('Score obtained must be between 0 and max score.');
      return;
    }
    const matched = subjects.find((s) => s.code === activeCourseCode);
    await addMarkRecord({
      courseCode: activeCourseCode,
      subjectName: matched?.name ?? activeCourseCode,
      assessmentTitle: assessmentTitle.trim(),
      assessmentType,
      scoreObtained: numScore,
      maxScore: numMax,
      weightagePercent: Math.min(100, Math.max(0, Number(weightagePercent) || 0)),
      dateISO: dateISO || getTodayLocalISO(),
    });
    setAssessmentTitle('');
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Academic Performance"
        subtitle="Internal exam, quiz, and assignment analytics correlated with course attendance"
      />

      {/* Executive Summary KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="luxury-card rounded-xl p-5">
          <p className="text-xs text-[#262E36]">Projected SGPA</p>
          <p className="mt-1 font-display text-2xl font-semibold text-[#0A0A0A] tabular-nums">
            {sgpa} / 10.0
          </p>
        </div>
        <div className="luxury-card rounded-xl p-5">
          <p className="text-xs text-[#262E36]">Internal Average</p>
          <p className="mt-1 font-display text-2xl font-semibold text-[#0A0A0A] tabular-nums">
            {overallInternalAvg.toFixed(1)}%
          </p>
        </div>
        <div className="luxury-card rounded-xl p-5">
          <p className="text-xs text-[#262E36]">Assessments Logged</p>
          <p className="mt-1 font-display text-2xl font-semibold text-[#0A0A0A] tabular-nums">
            {marks.length}
          </p>
        </div>
        <div className="luxury-card rounded-xl p-5">
          <p className="text-xs text-[#262E36]">Courses Needing Focus</p>
          <p className="mt-1 font-display text-2xl font-semibold text-[#8B2626] tabular-nums">
            {focusSubjects.length} of {subjects.length}
          </p>
        </div>
      </div>

      {/* Subject-Wise Percentage Chart + Focus Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <section className="lg:col-span-7 luxury-card rounded-xl p-5 sm:p-6 min-w-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-[#EDEAE6]">
            <div>
              <h2 className="font-display text-base font-semibold text-[#1C1C1C]">
                Subject-Wise Assessment Average (%)
              </h2>
              <p className="text-xs text-[#262E36] mt-0.5">
                Dashed line marks the {ACADEMIC_FOCUS_THRESHOLD}% academic focus benchmark
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs text-[#262E36]">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-[#0F223A]" aria-hidden="true" />
                Strong
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-[#8B2626]" aria-hidden="true" />
                Needs Focus
              </span>
            </div>
          </div>

          {subjects.length === 0 ? (
            <div className="h-[220px] mt-4 flex items-center justify-center text-center text-sm text-[#262E36]">
              Add courses in My Attendance to visualize subject assessment averages.
            </div>
          ) : (
            <div className="h-[260px] mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={subjectPerformance}
                  margin={{ top: 10, right: 10, left: -18, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#EDEAE6" vertical={false} />
                  <XAxis dataKey="code" tick={{ fontSize: 11, fill: '#262E36' }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#262E36' }} unit="%" />
                  <Tooltip
                    formatter={(value) => [`${value ?? 0}%`, 'Internal Average']}
                    contentStyle={{
                      backgroundColor: '#FFFFFF',
                      borderColor: '#D3D1CE',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                  />
                  <ReferenceLine
                    y={ACADEMIC_FOCUS_THRESHOLD}
                    stroke="#536878"
                    strokeDasharray="4 4"
                  />
                  <Bar dataKey="chartValue" radius={[4, 4, 0, 0]} maxBarSize={44}>
                    {subjectPerformance.map((entry) => (
                      <Cell
                        key={entry.code}
                        fill={
                          entry.averagePct === null
                            ? '#D3D1CE'
                            : entry.needsScoreFocus
                              ? '#8B2626'
                              : '#0F223A'
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>

        {/* Subjects Needing Academic Focus */}
        <section className="lg:col-span-5 luxury-card rounded-xl p-5 sm:p-6">
          <div className="flex items-center justify-between pb-4 border-b border-[#EDEAE6]">
            <div>
              <h2 className="font-display text-base font-semibold text-[#1C1C1C]">
                Subjects Needing Academic Focus
              </h2>
              <p className="text-xs text-[#262E36] mt-0.5">
                Flagged when internal avg &lt; {ACADEMIC_FOCUS_THRESHOLD}% or attendance &lt;{' '}
                {student.targetAttendance}%
              </p>
            </div>
            <AlertTriangle className="w-4 h-4 text-[#8B2626] shrink-0" aria-hidden="true" />
          </div>

          {focusSubjects.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-sm font-medium text-[#1F5E3B]">
                All courses are above both score and attendance benchmarks
              </p>
              <p className="mt-1 text-xs text-[#262E36]">
                Continue logging internal quizzes and assignments to monitor consistency.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-[#EDEAE6]">
              {focusSubjects.map((sub) => (
                <div key={sub.id} className="py-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono-tabular text-xs font-semibold text-[#0F223A]">
                      {sub.code}
                    </span>
                    <span className="font-mono-tabular text-xs font-semibold text-[#8B2626]">
                      {sub.averagePct !== null ? `${sub.averagePct}% marks` : 'No marks yet'} ·{' '}
                      {sub.attendancePct.toFixed(1)}% att.
                    </span>
                  </div>
                  <p className="mt-1 text-sm font-semibold text-[#0A0A0A]">{sub.name}</p>
                  <p className="mt-1 text-xs text-[#262E36] leading-relaxed">
                    {sub.needsScoreFocus && sub.needsAttendanceFocus
                      ? 'Dual priority: raise quiz/exam score average and recover missed classes.'
                      : sub.needsScoreFocus
                        ? `Internal score average (${sub.averagePct}%) is below ${ACADEMIC_FOCUS_THRESHOLD}%. Schedule targeted revision.`
                        : `Attendance (${sub.attendancePct.toFixed(1)}%) trails your ${student.targetAttendance}% target.`}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Record Internal Exam / Quiz / Assignment Score */}
      <section className="luxury-card rounded-xl p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#EDEAE6]">
          <div>
            <h2 className="font-display text-base font-semibold text-[#1C1C1C]">
              Record Marks & Assessment Ledger
            </h2>
            <p className="mt-0.5 text-xs text-[#262E36]">
              Log internal exams, quizzes, and graded assignments
            </p>
          </div>

          <div className="w-full sm:w-auto grid grid-cols-4 sm:flex items-center gap-1 p-1 rounded-lg bg-[#EDEAE6]/60 border border-[#D3D1CE]">
            {(['All', 'Exam', 'Quiz', 'Assignment'] as const).map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategoryFilter(cat)}
                className={`min-h-[44px] sm:min-h-[36px] px-2 sm:px-3 py-1 rounded-md text-[11px] sm:text-xs font-medium transition-colors whitespace-nowrap truncate cursor-pointer ${
                  categoryFilter === cat
                    ? 'bg-[#0F223A] text-white'
                    : 'text-[#262E36] hover:text-[#0A0A0A]'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        <form
          onSubmit={(e) => void handleAddMark(e)}
          className="mt-4 pb-5 border-b border-[#EDEAE6] grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-end"
        >
          <div className="lg:col-span-2">
            <label htmlFor="mrk-course" className="block text-xs font-medium text-[#1C1C1C] mb-1">
              Course
            </label>
            <select
              id="mrk-course"
              value={activeCourseCode}
              onChange={(e) => setCourseCode(e.target.value)}
              className="w-full min-h-[44px] px-3 rounded-lg border border-[#D3D1CE] bg-white text-sm"
            >
              {subjects.map((s) => (
                <option key={s.id} value={s.code}>
                  {s.code}
                </option>
              ))}
            </select>
          </div>

          <div className="lg:col-span-2">
            <label htmlFor="mrk-type" className="block text-xs font-medium text-[#1C1C1C] mb-1">
              Type
            </label>
            <select
              id="mrk-type"
              value={assessmentType}
              onChange={(e) => setAssessmentType(e.target.value as AssessmentCategory)}
              className="w-full min-h-[44px] px-3 rounded-lg border border-[#D3D1CE] bg-white text-sm"
            >
              <option value="Exam">Exam</option>
              <option value="Quiz">Quiz</option>
              <option value="Assignment">Assignment</option>
            </select>
          </div>

          <div className="lg:col-span-3">
            <label htmlFor="mrk-title" className="block text-xs font-medium text-[#1C1C1C] mb-1">
              Assessment Title
            </label>
            <input
              id="mrk-title"
              type="text"
              value={assessmentTitle}
              onChange={(e) => setAssessmentTitle(e.target.value)}
              placeholder="e.g. Quiz II — Paging"
              className="w-full min-h-[44px] px-3 rounded-lg border border-[#D3D1CE] text-sm"
            />
          </div>

          <div className="lg:col-span-2">
            <label htmlFor="mrk-score" className="block text-xs font-medium text-[#1C1C1C] mb-1">
              Score / Max
            </label>
            <div className="flex gap-1.5">
              <input
                id="mrk-score"
                type="number"
                min={0}
                step={0.5}
                value={scoreObtained}
                onChange={(e) => setScoreObtained(Number(e.target.value))}
                aria-label="Score obtained"
                className="w-1/2 min-h-[44px] px-2.5 rounded-lg border border-[#D3D1CE] text-sm font-mono-tabular"
              />
              <input
                type="number"
                min={1}
                value={maxScore}
                onChange={(e) => setMaxScore(Number(e.target.value))}
                aria-label="Maximum score"
                className="w-1/2 min-h-[44px] px-2.5 rounded-lg border border-[#D3D1CE] text-sm font-mono-tabular"
              />
            </div>
          </div>

          <div className="lg:col-span-1">
            <label htmlFor="mrk-weight" className="block text-xs font-medium text-[#1C1C1C] mb-1">
              Wt %
            </label>
            <input
              id="mrk-weight"
              type="number"
              min={0}
              max={100}
              value={weightagePercent}
              onChange={(e) => setWeightagePercent(Number(e.target.value))}
              className="w-full min-h-[44px] px-2.5 rounded-lg border border-[#D3D1CE] text-sm font-mono-tabular"
            />
          </div>

          <div className="lg:col-span-2 flex gap-2">
            <input
              type="date"
              value={dateISO}
              onChange={(e) => setDateISO(e.target.value)}
              aria-label="Assessment date"
              className="sr-only"
            />
            <button
              type="submit"
              disabled={subjects.length === 0}
              className="w-full min-h-[44px] px-4 rounded-lg bg-[#0F223A] text-white text-xs font-medium hover:bg-[#2F466F] disabled:opacity-50 inline-flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Add Score</span>
            </button>
          </div>
        </form>

        {markError && (
          <p role="alert" className="mt-3 text-xs font-medium text-[#8B2626]">
            {markError}
          </p>
        )}

        {visibleMarks.length === 0 ? (
          <div className="py-10 text-center text-sm text-[#262E36]">
            No assessments recorded for this category.
          </div>
        ) : (
          <div className="divide-y divide-[#EDEAE6]">
            {visibleMarks.map((mark) => {
              const pct = Number(
                ((mark.scoreObtained / Math.max(1, mark.maxScore)) * 100).toFixed(1),
              );
              const isLow = pct < ACADEMIC_FOCUS_THRESHOLD;
              return (
                <div
                  key={mark.id}
                  className="py-3.5 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-[#536878]">
                      <span className="font-mono-tabular font-semibold text-[#0F223A]">
                        {mark.courseCode}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="font-medium text-[#2F466F]">
                        {mark.assessmentType ?? 'Exam'}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono-tabular">{mark.dateISO}</span>
                      <span aria-hidden="true">·</span>
                      <span className="tabular-nums">{mark.weightagePercent}% weight</span>
                    </div>
                    <p className="mt-0.5 text-sm font-medium text-[#0A0A0A] truncate">
                      {mark.assessmentTitle}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span
                      className={`font-mono-tabular text-sm font-semibold ${
                        isLow ? 'text-[#8B2626]' : 'text-[#0A0A0A]'
                      }`}
                    >
                      {mark.scoreObtained} / {mark.maxScore} ({pct}%)
                    </span>
                    <button
                      type="button"
                      onClick={() => void deleteMarkRecord(mark.id)}
                      aria-label={`Delete ${mark.assessmentTitle}`}
                      className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-[#536878] hover:text-[#8B2626] hover:bg-[#FDF2F2] cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Credit-Weighted Standing Table */}
      <section className="luxury-card rounded-xl overflow-hidden min-w-0">
        <div className="px-5 py-4 border-b border-[#EDEAE6]">
          <h2 className="font-display text-base font-semibold text-[#1C1C1C]">
            Course Standing & Grade Matrix
          </h2>
        </div>
        {subjectPerformance.length === 0 ? (
          <div className="py-10 text-center text-sm text-[#262E36]">
            No courses enrolled yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#D3D1CE] text-xs font-medium text-[#262E36] whitespace-nowrap">
                  <th className="py-3.5 px-4 sm:px-5">Course</th>
                  <th className="py-3.5 px-3 sm:px-4 text-right">Credits</th>
                  <th className="py-3.5 px-3 sm:px-4 text-right">Internal Avg</th>
                  <th className="py-3.5 px-3 sm:px-4 text-right">Attendance</th>
                  <th className="py-3.5 px-3 sm:px-4 text-right">Grade Pt</th>
                  <th className="py-3.5 px-4 sm:px-5 text-right">Grade</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EDEAE6] text-sm">
                {subjectPerformance.map((sub) => (
                  <tr key={sub.id} className="hover:bg-[#EDEAE6]/35">
                    <td className="py-3.5 px-4 sm:px-5 whitespace-nowrap">
                      <span className="font-mono-tabular text-xs text-[#536878] mr-2">
                        {sub.code}
                      </span>
                      <span className="font-medium text-[#0A0A0A]">{sub.name}</span>
                    </td>
                    <td className="py-3.5 px-3 sm:px-4 text-right font-mono-tabular">{sub.credits}</td>
                    <td
                      className={`py-3.5 px-3 sm:px-4 text-right font-mono-tabular ${
                        sub.needsScoreFocus ? 'font-semibold text-[#8B2626]' : 'text-[#0A0A0A]'
                      }`}
                    >
                      {sub.averagePct !== null ? `${sub.averagePct}%` : '—'}
                    </td>
                    <td className="py-3.5 px-3 sm:px-4 text-right font-mono-tabular">
                      {sub.attendancePct.toFixed(1)}%
                    </td>
                    <td className="py-3.5 px-3 sm:px-4 text-right font-mono-tabular">
                      {sub.gradePoint.toFixed(1)}
                    </td>
                    <td className="py-3.5 px-4 sm:px-5 text-right font-semibold text-[#0F223A]">
                      {sub.currentGrade}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
