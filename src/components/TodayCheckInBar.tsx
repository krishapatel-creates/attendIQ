import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowUpRight,
  Ban,
  Check,
  CheckCircle2,
  Edit3,
  RotateCcw,
  X,
} from 'lucide-react';
import { useAcademic } from '../context/AcademicContext';
import { getUitCalendarExclusion, isUitAcademicProfile } from '../data/uitAcademicCalendar';
import type { ClassLogStatus, TimetableSlot } from '../types/academic';
import { calculateAttendancePercent } from '../utils/attendanceMath';

interface TodayCheckInBarProps {
  compactHeaderLink?: boolean;
}

export function TodayCheckInBar({ compactHeaderLink = true }: TodayCheckInBarProps) {
  const {
    student,
    todayDateISO,
    todayWeekday,
    todayScheduledSlots,
    subjects,
    classLogs,
    checkInTimetableSlot,
    undoTimetableCheckIn,
    getEffectiveTarget,
  } = useAcademic();

  const todayExclusion = useMemo(() => {
    if (!isUitAcademicProfile(student)) return { excluded: false };
    return getUitCalendarExclusion(todayDateISO);
  }, [student, todayDateISO]);

  const [editingSlotId, setEditingSlotId] = useState<string | null>(null);
  const [busySlotId, setBusySlotId] = useState<string | null>(null);

  const formattedToday = useMemo(() => {
    const dt = new Date(`${todayDateISO}T12:00:00`);
    if (Number.isNaN(dt.getTime())) return todayWeekday;
    return dt.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
    });
  }, [todayDateISO, todayWeekday]);

  const slotEntries = useMemo(() => {
    return todayScheduledSlots.map((slot) => {
      const matchedSubject = subjects.find(
        (s) =>
          s.code.toUpperCase() === slot.courseCode.toUpperCase() ||
          s.name.toLowerCase() === slot.subjectName.toLowerCase(),
      );
      const existingLog = classLogs.find(
        (log) =>
          log.dateISO === todayDateISO &&
          (log.timetableSlotId === slot.id ||
            (log.courseCode.toUpperCase() === slot.courseCode.toUpperCase() &&
              log.topic.includes(slot.timeRange))),
      );
      return { slot, matchedSubject, existingLog };
    });
  }, [todayScheduledSlots, subjects, classLogs, todayDateISO]);

  const checkedInCount = useMemo(
    () => slotEntries.filter((e) => Boolean(e.existingLog)).length,
    [slotEntries],
  );

  const handleMark = async (slot: TimetableSlot, status: ClassLogStatus) => {
    setBusySlotId(slot.id);
    try {
      await checkInTimetableSlot(slot, status);
      setEditingSlotId(null);
    } finally {
      setBusySlotId(null);
    }
  };

  const handleUndo = async (slot: TimetableSlot) => {
    setBusySlotId(slot.id);
    try {
      await undoTimetableCheckIn(slot);
      if (editingSlotId === slot.id) setEditingSlotId(null);
    } finally {
      setBusySlotId(null);
    }
  };

  return (
    <section
      aria-label="Today's Smart Check-In"
      className="luxury-card rounded-xl p-5 sm:p-6 flex flex-col justify-between"
    >
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-4 border-b border-[#EDEAE6]">
        <div className="min-w-0">
          <h2 className="font-display text-base font-semibold text-[#1C1C1C]">
            Today’s Smart Check-In
          </h2>
          <p className="text-xs text-[#262E36] mt-0.5 tabular-nums">
            {formattedToday} ·{' '}
            {todayExclusion.excluded
              ? `${todayExclusion.reason} (Holiday / Non-Teaching)`
              : todayScheduledSlots.length === 0
                ? 'No lectures scheduled'
                : `${checkedInCount} of ${todayScheduledSlots.length} checked in`}
          </p>
        </div>
        {compactHeaderLink && (
          <Link
            to="/timetable-exams"
            className="inline-flex items-center gap-1 text-xs font-medium text-[#2F466F] hover:text-[#0F223A] whitespace-nowrap shrink-0"
          >
            <span>Full Timetable</span>
            <ArrowUpRight className="w-3.5 h-3.5" aria-hidden="true" />
          </Link>
        )}
      </div>

      {slotEntries.length === 0 ? (
        <div className="py-10 text-center">
          <p className="text-sm font-medium text-[#0A0A0A]">
            No classes scheduled for {todayWeekday}
          </p>
          <p className="mt-1 text-xs text-[#262E36]">
            Your weekday timetable slots for {todayWeekday} appear here automatically for one-tap attendance check-in.
          </p>
          <Link
            to="/timetable-exams"
            className="mt-4 min-h-[44px] inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-[#D3D1CE] bg-white text-xs font-medium text-[#0F223A] hover:border-[#2F466F] transition-colors"
          >
            <span>Manage Weekly Timetable</span>
            <ArrowUpRight className="w-3.5 h-3.5" aria-hidden="true" />
          </Link>
        </div>
      ) : (
        <div className="divide-y divide-[#EDEAE6]">
          {slotEntries.map(({ slot, matchedSubject, existingLog }) => {
            const isMarked = Boolean(existingLog);
            const isEditing = editingSlotId === slot.id;
            const isBusy = busySlotId === slot.id;
            const showActions = !isMarked || isEditing;

            const pct = matchedSubject
              ? calculateAttendancePercent(matchedSubject.attendedClasses, matchedSubject.totalClasses)
              : null;
            const effectiveTarget = getEffectiveTarget(matchedSubject);

            return (
              <div
                key={slot.id}
                className="py-4 first:pt-3 last:pb-2 flex flex-col gap-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-[#262E36]">
                      <span className="font-mono-tabular font-medium text-[#0A0A0A]">
                        {slot.timeRange}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono-tabular font-semibold text-[#0F223A]">
                        {slot.courseCode}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{slot.room}</span>
                      <span aria-hidden="true">·</span>
                      <span className="text-[#536878]">{slot.sessionType}</span>
                    </div>
                    <p className="mt-0.5 text-sm font-semibold text-[#0A0A0A] truncate">
                      {slot.subjectName}
                    </p>
                  </div>

                  {matchedSubject && pct !== null && (
                    <div className="flex items-center gap-2 text-xs font-mono-tabular shrink-0">
                      <span className="text-[#262E36]">
                        {matchedSubject.attendedClasses}/{matchedSubject.totalClasses}
                      </span>
                      <span
                        className={`font-semibold ${
                          pct + 1e-9 >= effectiveTarget ? 'text-[#1F5E3B]' : 'text-[#8B2626]'
                        }`}
                      >
                        {pct.toFixed(1)}%
                      </span>
                    </div>
                  )}
                </div>

                {/* Marked Status Banner + Undo / Edit Controls */}
                {isMarked && existingLog && (
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-[#EDEAE6]/55 border border-[#D3D1CE] px-3 py-2">
                    <div className="flex items-center gap-2 text-xs font-medium min-w-0">
                      {existingLog.status === 'present' ? (
                        <CheckCircle2 className="w-4 h-4 text-[#1F5E3B] shrink-0" aria-hidden="true" />
                      ) : existingLog.status === 'absent' ? (
                        <X className="w-4 h-4 text-[#8B2626] shrink-0" aria-hidden="true" />
                      ) : (
                        <Ban className="w-4 h-4 text-[#536878] shrink-0" aria-hidden="true" />
                      )}
                      <span
                        className={
                          existingLog.status === 'present'
                            ? 'text-[#1F5E3B]'
                            : existingLog.status === 'absent'
                              ? 'text-[#8B2626]'
                              : 'text-[#262E36]'
                        }
                      >
                        {existingLog.status === 'present'
                          ? 'Checked in: Present (A + 1, T + 1)'
                          : existingLog.status === 'absent'
                            ? 'Marked: Absent (A + 0, T + 1)'
                            : 'Marked: Cancelled / Holiday (No % change)'}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => setEditingSlotId(isEditing ? null : slot.id)}
                        className="min-h-[44px] px-3 py-1.5 rounded-lg border border-[#D3D1CE] bg-white text-xs font-medium text-[#0F223A] hover:border-[#2F466F] inline-flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                      >
                        <Edit3 className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>{isEditing ? 'Done' : 'Edit'}</span>
                      </button>
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => handleUndo(slot)}
                        className="min-h-[44px] px-3 py-1.5 rounded-lg border border-[#D3D1CE] bg-white text-xs font-medium text-[#8B2626] hover:border-[#8B2626] inline-flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                      >
                        <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Undo</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* 3 Touch-Friendly Check-In Buttons (>= 44px) */}
                {showActions && (
                  <div
                    role="group"
                    aria-label={`Check-in actions for ${slot.subjectName}`}
                    className="grid grid-cols-1 sm:grid-cols-3 gap-2"
                  >
                    <button
                      type="button"
                      disabled={isBusy || !matchedSubject}
                      onClick={() => handleMark(slot, 'present')}
                      aria-pressed={existingLog?.status === 'present'}
                      className={`min-h-[44px] px-3 py-2 rounded-lg text-xs font-medium inline-flex items-center justify-center gap-1.5 border transition-colors cursor-pointer disabled:opacity-50 ${
                        existingLog?.status === 'present'
                          ? 'bg-[#0F223A] border-[#0F223A] text-white'
                          : 'bg-white border-[#D3D1CE] text-[#0A0A0A] hover:border-[#0F223A]'
                      }`}
                    >
                      <Check className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                      <span>Present</span>
                      <span className="text-[11px] font-mono-tabular opacity-80">(A+1, T+1)</span>
                    </button>

                    <button
                      type="button"
                      disabled={isBusy || !matchedSubject}
                      onClick={() => handleMark(slot, 'absent')}
                      aria-pressed={existingLog?.status === 'absent'}
                      className={`min-h-[44px] px-3 py-2 rounded-lg text-xs font-medium inline-flex items-center justify-center gap-1.5 border transition-colors cursor-pointer disabled:opacity-50 ${
                        existingLog?.status === 'absent'
                          ? 'bg-[#8B2626] border-[#8B2626] text-white'
                          : 'bg-white border-[#D3D1CE] text-[#0A0A0A] hover:border-[#8B2626]'
                      }`}
                    >
                      <X className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                      <span>Absent</span>
                      <span className="text-[11px] font-mono-tabular opacity-80">(A+0, T+1)</span>
                    </button>

                    <button
                      type="button"
                      disabled={isBusy || !matchedSubject}
                      onClick={() => handleMark(slot, 'cancelled')}
                      aria-pressed={existingLog?.status === 'cancelled'}
                      className={`min-h-[44px] px-3 py-2 rounded-lg text-xs font-medium inline-flex items-center justify-center gap-1.5 border transition-colors cursor-pointer disabled:opacity-50 ${
                        existingLog?.status === 'cancelled'
                          ? 'bg-[#2F466F] border-[#2F466F] text-white'
                          : 'bg-white border-[#D3D1CE] text-[#1C1C1C] hover:border-[#2F466F]'
                      }`}
                    >
                      <Ban className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                      <span>Cancelled / Holiday</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
