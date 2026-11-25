import { useMemo, useState } from 'react';
import { CalendarDays, CheckCircle2, Minus, Plus } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { StandingText } from '../components/StandingText';
import { useAcademic } from '../context/AcademicContext';
import { isUitAcademicProfile } from '../data/uitAcademicCalendar';
import {
  buildRecoveryPlan,
  calculateAttendancePercent,
  calculateRecoveryMetrics,
  deriveStanding,
} from '../utils/attendanceMath';

const PRESET_TARGETS = [75, 80, 85] as const;

export function RecoveryPage() {
  const { student, subjects, weeklyTimetable, todayDateISO } = useAcademic();
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>(subjects[0]?.id ?? '');
  const [targetPercent, setTargetPercent] = useState<number>(student.targetAttendance);

  const selectedSubject = useMemo(
    () => subjects.find((s) => s.id === selectedSubjectId) ?? subjects[0],
    [subjects, selectedSubjectId],
  );

  const handleSelectSubject = (subId: string) => {
    setSelectedSubjectId(subId);
    const nextSub = subjects.find((s) => s.id === subId);
    if (nextSub) {
      setTargetPercent(nextSub.targetAttendance ?? student.targetAttendance);
    }
  };

  const recovery = useMemo(() => {
    if (!selectedSubject) {
      return {
        currentPercent: 0,
        targetPercent,
        isSafeZone: true,
        classesNeeded: 0,
        safeToMiss: 0,
      };
    }
    return calculateRecoveryMetrics(
      selectedSubject.attendedClasses,
      selectedSubject.totalClasses,
      targetPercent,
    );
  }, [selectedSubject, targetPercent]);

  const recoveryPlan = useMemo(() => {
    if (!selectedSubject) {
      return { projectedDateLabel: 'N/A', steps: [] };
    }
    return buildRecoveryPlan(
      selectedSubject.code,
      selectedSubject.attendedClasses,
      selectedSubject.totalClasses,
      recovery.classesNeeded,
      selectedSubject.weeklyHours,
      weeklyTimetable,
      todayDateISO,
      isUitAcademicProfile(student),
    );
  }, [selectedSubject, recovery.classesNeeded, weeklyTimetable, todayDateISO, student]);

  const safeMissPreview = useMemo(() => {
    if (!selectedSubject || !recovery.isSafeZone || recovery.safeToMiss <= 0) return [];
    const maxSteps = Math.min(recovery.safeToMiss, 8);
    const items = [];
    for (let k = 1; k <= maxSteps; k++) {
      const nextT = selectedSubject.totalClasses + k;
      const pct = calculateAttendancePercent(selectedSubject.attendedClasses, nextT);
      items.push({
        missCount: k,
        attended: selectedSubject.attendedClasses,
        total: nextT,
        pct,
      });
    }
    return items;
  }, [selectedSubject, recovery]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Recovery Calculator"
        subtitle="Exact consecutive sessions required and timetable-projected recovery date"
        action={
          <div className="flex flex-wrap items-center gap-2">
            <div
              role="group"
              aria-label="Target attendance threshold presets"
              className="flex items-center gap-1 p-1 rounded-lg bg-white border border-[#D3D1CE]"
            >
              {PRESET_TARGETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setTargetPercent(preset)}
                  className={`min-h-[44px] sm:min-h-[38px] px-3 py-1 rounded-md text-xs font-mono-tabular font-medium transition-colors cursor-pointer ${
                    targetPercent === preset
                      ? 'bg-[#0F223A] text-white'
                      : 'text-[#262E36] hover:text-[#0A0A0A]'
                  }`}
                >
                  {preset}%
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1.5 bg-white border border-[#D3D1CE] rounded-lg px-2.5 py-1">
              <span className="text-xs text-[#262E36]">Custom:</span>
              <button
                type="button"
                onClick={() => setTargetPercent((v) => Math.max(50, v - 1))}
                aria-label="Decrease custom target"
                className="min-h-[44px] min-w-[44px] sm:min-h-[36px] sm:min-w-[36px] flex items-center justify-center rounded border border-[#D3D1CE] hover:border-[#2F466F] cursor-pointer"
              >
                <Minus className="w-3 h-3" aria-hidden="true" />
              </button>
              <span className="font-mono-tabular text-xs font-semibold w-9 text-center">
                {targetPercent}%
              </span>
              <button
                type="button"
                onClick={() => setTargetPercent((v) => Math.min(95, v + 1))}
                aria-label="Increase custom target"
                className="min-h-[44px] min-w-[44px] sm:min-h-[36px] sm:min-w-[36px] flex items-center justify-center rounded border border-[#D3D1CE] hover:border-[#2F466F] cursor-pointer"
              >
                <Plus className="w-3 h-3" aria-hidden="true" />
              </button>
            </div>
          </div>
        }
      />

      {subjects.length === 0 ? (
        <div className="luxury-card rounded-xl p-10 text-center">
          <p className="text-sm font-medium text-[#0A0A0A]">No courses available to analyze</p>
          <p className="mt-1 text-xs text-[#262E36]">
            Add at least one subject in My Attendance to calculate exact recovery classes.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Interactive Subject Selector */}
        <section
          aria-label="Subject selector"
          className="lg:col-span-4 luxury-card rounded-xl p-4 sm:p-5"
        >
          <h2 className="font-display text-sm font-semibold text-[#1C1C1C] pb-3 border-b border-[#EDEAE6]">
            Select Course
          </h2>
          <div className="mt-2 divide-y divide-[#EDEAE6]">
            {subjects.map((sub) => {
              const pct = calculateAttendancePercent(sub.attendedClasses, sub.totalClasses);
              const subTarget = sub.targetAttendance ?? student.targetAttendance;
              const standing = deriveStanding(sub.attendedClasses, sub.totalClasses, subTarget);
              const active = selectedSubject?.id === sub.id;

              return (
                <button
                  key={sub.id}
                  type="button"
                  onClick={() => handleSelectSubject(sub.id)}
                  className={`w-full min-h-[54px] py-3 px-3 my-0.5 rounded-lg flex items-center justify-between gap-3 text-left transition-colors cursor-pointer ${
                    active ? 'bg-[#0F223A] text-white' : 'hover:bg-[#EDEAE6]/60 text-[#0A0A0A]'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-xs">
                      <span
                        className={`font-mono-tabular font-semibold ${
                          active ? 'text-[#D3D1CE]' : 'text-[#536878]'
                        }`}
                      >
                        {sub.code}
                      </span>
                      {!active && <StandingText standing={standing} compact />}
                    </div>
                    <p className="mt-0.5 text-sm font-medium truncate">{sub.name}</p>
                  </div>
                  <span className="font-mono-tabular text-sm font-semibold shrink-0">
                    {pct.toFixed(1)}%
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {/* Recovery Result & Step-by-Step Plan */}
        <div className="lg:col-span-8 space-y-5">
          {selectedSubject && (
            <>
              <section className="luxury-card rounded-xl p-5 sm:p-6">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-5 border-b border-[#EDEAE6]">
                  <div>
                    <p className="text-xs font-mono-tabular text-[#536878]">
                      {selectedSubject.code} · {selectedSubject.weeklyHours} scheduled sessions / week
                    </p>
                    <h2 className="mt-1 font-display text-xl font-semibold text-[#0A0A0A]">
                      {selectedSubject.name}
                    </h2>
                    <p className="mt-1 text-xs text-[#262E36] tabular-nums">
                      Current Attendance: {selectedSubject.attendedClasses} /{' '}
                      {selectedSubject.totalClasses} classes (
                      <span className="font-semibold text-[#0A0A0A]">
                        {recovery.currentPercent.toFixed(1)}%
                      </span>
                      ) · Target: <span className="font-semibold">{targetPercent}%</span>
                    </p>
                  </div>
                  <StandingText
                    standing={deriveStanding(
                      selectedSubject.attendedClasses,
                      selectedSubject.totalClasses,
                      targetPercent,
                    )}
                  />
                </div>

                {recovery.isSafeZone ? (
                  <div className="pt-5 grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div>
                      <p className="text-xs text-[#262E36]">Recovery Requirement</p>
                      <p className="mt-1 font-display text-2xl sm:text-[26px] font-semibold text-[#1F5E3B] inline-flex items-center gap-2">
                        <CheckCircle2 className="w-6 h-6 shrink-0" aria-hidden="true" />
                        <span>0 classes needed — Safe Zone</span>
                      </p>
                      <p className="mt-2 text-xs text-[#262E36] leading-relaxed">
                        Current standing ({recovery.currentPercent.toFixed(1)}%) already satisfies
                        your {targetPercent}% threshold.
                      </p>
                    </div>

                    <div className="sm:border-l sm:border-[#EDEAE6] sm:pl-5">
                      <p className="text-xs text-[#262E36]">Safe-Skip Buffer</p>
                      <p className="mt-1 font-display text-3xl font-semibold text-[#0F223A] tabular-nums">
                        {recovery.safeToMiss} class{recovery.safeToMiss === 1 ? '' : 'es'}
                      </p>
                      <p className="mt-1 text-xs text-[#262E36] tabular-nums">
                        Consecutive absences permitted before falling below {targetPercent}%
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="pt-5 grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div>
                      <p className="text-xs text-[#262E36]">Consecutive Classes Required</p>
                      <p className="mt-1 font-display text-3xl sm:text-4xl font-semibold text-[#8B2626] tabular-nums">
                        {Number.isFinite(recovery.classesNeeded)
                          ? `${recovery.classesNeeded} classes`
                          : 'Unreachable'}
                      </p>
                      <p className="mt-1.5 text-xs text-[#262E36] tabular-nums">
                        Attending next {recovery.classesNeeded} brings standing to{' '}
                        <span className="font-semibold text-[#0A0A0A]">
                          {calculateAttendancePercent(
                            selectedSubject.attendedClasses + recovery.classesNeeded,
                            selectedSubject.totalClasses + recovery.classesNeeded,
                          ).toFixed(1)}
                          %
                        </span>
                      </p>
                    </div>

                    <div className="sm:border-l sm:border-[#EDEAE6] sm:pl-5">
                      <p className="text-xs text-[#262E36]">Projected Recovery Date</p>
                      <p className="mt-1 font-display text-2xl font-semibold text-[#0F223A] inline-flex items-center gap-2">
                        <CalendarDays className="w-5 h-5 text-[#2F466F]" aria-hidden="true" />
                        <span>{recoveryPlan.projectedDateLabel}</span>
                      </p>
                      <p className="mt-1.5 text-xs text-[#262E36]">
                        Calculated from your weekly {selectedSubject.code} timetable frequency
                      </p>
                    </div>
                  </div>
                )}
              </section>

              {/* Step-by-Step Recovery Plan OR Safe-Skip Simulation */}
              <section className="luxury-card rounded-xl p-5 sm:p-6">
                {!recovery.isSafeZone ? (
                  <>
                    <div className="pb-4 border-b border-[#EDEAE6] flex items-center justify-between gap-3">
                      <div>
                        <h3 className="font-display text-base font-semibold text-[#1C1C1C]">
                          Step-by-Step Recovery Plan
                        </h3>
                        <p className="text-xs text-[#262E36] mt-0.5">
                          Sequential class schedule to reach {targetPercent}% by{' '}
                          {recoveryPlan.projectedDateLabel}
                        </p>
                      </div>
                      <span className="font-mono-tabular text-xs font-semibold text-[#2F466F]">
                        {recoveryPlan.steps.length} sessions
                      </span>
                    </div>

                    <div className="divide-y divide-[#EDEAE6]">
                      {recoveryPlan.steps.slice(0, 12).map((step) => {
                        const reached = step.projectedPercent + 1e-9 >= targetPercent;
                        return (
                          <div
                            key={step.stepNumber}
                            className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <span
                                className={`w-7 h-7 rounded-lg font-mono-tabular text-xs font-semibold flex items-center justify-center shrink-0 ${
                                  reached
                                    ? 'bg-[#0F223A] text-white'
                                    : 'bg-[#EDEAE6] text-[#1C1C1C]'
                                }`}
                              >
                                {step.stepNumber}
                              </span>
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-[#0A0A0A]">
                                  {step.dateLabel} · {step.timeRange}
                                </p>
                                <p className="text-xs text-[#262E36] tabular-nums">
                                  {step.room} · Running total: {step.projectedAttended}/
                                  {step.projectedTotal}
                                </p>
                              </div>
                            </div>
                            <span
                              className={`font-mono-tabular text-sm font-semibold shrink-0 ${
                                reached ? 'text-[#1F5E3B]' : 'text-[#262E36]'
                              }`}
                            >
                              {step.projectedPercent.toFixed(1)}%
                              {reached ? ' · Target Met' : ''}
                            </span>
                          </div>
                        );
                      })}
                      {recoveryPlan.steps.length > 12 && (
                        <div className="py-3 text-xs text-[#262E36] tabular-nums">
                          + {recoveryPlan.steps.length - 12} additional consecutive sessions through{' '}
                          {recoveryPlan.projectedDateLabel}
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="pb-4 border-b border-[#EDEAE6]">
                      <h3 className="font-display text-base font-semibold text-[#1C1C1C]">
                        Safe-Skip Margin Breakdown
                      </h3>
                      <p className="text-xs text-[#262E36] mt-0.5">
                        Impact of consecutive absences on your {targetPercent}% cushion
                      </p>
                    </div>

                    {safeMissPreview.length === 0 ? (
                      <p className="pt-4 text-sm text-[#262E36]">
                        You are right on the {targetPercent}% boundary. Missing the next scheduled
                        session will drop {selectedSubject.code} below target.
                      </p>
                    ) : (
                      <div className="divide-y divide-[#EDEAE6]">
                        {safeMissPreview.map((row) => (
                          <div
                            key={row.missCount}
                            className="py-3 flex items-center justify-between gap-3 text-sm"
                          >
                            <span className="text-[#1C1C1C] tabular-nums">
                              After missing {row.missCount} class{row.missCount === 1 ? '' : 'es'} (
                              {row.attended}/{row.total})
                            </span>
                            <span className="font-mono-tabular font-semibold text-[#0F223A]">
                              {row.pct.toFixed(1)}%
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </section>
            </>
          )}
        </div>
      </div>
      )}
    </div>
  );
}
