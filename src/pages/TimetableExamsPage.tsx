import React, { useEffect, useMemo, useState } from 'react';
import { CalendarDays, CalendarPlus, Check, Clock, Plus, Trash2, X } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { useAcademic } from '../context/AcademicContext';
import {
  UIT_OFFICIAL_MILESTONES,
  UIT_SEM1_HOLIDAYS,
  parseSlotStartMinutes,
} from '../data/uitAcademicCalendar';
import type { ExamItem, TimetableSlot } from '../types/academic';

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'] as const;

function computeCountdown(dateISO: string, dueTime = '09:00', nowMs: number) {
  const safeTime = /^\d{2}:\d{2}$/.test(dueTime) ? dueTime : '09:00';
  const target = new Date(`${dateISO}T${safeTime}:00`);
  if (!Number.isFinite(target.getTime())) {
    return { days: 0, hours: 0, isPast: false };
  }
  const diffMs = target.getTime() - nowMs;
  if (diffMs <= 0) {
    return { days: 0, hours: 0, isPast: true };
  }
  const totalHours = Math.floor(diffMs / (1000 * 60 * 60));
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  return { days, hours, isPast: false };
}

export function TimetableExamsPage() {
  const {
    subjects,
    weeklyTimetable,
    exams,
    addTimetableSlot,
    deleteTimetableSlot,
    markTimetableSlotAttended,
    addExamItem,
    updateExamSyllabus,
    deleteExamItem,
  } = useAcademic();

  const [mobileTab, setMobileTab] = useState<'timetable' | 'exams'>('timetable');
  const [activeDay, setActiveDay] = useState<(typeof WEEKDAYS)[number]>('Monday');
  const [attendedSlotIds, setAttendedSlotIds] = useState<Record<string, boolean>>({});
  const [markingSlotId, setMarkingSlotId] = useState<string | null>(null);

  // Live clock for Days / Hours countdown
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 60000);
    return () => window.clearInterval(timer);
  }, []);

  // Exam filter & draft syllabus slider state for smooth dragging
  const [examFilter, setExamFilter] = useState<'all' | 'exams' | 'assignments'>('all');
  const [draftSyllabus, setDraftSyllabus] = useState<Record<string, number>>({});

  // Add Timetable Slot modal
  const [slotModalOpen, setSlotModalOpen] = useState(false);
  const [slotDay, setSlotDay] = useState<TimetableSlot['day']>('Monday');
  const [slotCourseCode, setSlotCourseCode] = useState(subjects[0]?.code ?? 'MATH-101');
  const [slotTimeRange, setSlotTimeRange] = useState('09:30 – 10:20');
  const [slotRoom, setSlotRoom] = useState('I16');
  const [slotType, setSlotType] = useState<TimetableSlot['sessionType']>('Lecture');
  const [slotProfessor, setSlotProfessor] = useState('');
  const [slotError, setSlotError] = useState('');

  // Add Exam / Deadline modal
  const [examModalOpen, setExamModalOpen] = useState(false);
  const [examType, setExamType] = useState<'Exam' | 'Assignment' | 'Quiz'>('Exam');
  const [examCourseCode, setExamCourseCode] = useState(subjects[0]?.code ?? 'MATH-101');
  const [examTitle, setExamTitle] = useState('');
  const [examDateISO, setExamDateISO] = useState('2026-12-17');
  const [examDueTime, setExamDueTime] = useState('09:30');
  const [examRoom, setExamRoom] = useState('I16');
  const [examProgress, setExamProgress] = useState(40);
  const [examError, setExamError] = useState('');

  const daySlots = useMemo(
    () =>
      weeklyTimetable
        .filter((slot) => slot.day === activeDay)
        .sort((a, b) => parseSlotStartMinutes(a.timeRange) - parseSlotStartMinutes(b.timeRange)),
    [weeklyTimetable, activeDay],
  );

  const filteredExams = useMemo(() => {
    const sorted = [...exams].sort((a, b) => a.dateISO.localeCompare(b.dateISO));
    if (examFilter === 'assignments') {
      return sorted.filter((ex) => ex.itemType === 'Assignment');
    }
    if (examFilter === 'exams') {
      return sorted.filter((ex) => ex.itemType !== 'Assignment');
    }
    return sorted;
  }, [exams, examFilter]);

  const handleMarkAttended = async (slot: TimetableSlot) => {
    setMarkingSlotId(slot.id);
    try {
      await markTimetableSlotAttended(slot);
      setAttendedSlotIds((prev) => ({ ...prev, [slot.id]: true }));
    } finally {
      setMarkingSlotId(null);
    }
  };

  const openSlotModal = () => {
    const firstSub = subjects[0];
    setSlotDay(activeDay);
    setSlotCourseCode(firstSub?.code ?? 'MATH-101');
    setSlotProfessor(firstSub?.instructor ?? 'Section A');
    setSlotTimeRange('09:30 – 10:20');
    setSlotRoom('I16');
    setSlotType('Lecture');
    setSlotError('');
    setSlotModalOpen(true);
  };

  const handleSlotCourseChange = (code: string) => {
    setSlotCourseCode(code);
    const matched = subjects.find((s) => s.code === code);
    if (matched) {
      setSlotProfessor(matched.instructor);
    }
  };

  const handleCreateSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    setSlotError('');
    if (!slotTimeRange.trim() || !slotRoom.trim()) {
      setSlotError('Time range and classroom are required.');
      return;
    }
    const matched = subjects.find((s) => s.code === slotCourseCode);
    await addTimetableSlot({
      day: slotDay,
      timeRange: slotTimeRange,
      courseCode: slotCourseCode,
      subjectName: matched?.name ?? slotCourseCode,
      room: slotRoom,
      sessionType: slotType,
      professor: slotProfessor || matched?.instructor,
    });
    setActiveDay(slotDay);
    setSlotModalOpen(false);
  };

  const openExamModal = () => {
    setExamType('Exam');
    setExamCourseCode(subjects[0]?.code ?? 'MATH-101');
    setExamTitle('');
    setExamDateISO('2026-12-17');
    setExamDueTime('09:30');
    setExamRoom('I16');
    setExamProgress(40);
    setExamError('');
    setExamModalOpen(true);
  };

  const handleCreateExam = async (e: React.FormEvent) => {
    e.preventDefault();
    setExamError('');
    if (!examTitle.trim() || !examDateISO) {
      setExamError('Title and target date are required.');
      return;
    }
    const matched = subjects.find((s) => s.code === examCourseCode);
    await addExamItem({
      itemType: examType,
      courseCode: examCourseCode,
      subjectName: matched?.name ?? examCourseCode,
      examTitle: examTitle.trim(),
      dateISO: examDateISO,
      dueTime: examDueTime,
      room: examRoom.trim() || (examType === 'Assignment' ? 'Portal Upload' : 'TBA'),
      syllabusProgress: examProgress,
    });
    setExamModalOpen(false);
  };

  const commitSyllabusSlider = async (exam: ExamItem) => {
    const draft = draftSyllabus[exam.id];
    if (draft === undefined || draft === exam.syllabusProgress) return;
    await updateExamSyllabus(exam.id, draft);
    setDraftSyllabus((prev) => {
      const next = { ...prev };
      delete next[exam.id];
      return next;
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Timetable & Exams"
        subtitle="Day-by-day lecture schedule with one-tap attendance and live exam & deadline tracking"
        action={
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={openSlotModal}
              className="min-h-[44px] px-3.5 py-2 rounded-lg border border-[#2F466F] bg-white text-xs font-semibold text-[#0F223A] hover:bg-[#EDEAE6]/60 transition-colors inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
            >
              <CalendarPlus className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Add Lecture</span>
            </button>
            <button
              type="button"
              onClick={openExamModal}
              className="min-h-[44px] px-3.5 py-2 rounded-lg bg-[#0F223A] text-white text-xs font-medium hover:bg-[#2F466F] transition-colors inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Add Exam / Deadline</span>
            </button>
          </div>
        }
      />

      {/* Mobile Tab Switcher (< 1024px) */}
      <div className="lg:hidden grid grid-cols-2 gap-1 p-1 rounded-xl bg-white border border-[#D3D1CE]">
        <button
          type="button"
          onClick={() => setMobileTab('timetable')}
          className={`min-h-[44px] rounded-lg text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
            mobileTab === 'timetable' ? 'bg-[#0F223A] text-white' : 'text-[#262E36]'
          }`}
        >
          Smart Timetable
        </button>
        <button
          type="button"
          onClick={() => setMobileTab('exams')}
          className={`min-h-[44px] rounded-lg text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
            mobileTab === 'exams' ? 'bg-[#0F223A] text-white' : 'text-[#262E36]'
          }`}
        >
          Exams & Deadlines ({exams.length})
        </button>
      </div>

      {/* Desktop Split View / Mobile Tabbed View */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Smart Timetable Column */}
        <section
          aria-label="Smart Timetable"
          className={`lg:col-span-7 luxury-card rounded-xl p-5 sm:p-6 ${
            mobileTab === 'timetable' ? 'block' : 'hidden lg:block'
          }`}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#EDEAE6]">
            <div>
              <h2 className="font-display text-base font-semibold text-[#1C1C1C]">
                Smart Weekly Timetable
              </h2>
              <p className="text-xs text-[#262E36] mt-0.5">
                {daySlots.length} scheduled session{daySlots.length === 1 ? '' : 's'} on {activeDay}
              </p>
            </div>
            <div className="w-full sm:w-auto grid grid-cols-5 sm:flex items-center gap-1 p-1 rounded-lg bg-[#EDEAE6]/60 border border-[#D3D1CE]">
              {WEEKDAYS.map((day) => (
                <button
                  key={day}
                  type="button"
                  onClick={() => setActiveDay(day)}
                  className={`min-h-[44px] sm:min-h-[36px] px-2 sm:px-2.5 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                    activeDay === day
                      ? 'bg-[#0F223A] text-white'
                      : 'text-[#262E36] hover:text-[#0A0A0A]'
                  }`}
                >
                  {day.slice(0, 3)}
                </button>
              ))}
            </div>
          </div>

          {daySlots.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-sm font-medium text-[#0A0A0A]">No lectures scheduled for {activeDay}</p>
              <p className="mt-1 text-xs text-[#262E36]">
                Use &ldquo;Add Lecture&rdquo; above to add a class slot to {activeDay}.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-[#EDEAE6]">
              {daySlots.map((slot) => {
                const matchedSubject = subjects.find((s) => s.code === slot.courseCode);
                const professor = slot.professor || matchedSubject?.instructor || 'Faculty Assigned';
                const isMarked = Boolean(attendedSlotIds[slot.id]);
                const isMarking = markingSlotId === slot.id;

                return (
                  <div
                    key={slot.id}
                    className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-[#536878]">
                        <span className="font-mono-tabular font-semibold text-[#0F223A]">
                          {slot.timeRange}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono-tabular font-medium text-[#1C1C1C]">
                          {slot.courseCode}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{slot.sessionType}</span>
                      </div>
                      <p className="mt-1 text-sm font-semibold text-[#0A0A0A] truncate">
                        {slot.subjectName}
                      </p>
                      <p className="mt-0.5 text-xs text-[#262E36]">
                        Room <span className="font-mono-tabular font-medium text-[#0A0A0A]">{slot.room}</span>
                        <span aria-hidden="true"> · </span>
                        {professor}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        disabled={isMarking || !matchedSubject}
                        onClick={() => void handleMarkAttended(slot)}
                        className={`min-h-[44px] px-3.5 py-2 rounded-lg text-xs font-medium border transition-colors inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer disabled:opacity-50 ${
                          isMarked
                            ? 'bg-[#1F5E3B]/10 border-[#1F5E3B]/40 text-[#1F5E3B]'
                            : 'bg-white border-[#D3D1CE] text-[#0F223A] hover:border-[#2F466F] hover:bg-[#EDEAE6]/50'
                        }`}
                      >
                        <Check className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>{isMarking ? 'Saving...' : isMarked ? 'Attended' : 'Mark Attended'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => void deleteTimetableSlot(slot.id)}
                        aria-label={`Remove ${slot.courseCode} slot on ${slot.day}`}
                        className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-[#536878] hover:text-[#8B2626] hover:bg-[#FDF2F2] transition-colors cursor-pointer"
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

        {/* Exam Countdown & Deadlines Column */}
        <section
          aria-label="Exam Countdown and Deadlines"
          className={`lg:col-span-5 luxury-card rounded-xl p-5 sm:p-6 ${
            mobileTab === 'exams' ? 'block' : 'hidden lg:block'
          }`}
        >
          <div className="pb-4 border-b border-[#EDEAE6] space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="font-display text-base font-semibold text-[#1C1C1C]">
                  Exam Countdown & Deadlines
                </h2>
                <p className="text-xs text-[#262E36] mt-0.5">
                  Live days/hours tracker and syllabus readiness
                </p>
              </div>
              <Clock className="w-4 h-4 text-[#536878] shrink-0" aria-hidden="true" />
            </div>

            <div className="flex items-center gap-1 p-1 rounded-lg bg-[#EDEAE6]/60 border border-[#D3D1CE]">
              {(
                [
                  { id: 'all', label: 'All' },
                  { id: 'exams', label: 'Exams & Quizzes' },
                  { id: 'assignments', label: 'Assignments' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setExamFilter(tab.id)}
                  className={`flex-1 min-h-[44px] sm:min-h-[36px] px-2 py-1 rounded-md text-[11px] sm:text-xs font-medium transition-colors whitespace-nowrap truncate cursor-pointer ${
                    examFilter === tab.id
                      ? 'bg-[#0F223A] text-white'
                      : 'text-[#262E36] hover:text-[#0A0A0A]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {filteredExams.length === 0 ? (
            <div className="py-10 text-center text-sm text-[#262E36]">
              No items in this category.
            </div>
          ) : (
            <div className="divide-y divide-[#EDEAE6]">
              {filteredExams.map((exam) => {
                const countdown = computeCountdown(exam.dateISO, exam.dueTime ?? '09:00', nowMs);
                const progressVal = draftSyllabus[exam.id] ?? exam.syllabusProgress;
                const isUrgent = !countdown.isPast && countdown.days <= 5;
                const typeLabel = exam.itemType ?? 'Exam';

                return (
                  <div key={exam.id} className="py-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5 text-xs text-[#536878]">
                          <span className="font-semibold text-[#2F466F] uppercase tracking-wide">
                            {typeLabel}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono-tabular text-[#1C1C1C] font-medium">
                            {exam.courseCode}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>
                            {exam.displayDate} {exam.dueTime ? `(${exam.dueTime})` : ''}
                          </span>
                        </div>
                        <p className="mt-1 text-sm font-semibold text-[#0A0A0A] leading-snug">
                          {exam.examTitle}
                        </p>
                        <p className="mt-0.5 text-xs text-[#262E36]">
                          {exam.subjectName} · Venue: {exam.room}
                        </p>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <span
                          className={`font-mono-tabular text-xs font-semibold whitespace-nowrap ${
                            countdown.isPast
                              ? 'text-[#536878]'
                              : isUrgent
                                ? 'text-[#8B2626]'
                                : 'text-[#0F223A]'
                          }`}
                        >
                          {countdown.isPast
                            ? 'Due / Passed'
                            : `${countdown.days}d ${countdown.hours}h left`}
                        </span>
                        <button
                          type="button"
                          onClick={() => void deleteExamItem(exam.id)}
                          aria-label={`Delete ${exam.examTitle}`}
                          className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-[#536878] hover:text-[#8B2626] hover:bg-[#FDF2F2] cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                        </button>
                      </div>
                    </div>

                    {/* Interactive Syllabus Completion Slider */}
                    <div className="mt-3">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-[#262E36]">
                          {typeLabel === 'Assignment' ? 'Completion Progress' : 'Syllabus Readiness'}
                        </span>
                        <span className="font-mono-tabular font-semibold text-[#0F223A]">
                          {progressVal}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        step={1}
                        value={progressVal}
                        aria-label={`${exam.examTitle} completion percentage`}
                        onChange={(e) =>
                          setDraftSyllabus((prev) => ({
                            ...prev,
                            [exam.id]: Number(e.target.value),
                          }))
                        }
                        onMouseUp={() => void commitSyllabusSlider(exam)}
                        onTouchEnd={() => void commitSyllabusSlider(exam)}
                        onKeyUp={() => void commitSyllabusSlider(exam)}
                        onBlur={() => void commitSyllabusSlider(exam)}
                        className="w-full h-11 accent-[#2F466F] cursor-pointer"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {/* Official Academic Calendar & Holiday Exclusions (Karnavati University UIT Sem 1) */}
      <section
        aria-label="Official Academic Calendar and Holidays"
        className="luxury-card rounded-xl p-5 sm:p-6 space-y-4"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-[#EDEAE6]">
          <div>
            <h2 className="font-display text-base font-semibold text-[#1C1C1C]">
              Official Academic Calendar &amp; Holiday Exclusions
            </h2>
            <p className="text-xs text-[#262E36] mt-0.5">
              Karnavati University (UIT) Odd Semester 2026–27 · Excluded automatically by the Attendance Predictor &amp; Recovery Calculator
            </p>
          </div>
          <CalendarDays className="w-4 h-4 text-[#2F466F] shrink-0" aria-hidden="true" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="rounded-lg border border-[#D3D1CE] bg-[#EDEAE6]/35 p-3">
            <p className="text-[11px] font-medium text-[#536878]">Sem 1 Commencement</p>
            <p className="mt-1 font-mono-tabular text-xs font-semibold text-[#0F223A]">
              Tue, Jul 28, 2026
            </p>
          </div>
          <div className="rounded-lg border border-[#D3D1CE] bg-[#EDEAE6]/35 p-3">
            <p className="text-[11px] font-medium text-[#536878]">Mid-Term Examinations</p>
            <p className="mt-1 font-mono-tabular text-xs font-semibold text-[#0F223A]">
              {UIT_OFFICIAL_MILESTONES.midTermDatesLabel}
            </p>
          </div>
          <div className="rounded-lg border border-[#D3D1CE] bg-[#EDEAE6]/35 p-3">
            <p className="text-[11px] font-medium text-[#536878]">Last Teaching Day</p>
            <p className="mt-1 font-mono-tabular text-xs font-semibold text-[#0F223A]">
              Wed, Dec 16, 2026
            </p>
          </div>
          <div className="rounded-lg border border-[#D3D1CE] bg-[#EDEAE6]/35 p-3">
            <p className="text-[11px] font-medium text-[#536878]">End-Sem Examinations</p>
            <p className="mt-1 font-mono-tabular text-xs font-semibold text-[#0F223A]">
              {UIT_OFFICIAL_MILESTONES.endSemDatesLabel}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 pt-1">
          {UIT_SEM1_HOLIDAYS.map((hol) => (
            <div
              key={hol.id}
              className="rounded-lg border border-[#D3D1CE] bg-white px-3 py-2.5 flex items-center justify-between gap-2"
            >
              <div className="min-w-0">
                <p className="text-xs font-semibold text-[#0A0A0A] truncate">{hol.label}</p>
                <p className="text-[11px] font-mono-tabular text-[#536878] mt-0.5">
                  {hol.displayDate}
                </p>
              </div>
              <span className="text-[10px] font-medium uppercase tracking-wide text-[#2F466F] shrink-0">
                {hol.kind === 'vacation' ? 'Break' : 'Off'}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Add Timetable Slot Modal */}
      {slotModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-[#0A0A0A]/45 backdrop-blur-xs"
            onClick={() => setSlotModalOpen(false)}
            aria-hidden="true"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Add Timetable Lecture"
            className="relative w-full max-w-[460px] bg-white border border-[#D3D1CE] rounded-xl p-6 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between pb-4 border-b border-[#EDEAE6]">
              <h2 className="font-display text-lg font-semibold text-[#0A0A0A]">
                Add Timetable Session
              </h2>
              <button
                type="button"
                onClick={() => setSlotModalOpen(false)}
                aria-label="Close modal"
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-[#536878] hover:bg-[#EDEAE6] cursor-pointer"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>

            <form onSubmit={(e) => void handleCreateSlot(e)} className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="tt-day" className="block text-xs font-medium text-[#1C1C1C] mb-1.5">
                    Weekday
                  </label>
                  <select
                    id="tt-day"
                    value={slotDay}
                    onChange={(e) => setSlotDay(e.target.value as TimetableSlot['day'])}
                    className="w-full min-h-[44px] px-3 rounded-lg border border-[#D3D1CE] bg-white text-sm"
                  >
                    {WEEKDAYS.map((day) => (
                      <option key={day} value={day}>
                        {day}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="tt-type" className="block text-xs font-medium text-[#1C1C1C] mb-1.5">
                    Session Type
                  </label>
                  <select
                    id="tt-type"
                    value={slotType}
                    onChange={(e) => setSlotType(e.target.value as TimetableSlot['sessionType'])}
                    className="w-full min-h-[44px] px-3 rounded-lg border border-[#D3D1CE] bg-white text-sm"
                  >
                    <option value="Lecture">Lecture</option>
                    <option value="Laboratory">Laboratory</option>
                    <option value="Tutorial">Tutorial</option>
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="tt-course" className="block text-xs font-medium text-[#1C1C1C] mb-1.5">
                  Course
                </label>
                <select
                  id="tt-course"
                  value={slotCourseCode}
                  onChange={(e) => handleSlotCourseChange(e.target.value)}
                  className="w-full min-h-[44px] px-3 rounded-lg border border-[#D3D1CE] bg-white text-sm"
                >
                  {subjects.map((s) => (
                    <option key={s.id} value={s.code}>
                      {s.code} — {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="tt-time" className="block text-xs font-medium text-[#1C1C1C] mb-1.5">
                    Time Slot
                  </label>
                  <input
                    id="tt-time"
                    type="text"
                    value={slotTimeRange}
                    onChange={(e) => setSlotTimeRange(e.target.value)}
                    placeholder="13:00 – 13:55"
                    className="w-full min-h-[44px] px-3 rounded-lg border border-[#D3D1CE] text-sm font-mono-tabular"
                  />
                </div>
                <div>
                  <label htmlFor="tt-room" className="block text-xs font-medium text-[#1C1C1C] mb-1.5">
                    Classroom / Lab
                  </label>
                  <input
                    id="tt-room"
                    type="text"
                    value={slotRoom}
                    onChange={(e) => setSlotRoom(e.target.value)}
                    placeholder="I16"
                    className="w-full min-h-[44px] px-3 rounded-lg border border-[#D3D1CE] text-sm font-mono-tabular"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="tt-prof" className="block text-xs font-medium text-[#1C1C1C] mb-1.5">
                  Professor
                </label>
                <input
                  id="tt-prof"
                  type="text"
                  value={slotProfessor}
                  onChange={(e) => setSlotProfessor(e.target.value)}
                  placeholder="Dr. Kavita Rao"
                  className="w-full min-h-[44px] px-3 rounded-lg border border-[#D3D1CE] text-sm"
                />
              </div>

              {slotError && (
                <p role="alert" className="text-xs font-medium text-[#8B2626]">
                  {slotError}
                </p>
              )}

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSlotModalOpen(false)}
                  className="min-h-[44px] px-4 rounded-lg border border-[#D3D1CE] text-xs font-medium text-[#1C1C1C] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="min-h-[44px] px-5 rounded-lg bg-[#0F223A] text-white text-xs font-medium hover:bg-[#2F466F] cursor-pointer"
                >
                  Save Lecture
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Exam / Deadline Modal */}
      {examModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-[#0A0A0A]/45 backdrop-blur-xs"
            onClick={() => setExamModalOpen(false)}
            aria-hidden="true"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Add Exam or Deadline"
            className="relative w-full max-w-[460px] bg-white border border-[#D3D1CE] rounded-xl p-6 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between pb-4 border-b border-[#EDEAE6]">
              <h2 className="font-display text-lg font-semibold text-[#0A0A0A]">
                Add Exam or Deadline
              </h2>
              <button
                type="button"
                onClick={() => setExamModalOpen(false)}
                aria-label="Close modal"
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-[#536878] hover:bg-[#EDEAE6] cursor-pointer"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>

            <form onSubmit={(e) => void handleCreateExam(e)} className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="ex-type" className="block text-xs font-medium text-[#1C1C1C] mb-1.5">
                    Category
                  </label>
                  <select
                    id="ex-type"
                    value={examType}
                    onChange={(e) => setExamType(e.target.value as 'Exam' | 'Assignment' | 'Quiz')}
                    className="w-full min-h-[44px] px-3 rounded-lg border border-[#D3D1CE] bg-white text-sm"
                  >
                    <option value="Exam">Exam</option>
                    <option value="Quiz">Quiz</option>
                    <option value="Assignment">Assignment Deadline</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="ex-course" className="block text-xs font-medium text-[#1C1C1C] mb-1.5">
                    Course
                  </label>
                  <select
                    id="ex-course"
                    value={examCourseCode}
                    onChange={(e) => setExamCourseCode(e.target.value)}
                    className="w-full min-h-[44px] px-3 rounded-lg border border-[#D3D1CE] bg-white text-sm"
                  >
                    {subjects.map((s) => (
                      <option key={s.id} value={s.code}>
                        {s.code}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="ex-title" className="block text-xs font-medium text-[#1C1C1C] mb-1.5">
                  Assessment / Deadline Title
                </label>
                <input
                  id="ex-title"
                  type="text"
                  value={examTitle}
                  onChange={(e) => setExamTitle(e.target.value)}
                  placeholder="e.g. End-Term Practical Viva"
                  className="w-full min-h-[44px] px-3 rounded-lg border border-[#D3D1CE] text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="ex-date" className="block text-xs font-medium text-[#1C1C1C] mb-1.5">
                    Target Date
                  </label>
                  <input
                    id="ex-date"
                    type="date"
                    value={examDateISO}
                    onChange={(e) => setExamDateISO(e.target.value)}
                    className="w-full min-h-[44px] px-3 rounded-lg border border-[#D3D1CE] text-sm font-mono-tabular"
                  />
                </div>
                <div>
                  <label htmlFor="ex-time" className="block text-xs font-medium text-[#1C1C1C] mb-1.5">
                    Due Time
                  </label>
                  <input
                    id="ex-time"
                    type="time"
                    value={examDueTime}
                    onChange={(e) => setExamDueTime(e.target.value)}
                    className="w-full min-h-[44px] px-3 rounded-lg border border-[#D3D1CE] text-sm font-mono-tabular"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="ex-room" className="block text-xs font-medium text-[#1C1C1C] mb-1.5">
                  Room / Submission Venue
                </label>
                <input
                  id="ex-room"
                  type="text"
                  value={examRoom}
                  onChange={(e) => setExamRoom(e.target.value)}
                  placeholder="I16 or Portal Upload"
                  className="w-full min-h-[44px] px-3 rounded-lg border border-[#D3D1CE] text-sm"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="font-medium text-[#1C1C1C]">Initial Syllabus Readiness</span>
                  <span className="font-mono-tabular font-semibold text-[#0F223A]">{examProgress}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={examProgress}
                  onChange={(e) => setExamProgress(Number(e.target.value))}
                  aria-label="Initial syllabus readiness"
                  className="w-full h-11 accent-[#2F466F] cursor-pointer"
                />
              </div>

              {examError && (
                <p role="alert" className="text-xs font-medium text-[#8B2626]">
                  {examError}
                </p>
              )}

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setExamModalOpen(false)}
                  className="min-h-[44px] px-4 rounded-lg border border-[#D3D1CE] text-xs font-medium text-[#1C1C1C] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="min-h-[44px] px-5 rounded-lg bg-[#0F223A] text-white text-xs font-medium hover:bg-[#2F466F] cursor-pointer"
                >
                  Save Deadline
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
