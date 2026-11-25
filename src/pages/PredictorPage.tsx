import { useMemo, useState } from 'react';
import { AlertTriangle, CalendarCheck2, CheckCircle2, Minus, Plus } from 'lucide-react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { PageHeader } from '../components/PageHeader';
import { StandingText } from '../components/StandingText';
import { useAcademic } from '../context/AcademicContext';
import {
  computeRemainingInstructionalCalendar,
  isUitAcademicProfile,
} from '../data/uitAcademicCalendar';
import {
  calculateAttendancePercent,
  calculateRecoveryMetrics,
  deriveStanding,
} from '../utils/attendanceMath';

const LINE_PALETTE = [
  '#0F223A',
  '#2F466F',
  '#536878',
  '#8B2626',
  '#1F5E3B',
  '#8C5A12',
  '#4A5568',
];

function addDaysISO(dateISO: string, days: number): string {
  const dt = new Date(`${dateISO}T12:00:00`);
  if (!Number.isFinite(dt.getTime())) return dateISO;
  dt.setDate(dt.getDate() + days);
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const d = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatShortDate(dateISO: string): string {
  const dt = new Date(`${dateISO}T12:00:00`);
  if (!Number.isFinite(dt.getTime())) return dateISO;
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function PredictorPage() {
  const { student, subjects, weeklyTimetable, todayDateISO } = useAcademic();

  const [paceMode, setPaceMode] = useState<'historical' | 'custom'>('historical');
  const [customPace, setCustomPace] = useState(85);
  const [weekAdjustment, setWeekAdjustment] = useState(0);
  const [focusFilter, setFocusFilter] = useState<'all' | 'risk'>('all');

  const baseEndDateISO = student.semesterEnd || '2026-12-16';
  const effectiveEndDateISO = useMemo(() => {
    if (weekAdjustment === 0) return baseEndDateISO;
    return addDaysISO(baseEndDateISO, weekAdjustment * 7);
  }, [baseEndDateISO, weekAdjustment]);

  const applyUitExclusions = useMemo(() => isUitAcademicProfile(student), [student]);

  const calendarProjection = useMemo(
    () =>
      computeRemainingInstructionalCalendar({
        subjects,
        weeklyTimetable,
        startDateISO: todayDateISO,
        endDateISO: effectiveEndDateISO,
        applyUitExclusions,
      }),
    [subjects, weeklyTimetable, todayDateISO, effectiveEndDateISO, applyUitExclusions],
  );

  const projections = useMemo(() => {
    return subjects.map((sub, idx) => {
      const effectiveTarget = sub.targetAttendance ?? student.targetAttendance;
      const currentPct = calculateAttendancePercent(sub.attendedClasses, sub.totalClasses);
      const effectivePace =
        paceMode === 'historical' ? Math.round(currentPct) : customPace;
      const futureTotal = calendarProjection.remainingByCourse[sub.code.toUpperCase()] ?? 0;
      const futureAttended = Math.round((futureTotal * effectivePace) / 100);
      const finalAttended = sub.attendedClasses + futureAttended;
      const finalTotal = sub.totalClasses + futureTotal;
      const projectedPct = calculateAttendancePercent(finalAttended, finalTotal);
      const delta = projectedPct - currentPct;
      const standing = deriveStanding(finalAttended, finalTotal, effectiveTarget);
      const recovery = calculateRecoveryMetrics(
        sub.attendedClasses,
        sub.totalClasses,
        effectiveTarget,
      );
      const willDropBelow =
        projectedPct + 1e-9 < effectiveTarget ||
        currentPct + 1e-9 < effectiveTarget;

      return {
        ...sub,
        effectiveTarget,
        color: LINE_PALETTE[idx % LINE_PALETTE.length],
        currentPct,
        effectivePace,
        futureTotal,
        futureAttended,
        finalAttended,
        finalTotal,
        projectedPct,
        delta,
        standing,
        willDropBelow,
        safeSkipsRemaining: recovery.safeToMiss,
        neededNow: recovery.classesNeeded,
      };
    });
  }, [subjects, paceMode, customPace, calendarProjection, student.targetAttendance]);

  const weeklyChartData = useMemo(() => {
    const rows: Array<Record<string, number | string>> = [];

    const nowRow: Record<string, number | string> = { weekLabel: 'Now' };
    projections.forEach((proj) => {
      nowRow[proj.code] = Number(proj.currentPct.toFixed(1));
    });
    rows.push(nowRow);

    const cumulativeTotals: Record<string, number> = {};
    calendarProjection.weeklyBuckets.forEach((bucket) => {
      const row: Record<string, number | string> = {
        weekLabel: `Wk of ${bucket.weekLabel}`,
      };
      projections.forEach((proj) => {
        const code = proj.code.toUpperCase();
        const weeklyCount =
          (bucket.sessionsByCourse[code] ?? 0) ||
          Math.round((proj.weeklyHours / 5) * bucket.instructionalDays);
        const addCount =
          weeklyTimetable.some((s) => s.courseCode.toUpperCase() === code)
            ? (bucket.sessionsByCourse[code] ?? 0)
            : weeklyCount;
        cumulativeTotals[code] = (cumulativeTotals[code] ?? 0) + addCount;
        const addedTotal = cumulativeTotals[code];
        const addedAttended = Math.round((addedTotal * proj.effectivePace) / 100);
        const pct = calculateAttendancePercent(
          proj.attendedClasses + addedAttended,
          proj.totalClasses + addedTotal,
        );
        row[proj.code] = Number(pct.toFixed(1));
      });
      rows.push(row);
    });

    return rows;
  }, [projections, calendarProjection.weeklyBuckets, weeklyTimetable]);

  const visibleProjections = useMemo(
    () => (focusFilter === 'risk' ? projections.filter((p) => p.willDropBelow) : projections),
    [projections, focusFilter],
  );

  const atRiskProjections = useMemo(
    () => projections.filter((p) => p.projectedPct + 1e-9 < p.effectiveTarget),
    [projections],
  );

  const endDisplay = formatShortDate(effectiveEndDateISO);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Attendance Predictor"
        subtitle={`Calendar-aware trajectory from ${formatShortDate(todayDateISO)} to Last Teaching Day (${endDisplay}) against ${student.targetAttendance}% benchmark`}
        action={
          <div className="w-full sm:w-auto grid grid-cols-2 sm:flex items-center gap-1 p-1 rounded-lg bg-white border border-[#D3D1CE]">
            <button
              type="button"
              onClick={() => setPaceMode('historical')}
              className={`min-h-[44px] sm:min-h-[38px] px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                paceMode === 'historical'
                  ? 'bg-[#0F223A] text-white'
                  : 'text-[#262E36] hover:text-[#0A0A0A]'
              }`}
            >
              Current Pace (A/T)
            </button>
            <button
              type="button"
              onClick={() => setPaceMode('custom')}
              className={`min-h-[44px] sm:min-h-[38px] px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                paceMode === 'custom'
                  ? 'bg-[#0F223A] text-white'
                  : 'text-[#262E36] hover:text-[#0A0A0A]'
              }`}
            >
              Custom Pace
            </button>
          </div>
        }
      />

      {subjects.length === 0 ? (
        <div className="luxury-card rounded-xl p-10 text-center">
          <p className="text-sm font-medium text-[#0A0A0A]">No courses to project yet</p>
          <p className="mt-1 text-xs text-[#262E36]">
            Add enrolled subjects in My Attendance or load your preset in Settings to generate calendar-aware projections.
          </p>
        </div>
      ) : (
        <>
          {/* Calendar-Aware Window & Early Warning Banner */}
          <section className="luxury-card rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              {atRiskProjections.length > 0 ? (
                <AlertTriangle className="w-5 h-5 text-[#8B2626] shrink-0 mt-0.5" aria-hidden="true" />
              ) : (
                <CheckCircle2 className="w-5 h-5 text-[#1F5E3B] shrink-0 mt-0.5" aria-hidden="true" />
              )}
              <div>
                <h2 className="font-display text-sm font-semibold text-[#0A0A0A]">
                  {atRiskProjections.length > 0
                    ? `${atRiskProjections.length} course${atRiskProjections.length === 1 ? '' : 's'} projected below ${student.targetAttendance}% by ${endDisplay}`
                    : `All courses projected to clear ${student.targetAttendance}% by ${endDisplay}`}
                </h2>
                <p className="mt-0.5 text-xs text-[#262E36]">
                  {atRiskProjections.length > 0
                    ? `Flagged: ${atRiskProjections.map((p) => `${p.code} (${p.projectedPct.toFixed(1)}%)`).join(' · ')}`
                    : 'Maintain current attendance cadence across remaining instructional weekdays.'}
                </p>
                <p className="mt-1.5 inline-flex items-center gap-1.5 text-[11px] font-medium text-[#2F466F] tabular-nums">
                  <CalendarCheck2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  <span>
                    {calendarProjection.instructionalDays} instructional weekdays remaining ·{' '}
                    {calendarProjection.skippedWeekends} weekend days &amp;{' '}
                    {calendarProjection.skippedHolidays.length} holiday/exam days excluded
                  </span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs text-[#262E36]">Horizon Offset:</span>
              <button
                type="button"
                onClick={() => setWeekAdjustment((w) => Math.max(-2, w - 1))}
                aria-label="Shorten prediction horizon by 1 week"
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg border border-[#D3D1CE] hover:border-[#2F466F] cursor-pointer"
              >
                <Minus className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
              <span className="font-mono-tabular text-xs font-semibold min-w-[68px] text-center">
                {weekAdjustment === 0
                  ? 'Dec 16'
                  : `${weekAdjustment > 0 ? '+' : ''}${weekAdjustment} wk`}
              </span>
              <button
                type="button"
                onClick={() => setWeekAdjustment((w) => Math.min(4, w + 1))}
                aria-label="Extend prediction horizon by 1 week"
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg border border-[#D3D1CE] hover:border-[#2F466F] cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            </div>
          </section>

          {/* Main Chart + Controls */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <section className="lg:col-span-8 luxury-card rounded-xl p-5 sm:p-6 min-w-0">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <div>
                  <h2 className="font-display text-base font-semibold text-[#1C1C1C]">
                    Projected Trajectory Through {endDisplay}
                  </h2>
                  <p className="text-xs text-[#262E36] mt-0.5">
                    {paceMode === 'historical'
                      ? 'Using exact Mon–Fri timetable slots per instructional day at each subject’s current pace'
                      : `Simulating ${customPace}% attendance across exact remaining timetable sessions`}
                  </p>
                </div>
                <div className="flex items-center gap-1 p-1 rounded-lg bg-[#EDEAE6] self-start sm:self-auto">
                  <button
                    type="button"
                    onClick={() => setFocusFilter('all')}
                    className={`min-h-[44px] sm:min-h-[34px] px-3 py-1 rounded text-xs font-medium cursor-pointer ${
                      focusFilter === 'all' ? 'bg-white text-[#0A0A0A]' : 'text-[#262E36]'
                    }`}
                  >
                    All
                  </button>
                  <button
                    type="button"
                    onClick={() => setFocusFilter('risk')}
                    className={`min-h-[44px] sm:min-h-[34px] px-3 py-1 rounded text-xs font-medium cursor-pointer ${
                      focusFilter === 'risk' ? 'bg-white text-[#8B2626]' : 'text-[#262E36]'
                    }`}
                  >
                    At-Risk Only
                  </button>
                </div>
              </div>

              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={weeklyChartData} margin={{ top: 10, right: 16, left: -16, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#EDEAE6" vertical={false} />
                    <XAxis
                      dataKey="weekLabel"
                      tick={{ fontSize: 11, fill: '#262E36' }}
                      axisLine={{ stroke: '#D3D1CE' }}
                      tickLine={false}
                    />
                    <YAxis
                      domain={[55, 100]}
                      tick={{ fontSize: 11, fill: '#262E36' }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v) => `${v}%`}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#FFFFFF',
                        border: '1px solid #D3D1CE',
                        borderRadius: '8px',
                        fontSize: '12px',
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: '12px' }} />
                    <ReferenceLine
                      y={student.targetAttendance}
                      stroke="#8B2626"
                      strokeDasharray="4 4"
                      label={{
                        value: `${student.targetAttendance}% Benchmark`,
                        position: 'insideTopRight',
                        fill: '#8B2626',
                        fontSize: 11,
                      }}
                    />
                    {visibleProjections.map((proj) => (
                      <Line
                        key={proj.id}
                        type="monotone"
                        dataKey={proj.code}
                        stroke={proj.color}
                        strokeWidth={2}
                        dot={{ r: 3 }}
                        isAnimationActive={false}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </section>

            {/* Pace Control & Quick Projection Table */}
            <section className="lg:col-span-4 luxury-card rounded-xl p-5 sm:p-6 flex flex-col justify-between">
              <div>
                <h2 className="font-display text-base font-semibold text-[#1C1C1C]">
                  Scenario Parameters
                </h2>
                <p className="text-xs text-[#262E36] mt-0.5">
                  {paceMode === 'custom'
                    ? 'Drag to test uniform attendance across remaining scheduled classes'
                    : 'Switch to Custom Pace to simulate 100% recovery before finals'}
                </p>

                <div className="mt-5 p-4 rounded-lg bg-[#EDEAE6]/55 border border-[#D3D1CE]">
                  <div className="flex items-center justify-between text-xs mb-2">
                    <span className="font-medium text-[#1C1C1C]">Target Future Pace</span>
                    <span className="font-mono-tabular font-semibold text-[#0F223A]">
                      {paceMode === 'historical' ? 'Per-Course' : `${customPace}%`}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={50}
                    max={100}
                    step={5}
                    value={customPace}
                    onChange={(e) => {
                      setPaceMode('custom');
                      setCustomPace(Number(e.target.value));
                    }}
                    aria-label="Future attendance pace percentage"
                    className="w-full h-11 accent-[#2F466F] cursor-pointer"
                  />
                  <div className="flex justify-between text-[11px] text-[#536878] tabular-nums mt-1">
                    <span>50%</span>
                    <span>75%</span>
                    <span>100%</span>
                  </div>
                </div>
              </div>

              <div className="mt-5 pt-4 border-t border-[#EDEAE6] divide-y divide-[#EDEAE6]">
                {projections.map((item) => (
                  <div key={item.id} className="py-2.5 flex items-center justify-between gap-2 text-xs">
                    <div className="min-w-0 flex items-baseline gap-1.5">
                      <span className="font-mono-tabular font-semibold text-[#0F223A] shrink-0">
                        {item.code}
                      </span>
                      <span className="text-[#262E36] truncate">
                        (+{item.futureTotal} left)
                      </span>
                    </div>
                    <span
                      className={`font-mono-tabular font-semibold shrink-0 ${
                        item.projectedPct + 1e-9 < student.targetAttendance
                          ? 'text-[#8B2626]'
                          : 'text-[#0A0A0A]'
                      }`}
                    >
                      {item.currentPct.toFixed(1)}% → {item.projectedPct.toFixed(1)}%
                    </span>
                  </div>
                ))}
              </div>
            </section>
          </div>

          {/* Subject Risk & Early Warning Cards */}
          <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {projections.map((proj) => (
              <div key={proj.id} className="luxury-card rounded-xl p-5">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-mono-tabular font-semibold text-[#0F223A]">{proj.code}</span>
                  <StandingText standing={proj.standing} />
                </div>
                <h3 className="mt-1 font-display text-base font-semibold text-[#0A0A0A]">
                  {proj.name}
                </h3>

                <div className="mt-4 grid grid-cols-2 gap-3 pt-3 border-t border-[#EDEAE6]">
                  <div>
                    <p className="text-[11px] text-[#262E36]">Current</p>
                    <p className="font-mono-tabular text-lg font-semibold text-[#0A0A0A]">
                      {proj.currentPct.toFixed(1)}%
                    </p>
                    <p className="text-[11px] text-[#536878] tabular-nums">
                      {proj.attendedClasses}/{proj.totalClasses}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] text-[#262E36]">Projected ({endDisplay})</p>
                    <p
                      className={`font-mono-tabular text-lg font-semibold ${
                        proj.projectedPct + 1e-9 < student.targetAttendance
                          ? 'text-[#8B2626]'
                          : 'text-[#2F466F]'
                      }`}
                    >
                      {proj.projectedPct.toFixed(1)}%
                    </p>
                    <p className="text-[11px] text-[#536878] tabular-nums">
                      {proj.finalAttended}/{proj.finalTotal} (+{proj.futureTotal} sched.)
                    </p>
                  </div>
                </div>

                <p className="mt-3 pt-3 border-t border-[#EDEAE6] text-xs text-[#262E36] tabular-nums">
                  {proj.neededNow > 0
                    ? `Early Warning: Below ${student.targetAttendance}%. Attend ${proj.neededNow} consecutive sessions to recover (${proj.futureTotal} scheduled left).`
                    : `Safe Buffer: Can miss up to ${proj.safeSkipsRemaining} class${proj.safeSkipsRemaining === 1 ? '' : 'es'} now while staying >= ${student.targetAttendance}%.`}
                </p>
              </div>
            ))}
          </section>
        </>
      )}
    </div>
  );
}
