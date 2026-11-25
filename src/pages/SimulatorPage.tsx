import { useMemo, useState } from 'react';
import { Minus, Plus, RotateCcw } from 'lucide-react';
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
import {
  calculateAttendancePercent,
  simulateAttending,
  simulateCombined,
  simulateMissing,
} from '../utils/attendanceMath';

export function SimulatorPage() {
  const { student, subjects, overallStats, getEffectiveTarget } = useAcademic();
  const [selectedScope, setSelectedScope] = useState<string>(subjects[0]?.id ?? 'aggregate');
  const [attendM, setAttendM] = useState<number>(4);
  const [missM, setMissM] = useState<number>(2);

  const activeData = useMemo(() => {
    if (selectedScope === 'aggregate' || subjects.length === 0) {
      return {
        label: 'All Courses (Semester Aggregate)',
        code: 'ALL',
        attended: overallStats.attended,
        total: overallStats.total,
        target: student.targetAttendance,
      };
    }
    const found = subjects.find((s) => s.id === selectedScope) ?? subjects[0];
    return {
      label: found.name,
      code: found.code,
      attended: found.attendedClasses,
      total: found.totalClasses,
      target: getEffectiveTarget(found),
    };
  }, [selectedScope, subjects, overallStats, student.targetAttendance, getEffectiveTarget]);

  const currentPct = calculateAttendancePercent(activeData.attended, activeData.total);
  const attendOnlyPct = simulateAttending(activeData.attended, activeData.total, attendM);
  const missOnlyPct = simulateMissing(activeData.attended, activeData.total, missM);
  const combinedPct = simulateCombined(activeData.attended, activeData.total, attendM, missM);

  const attendDelta = attendOnlyPct - currentPct;
  const missDelta = missOnlyPct - currentPct;
  const combinedDelta = combinedPct - currentPct;

  const chartBars = useMemo(
    () => [
      {
        scenario: 'Current',
        rate: Number(currentPct.toFixed(1)),
        fill: '#536878',
      },
      {
        scenario: `Attend +${attendM}`,
        rate: Number(attendOnlyPct.toFixed(1)),
        fill: '#0F223A',
      },
      {
        scenario: `Miss +${missM}`,
        rate: Number(missOnlyPct.toFixed(1)),
        fill: missOnlyPct + 1e-9 >= activeData.target ? '#2F466F' : '#8B2626',
      },
      {
        scenario: 'Net Combined',
        rate: Number(combinedPct.toFixed(1)),
        fill: combinedPct + 1e-9 >= activeData.target ? '#2F466F' : '#8B2626',
      },
    ],
    [currentPct, attendOnlyPct, missOnlyPct, combinedPct, attendM, missM, activeData.target],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="What-If Simulator"
        subtitle="Test attending or missing future classes with instant real-time recalculation"
        action={
          <button
            type="button"
            onClick={() => {
              setAttendM(0);
              setMissM(0);
            }}
            className="min-h-[44px] px-4 py-2 rounded-lg border border-[#D3D1CE] bg-white text-xs font-medium text-[#1C1C1C] hover:border-[#2F466F] transition-colors inline-flex items-center gap-1.5 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Reset Sliders</span>
          </button>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        {/* Left Interactive Controls */}
        <section className="lg:col-span-5 luxury-card rounded-xl p-5 sm:p-6 flex flex-col justify-between space-y-6">
          <div>
            <label htmlFor="sim-scope" className="block text-xs font-medium text-[#1C1C1C] mb-1.5">
              Course or Semester Scope
            </label>
            <select
              id="sim-scope"
              value={selectedScope}
              onChange={(e) => setSelectedScope(e.target.value)}
              className="w-full min-h-[44px] px-3.5 py-2 rounded-lg border border-[#D3D1CE] bg-white text-sm text-[#0A0A0A] focus:outline-none focus:border-[#2F466F]"
            >
              {subjects.map((sub) => (
                <option key={sub.id} value={sub.id}>
                  {sub.code} — {sub.name}
                </option>
              ))}
              <option value="aggregate">All Courses (Aggregate Semester)</option>
            </select>
            <p className="mt-2 text-xs text-[#262E36] tabular-nums">
              Baseline: {activeData.attended} attended of {activeData.total} conducted (
              {currentPct.toFixed(1)}%)
            </p>
          </div>

          {/* Touch-friendly Slider 1: Attend m */}
          <div className="pt-5 border-t border-[#EDEAE6]">
            <div className="flex items-center justify-between gap-3 mb-2">
              <label htmlFor="slider-attend" className="text-sm font-medium text-[#0A0A0A]">
                Classes I plan to attend (m)
              </label>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setAttendM((v) => Math.max(0, v - 1))}
                  aria-label="Decrease planned classes attended"
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg border border-[#D3D1CE] hover:border-[#2F466F] cursor-pointer"
                >
                  <Minus className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
                <span className="w-8 text-center font-mono-tabular text-sm font-semibold text-[#0F223A]">
                  {attendM}
                </span>
                <button
                  type="button"
                  onClick={() => setAttendM((v) => Math.min(25, v + 1))}
                  aria-label="Increase planned classes attended"
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg border border-[#D3D1CE] hover:border-[#2F466F] cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              </div>
            </div>

            <input
              id="slider-attend"
              type="range"
              min={0}
              max={25}
              step={1}
              value={attendM}
              onChange={(e) => setAttendM(Number(e.target.value))}
              className="w-full h-11 accent-[#0F223A] cursor-pointer"
            />
            <p className="text-xs text-[#262E36] tabular-nums">
              New Attendance = ({activeData.attended} + {attendM}) / ({activeData.total} +{' '}
              {attendM}) ={' '}
              <span className="font-mono-tabular font-semibold text-[#0F223A]">
                {attendOnlyPct.toFixed(1)}%
              </span>
            </p>
          </div>

          {/* Touch-friendly Slider 2: Miss m */}
          <div className="pt-5 border-t border-[#EDEAE6]">
            <div className="flex items-center justify-between gap-3 mb-2">
              <label htmlFor="slider-miss" className="text-sm font-medium text-[#0A0A0A]">
                Classes I might miss (m)
              </label>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setMissM((v) => Math.max(0, v - 1))}
                  aria-label="Decrease planned classes missed"
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg border border-[#D3D1CE] hover:border-[#8B2626] cursor-pointer"
                >
                  <Minus className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
                <span className="w-8 text-center font-mono-tabular text-sm font-semibold text-[#8B2626]">
                  {missM}
                </span>
                <button
                  type="button"
                  onClick={() => setMissM((v) => Math.min(20, v + 1))}
                  aria-label="Increase planned classes missed"
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg border border-[#D3D1CE] hover:border-[#8B2626] cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              </div>
            </div>

            <input
              id="slider-miss"
              type="range"
              min={0}
              max={20}
              step={1}
              value={missM}
              onChange={(e) => setMissM(Number(e.target.value))}
              className="w-full h-11 accent-[#8B2626] cursor-pointer"
            />
            <p className="text-xs text-[#262E36] tabular-nums">
              New Attendance = {activeData.attended} / ({activeData.total} + {missM}) ={' '}
              <span className="font-mono-tabular font-semibold text-[#8B2626]">
                {missOnlyPct.toFixed(1)}%
              </span>
            </p>
          </div>
        </section>

        {/* Right Live Visual Before/After Comparison */}
        <section className="lg:col-span-7 luxury-card rounded-xl p-5 sm:p-6 flex flex-col justify-between min-w-0">
          <div>
            <div className="flex items-start justify-between gap-3 pb-4 border-b border-[#EDEAE6]">
              <div>
                <p className="text-xs font-mono-tabular text-[#536878]">{activeData.code}</p>
                <h2 className="mt-0.5 font-display text-lg font-semibold text-[#0A0A0A]">
                  {activeData.label}
                </h2>
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs text-[#262E36]">Net Combined</p>
                <p
                  className={`font-display text-2xl font-semibold tabular-nums ${
                    combinedPct + 1e-9 >= activeData.target
                      ? 'text-[#2F466F]'
                      : 'text-[#8B2626]'
                  }`}
                >
                  {combinedPct.toFixed(1)}%
                </p>
              </div>
            </div>

            {/* Visual Before / After Comparison Bars */}
            <div className="mt-5 space-y-4">
              {[
                {
                  title: 'Current Baseline',
                  fraction: `${activeData.attended} / ${activeData.total}`,
                  pct: currentPct,
                  deltaText: 'Baseline',
                  barColor: 'bg-[#536878]',
                },
                {
                  title: `If Attending +${attendM} Classes`,
                  fraction: `${activeData.attended + attendM} / ${activeData.total + attendM}`,
                  pct: attendOnlyPct,
                  deltaText: `${attendDelta >= 0 ? '+' : ''}${attendDelta.toFixed(1)}%`,
                  barColor: 'bg-[#0F223A]',
                },
                {
                  title: `If Missing +${missM} Classes`,
                  fraction: `${activeData.attended} / ${activeData.total + missM}`,
                  pct: missOnlyPct,
                  deltaText: `${missDelta >= 0 ? '+' : ''}${missDelta.toFixed(1)}%`,
                  barColor:
                    missOnlyPct + 1e-9 >= activeData.target ? 'bg-[#2F466F]' : 'bg-[#8B2626]',
                },
                {
                  title: `Combined (+${attendM} Attended, +${missM} Missed)`,
                  fraction: `${activeData.attended + attendM} / ${
                    activeData.total + attendM + missM
                  }`,
                  pct: combinedPct,
                  deltaText: `${combinedDelta >= 0 ? '+' : ''}${combinedDelta.toFixed(1)}%`,
                  barColor:
                    combinedPct + 1e-9 >= activeData.target ? 'bg-[#2F466F]' : 'bg-[#8B2626]',
                },
              ].map((bar) => (
                <div key={bar.title}>
                  <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5 text-xs mb-1.5">
                    <span className="font-medium text-[#1C1C1C]">{bar.title}</span>
                    <span className="font-mono-tabular text-[#0A0A0A] shrink-0">
                      <span className="text-[#536878] mr-2">{bar.fraction}</span>
                      <span className="font-semibold">{bar.pct.toFixed(1)}%</span>
                      <span className="text-[#536878] ml-1.5">({bar.deltaText})</span>
                    </span>
                  </div>
                  <div className="relative h-2.5 w-full rounded-full bg-[#EDEAE6] overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-150 ${bar.barColor}`}
                      style={{ width: `${Math.min(100, Math.max(0, bar.pct))}%` }}
                    />
                    <div
                      title={`${activeData.target}% benchmark`}
                      className="absolute top-0 bottom-0 w-0.5 bg-[#0A0A0A]/60"
                      style={{ left: `${activeData.target}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6 pt-5 border-t border-[#EDEAE6] h-[180px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartBars} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#EDEAE6" vertical={false} />
                <XAxis
                  dataKey="scenario"
                  tick={{ fontSize: 11, fill: '#1C1C1C' }}
                  axisLine={{ stroke: '#D3D1CE' }}
                  tickLine={false}
                />
                <YAxis
                  domain={[40, 100]}
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
                  formatter={(value) => [`${value ?? 0}%`, 'Attendance']}
                />
                <ReferenceLine y={activeData.target} stroke="#8B2626" strokeDasharray="4 4" />
                <Bar dataKey="rate" radius={[4, 4, 0, 0]} isAnimationActive={false}>
                  {chartBars.map((entry) => (
                    <Cell key={entry.scenario} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>
    </div>
  );
}
