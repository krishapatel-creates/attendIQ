import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, ArrowUpRight, RefreshCw, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { PageHeader } from '../components/PageHeader';
import { useAcademic } from '../context/AcademicContext';
import { buildAcademicSnapshot } from '../utils/academicSnapshot';

interface InsightsResponse {
  executiveSummary: string;
  attendancePatterns: Array<{
    title: string;
    observation: string;
    metric: string;
    status: 'positive' | 'watch' | 'critical';
  }>;
  attendanceMarksCorrelation: {
    headline: string;
    analysis: string;
    highlightedCourses: Array<{
      courseCode: string;
      attendancePercent: number;
      marksPercent?: number | null;
      takeaway: string;
    }>;
  };
  strongVsWeak: {
    strongSubjects: Array<{ courseCode: string; summary: string }>;
    weakSubjects: Array<{ courseCode: string; summary: string }>;
  };
  weeklyRecommendations: Array<{
    actionTitle: string;
    courseCode: string;
    rationale: string;
    priority: 'high' | 'medium' | 'normal';
  }>;
  generatedAt?: string;
}

export function InsightsPage() {
  const {
    student,
    overallStats,
    attendanceTrend,
    subjects,
    exams,
    marks,
    studyTasks,
    weeklyTimetable,
  } = useAcademic();

  const [insights, setInsights] = useState<InsightsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const hasAutoFetchedRef = useRef(false);

  const snapshot = useMemo(
    () =>
      buildAcademicSnapshot({
        student,
        overallStats,
        subjects,
        exams,
        marks,
        studyTasks,
        weeklyTimetable,
      }),
    [student, overallStats, subjects, exams, marks, studyTasks, weeklyTimetable],
  );

  const subjectChartData = useMemo(
    () =>
      subjects.map((s) => ({
        code: s.code,
        rate: Number(((s.attendedClasses / Math.max(1, s.totalClasses)) * 100).toFixed(1)),
      })),
    [subjects],
  );

  const fetchInsights = useCallback(async () => {
    if (subjects.length === 0) return;
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const response = await fetch('/api/ai/insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ snapshot }),
      });
      const payload = (await response.json()) as InsightsResponse & { error?: string };
      if (!response.ok || !payload.executiveSummary) {
        throw new Error(payload.error || 'Could not generate AI insights.');
      }
      setInsights(payload);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to generate academic insights.');
    } finally {
      setIsLoading(false);
    }
  }, [snapshot, subjects.length]);

  useEffect(() => {
    if (!hasAutoFetchedRef.current && subjects.length > 0) {
      hasAutoFetchedRef.current = true;
      void fetchInsights();
    }
  }, [fetchInsights, subjects.length]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Academic Insights"
        subtitle="AI-grounded attendance patterns, attendance-marks correlation, and weekly recommendations"
        action={
          <button
            type="button"
            disabled={isLoading || subjects.length === 0}
            onClick={() => void fetchInsights()}
            className="min-h-[44px] px-4 py-2 rounded-lg bg-[#0F223A] text-white text-xs font-medium hover:bg-[#2F466F] disabled:opacity-50 transition-colors inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} aria-hidden="true" />
            <span>{isLoading ? 'Analyzing...' : 'Refresh Insights'}</span>
          </button>
        }
      />

      {subjects.length === 0 ? (
        <div className="luxury-card rounded-xl p-10 text-center">
          <p className="text-sm font-medium text-[#0A0A0A]">No academic records to analyze yet</p>
          <p className="mt-1 text-xs text-[#262E36]">
            Add courses and marks first to generate attendance correlation and weekly insights.
          </p>
        </div>
      ) : (
        <>
      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <section className="luxury-card rounded-xl p-5 sm:p-6 min-w-0">
          <h2 className="font-display text-base font-semibold text-[#1C1C1C] mb-4">
            14-Day Attendance Velocity
          </h2>
          <div className="h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={attendanceTrend} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#EDEAE6" vertical={false} />
                <XAxis dataKey="dateLabel" tick={{ fontSize: 11, fill: '#262E36' }} />
                <YAxis domain={[68, 86]} tick={{ fontSize: 11, fill: '#262E36' }} />
                <Tooltip />
                <Area type="monotone" dataKey="rate" stroke="#2F466F" fill="#2F466F" fillOpacity={0.14} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="luxury-card rounded-xl p-5 sm:p-6 min-w-0">
          <h2 className="font-display text-base font-semibold text-[#1C1C1C] mb-4">
            Course Standing Comparison
          </h2>
          <div className="h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={subjectChartData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#EDEAE6" vertical={false} />
                <XAxis dataKey="code" tick={{ fontSize: 11, fill: '#262E36' }} />
                <YAxis domain={[50, 100]} tick={{ fontSize: 11, fill: '#262E36' }} />
                <Tooltip />
                <Bar dataKey="rate" fill="#0F223A" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      {/* Error State */}
      {errorMsg && (
        <div
          role="alert"
          className="luxury-card rounded-xl p-5 border-[#8B2626]/30 bg-[#FDF2F2] flex flex-col sm:flex-row sm:items-center justify-between gap-3"
        >
          <div className="flex items-start gap-2.5 text-sm text-[#8B2626]">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
            <span>{errorMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => void fetchInsights()}
            className="min-h-[44px] px-4 rounded-lg bg-[#8B2626] text-white text-xs font-medium hover:bg-[#701D1D] shrink-0 cursor-pointer"
          >
            Retry Analysis
          </button>
        </div>
      )}

      {/* Loading Skeleton */}
      {isLoading && !insights && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-pulse">
          {[1, 2, 3].map((item) => (
            <div key={item} className="luxury-card rounded-xl p-6 space-y-3">
              <div className="h-3 w-24 bg-[#D3D1CE] rounded" />
              <div className="h-5 w-3/4 bg-[#D3D1CE] rounded" />
              <div className="h-14 w-full bg-[#EDEAE6] rounded" />
            </div>
          ))}
        </div>
      )}

      {/* Grounded Gemini Insights Sections */}
      {insights && (
        <div className="space-y-6">
          {/* Executive Brief */}
          <section className="luxury-card rounded-xl p-5 sm:p-6">
            <div className="flex items-center justify-between gap-2 text-xs font-medium text-[#2F466F]">
              <span className="inline-flex items-center gap-1.5 uppercase tracking-wider">
                <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
                Grounded Synthesis
              </span>
              {insights.generatedAt && (
                <span className="font-mono-tabular text-[#536878]">
                  Updated {new Date(insights.generatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </div>
            <p className="mt-2.5 text-sm sm:text-base text-[#0A0A0A] leading-relaxed">
              {insights.executiveSummary}
            </p>
          </section>

          {/* Attendance Patterns */}
          <section className="space-y-3">
            <h2 className="font-display text-base font-semibold text-[#1C1C1C]">
              Attendance Pattern Diagnostics
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {insights.attendancePatterns.map((pattern, idx) => (
                <article key={idx} className="luxury-card rounded-xl p-5 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span
                        className={`font-semibold uppercase tracking-wide ${
                          pattern.status === 'critical'
                            ? 'text-[#8B2626]'
                            : pattern.status === 'watch'
                              ? 'text-[#8C5A12]'
                              : 'text-[#1F5E3B]'
                        }`}
                      >
                        {pattern.status}
                      </span>
                      <span className="font-mono-tabular font-semibold text-[#0F223A]">
                        {pattern.metric}
                      </span>
                    </div>
                    <h3 className="mt-2 font-display text-sm font-semibold text-[#0A0A0A]">
                      {pattern.title}
                    </h3>
                    <p className="mt-1.5 text-xs text-[#262E36] leading-relaxed">
                      {pattern.observation}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          </section>

          {/* Attendance vs. Internal Marks Correlation */}
          <section className="luxury-card rounded-xl p-5 sm:p-6">
            <div className="pb-4 border-b border-[#EDEAE6]">
              <p className="text-xs font-medium uppercase tracking-wider text-[#536878]">
                Attendance & Marks Correlation
              </p>
              <h2 className="mt-1 font-display text-base font-semibold text-[#0A0A0A]">
                {insights.attendanceMarksCorrelation.headline}
              </h2>
              <p className="mt-1.5 text-sm text-[#262E36] leading-relaxed">
                {insights.attendanceMarksCorrelation.analysis}
              </p>
            </div>

            <div className="divide-y divide-[#EDEAE6]">
              {insights.attendanceMarksCorrelation.highlightedCourses.map((row) => (
                <div
                  key={row.courseCode}
                  className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <span className="font-mono-tabular text-xs font-semibold text-[#0F223A]">
                      {row.courseCode}
                    </span>
                    <p className="mt-0.5 text-xs text-[#262E36]">{row.takeaway}</p>
                  </div>
                  <div className="flex items-center gap-4 text-xs font-mono-tabular shrink-0">
                    <span className="text-[#0A0A0A]">
                      Attendance: <strong>{row.attendancePercent.toFixed(1)}%</strong>
                    </span>
                    <span className="text-[#2F466F]">
                      Marks:{' '}
                      <strong>
                        {row.marksPercent !== null && row.marksPercent !== undefined
                          ? `${row.marksPercent.toFixed(1)}%`
                          : 'No records'}
                      </strong>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Strong vs Weak Subjects */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <section className="luxury-card rounded-xl p-5 sm:p-6">
              <h2 className="font-display text-base font-semibold text-[#1F5E3B] pb-3 border-b border-[#EDEAE6]">
                Strong Standing Subjects
              </h2>
              <div className="divide-y divide-[#EDEAE6]">
                {insights.strongVsWeak.strongSubjects.map((item) => (
                  <div key={item.courseCode} className="py-3.5">
                    <span className="font-mono-tabular text-xs font-semibold text-[#0F223A]">
                      {item.courseCode}
                    </span>
                    <p className="mt-1 text-xs text-[#262E36] leading-relaxed">{item.summary}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="luxury-card rounded-xl p-5 sm:p-6">
              <h2 className="font-display text-base font-semibold text-[#8B2626] pb-3 border-b border-[#EDEAE6]">
                Subjects Requiring Immediate Focus
              </h2>
              <div className="divide-y divide-[#EDEAE6]">
                {insights.strongVsWeak.weakSubjects.map((item) => (
                  <div key={item.courseCode} className="py-3.5">
                    <span className="font-mono-tabular text-xs font-semibold text-[#8B2626]">
                      {item.courseCode}
                    </span>
                    <p className="mt-1 text-xs text-[#262E36] leading-relaxed">{item.summary}</p>
                  </div>
                ))}
              </div>
            </section>
          </div>

          {/* Weekly Recommendations */}
          <section className="luxury-card rounded-xl p-5 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-[#EDEAE6]">
              <div>
                <h2 className="font-display text-base font-semibold text-[#1C1C1C]">
                  Actionable Weekly Recommendations
                </h2>
                <p className="text-xs text-[#262E36] mt-0.5">
                  Prioritized interventions derived from your saved attendance, marks, and exam calendar
                </p>
              </div>
              <Link
                to="/study-planner"
                className="text-xs font-medium text-[#2F466F] hover:text-[#0F223A] inline-flex items-center gap-1 whitespace-nowrap"
              >
                <span>Open Study Planner</span>
                <ArrowUpRight className="w-3.5 h-3.5" aria-hidden="true" />
              </Link>
            </div>

            <div className="divide-y divide-[#EDEAE6]">
              {insights.weeklyRecommendations.map((rec, idx) => (
                <div
                  key={idx}
                  className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-xs">
                      <span
                        className={`font-semibold uppercase tracking-wide ${
                          rec.priority === 'high'
                            ? 'text-[#8B2626]'
                            : rec.priority === 'medium'
                              ? 'text-[#2F466F]'
                              : 'text-[#536878]'
                        }`}
                      >
                        {rec.priority} priority
                      </span>
                      <span aria-hidden="true" className="text-[#536878]">
                        ·
                      </span>
                      <span className="font-mono-tabular font-semibold text-[#0F223A]">
                        {rec.courseCode}
                      </span>
                    </div>
                    <h3 className="mt-1 text-sm font-semibold text-[#0A0A0A]">
                      {rec.actionTitle}
                    </h3>
                    <p className="mt-0.5 text-xs text-[#262E36] leading-relaxed">
                      {rec.rationale}
                    </p>
                  </div>

                  <Link
                    to="/recovery"
                    className="self-start sm:self-center min-h-[44px] sm:min-h-[38px] px-3.5 py-2 rounded-lg border border-[#D3D1CE] text-xs font-medium text-[#0F223A] hover:border-[#2F466F] whitespace-nowrap shrink-0 inline-flex items-center gap-1"
                  >
                    <span>Plan Recovery</span>
                    <ArrowUpRight className="w-3.5 h-3.5" aria-hidden="true" />
                  </Link>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
        </>
      )}
    </div>
  );
}
