import React, { useEffect, useState } from 'react';
import { Compass, LogOut, RotateCcw, Sparkles } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { PageHeader } from '../components/PageHeader';
import { useAcademic } from '../context/AcademicContext';
import { BRANCH_OPTIONS, extractSemesterNumber } from '../data/academicCatalog';

export function SettingsPage() {
  const {
    student,
    isFirebaseLive,
    updateTargetAttendance,
    updateStudentProfile,
    updateAlertPreferences,
    loadUitSem1Preset,
    resetSampleData,
    logout,
  } = useAcademic();
  const navigate = useNavigate();

  const [name, setName] = useState(student.name);
  const [studentId, setStudentId] = useState(student.studentId);
  const [college, setCollege] = useState(student.college ?? '');
  const [selectedBranch, setSelectedBranch] = useState(() => {
    const initial = student.branch || student.program || 'B.Tech Computer Engineering';
    const match = BRANCH_OPTIONS.find((b) => b.value.toLowerCase() === initial.toLowerCase());
    return match ? match.value : 'Other';
  });
  const [customBranch, setCustomBranch] = useState(() => {
    const initial = student.branch || student.program || '';
    const match = BRANCH_OPTIONS.find((b) => b.value.toLowerCase() === initial.toLowerCase());
    return match ? '' : initial;
  });
  const [semesterNumber, setSemesterNumber] = useState(() =>
    extractSemesterNumber(student.semester, student.semesterNumber),
  );
  const [semesterStart, setSemesterStart] = useState(student.semesterStart);
  const [semesterEnd, setSemesterEnd] = useState(student.semesterEnd);
  const [draftBenchmark, setDraftBenchmark] = useState(student.targetAttendance);
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isLoadingPreset, setIsLoadingPreset] = useState(false);

  // Sync local form fields if student profile loads asynchronously from Firestore
  useEffect(() => {
    setName(student.name);
    setStudentId(student.studentId);
    setCollege(student.college ?? '');
    const currentBranch = student.branch || student.program || 'B.Tech Computer Engineering';
    const match = BRANCH_OPTIONS.find((b) => b.value.toLowerCase() === currentBranch.toLowerCase());
    setSelectedBranch(match ? match.value : 'Other');
    setCustomBranch(match ? '' : currentBranch);
    setSemesterNumber(extractSemesterNumber(student.semester, student.semesterNumber));
    setSemesterStart(student.semesterStart);
    setSemesterEnd(student.semesterEnd);
    setDraftBenchmark(student.targetAttendance);
  }, [
    student.name,
    student.studentId,
    student.college,
    student.branch,
    student.program,
    student.semester,
    student.semesterNumber,
    student.semesterStart,
    student.semesterEnd,
    student.targetAttendance,
  ]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const resolvedBranch =
      selectedBranch === 'Other'
        ? customBranch.trim() || student.branch || student.program
        : selectedBranch;
    const cleanSem = Math.min(12, Math.max(1, Math.round(semesterNumber || 1)));

    await updateStudentProfile({
      name: name.trim() || student.name,
      studentId: studentId.trim(),
      college: college.trim(),
      branch: resolvedBranch,
      program: resolvedBranch,
      semesterNumber: cleanSem,
      semester: `Semester ${cleanSem}`,
      semesterStart,
      semesterEnd,
    });
  };

  const commitBenchmark = async (val: number) => {
    if (val === student.targetAttendance) return;
    await updateTargetAttendance(val);
  };

  const handleConfirmReset = async () => {
    setIsResetting(true);
    try {
      await resetSampleData();
      setConfirmResetOpen(false);
    } finally {
      setIsResetting(false);
    }
  };

  const handleLoadUitPreset = async () => {
    setIsLoadingPreset(true);
    try {
      await loadUitSem1Preset();
    } finally {
      setIsLoadingPreset(false);
    }
  };

  const handleSignOut = async () => {
    await logout();
    navigate('/login');
  };

  const alertLowAttendance = student.alertLowAttendance ?? true;
  const alertExamReminders = student.alertExamReminders ?? true;
  const alertWeeklyDigest = student.alertWeeklyDigest ?? true;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings & Profile"
        subtitle="Manage student identity, attendance threshold, alert preferences, and sample dataset"
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Student Academic Profile Form */}
        <form
          onSubmit={(e) => void handleSave(e)}
          className="lg:col-span-7 luxury-card rounded-xl p-5 sm:p-6 space-y-4"
        >
          <div className="pb-3 border-b border-[#EDEAE6]">
            <h2 className="font-display text-base font-semibold text-[#1C1C1C]">
              Student Academic Profile
            </h2>
            <p className="text-xs text-[#262E36] mt-0.5">
              Changes appear immediately on your dashboard header and PDF/CSV transcripts
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label htmlFor="set-name" className="block text-xs font-medium text-[#1C1C1C] mb-1.5">
                Full Name
              </label>
              <input
                id="set-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full min-h-[44px] px-3.5 py-2 rounded-lg border border-[#D3D1CE] text-sm text-[#0A0A0A] focus:outline-none focus:border-[#2F466F]"
              />
            </div>

            <div>
              <label htmlFor="set-id" className="block text-xs font-medium text-[#1C1C1C] mb-1.5">
                Roll No. / Student ID
              </label>
              <input
                id="set-id"
                type="text"
                placeholder="Optional"
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                className="w-full min-h-[44px] px-3.5 py-2 rounded-lg border border-[#D3D1CE] text-sm font-mono-tabular text-[#0A0A0A] focus:outline-none focus:border-[#2F466F]"
              />
            </div>
          </div>

          <div>
            <label htmlFor="set-college" className="block text-xs font-medium text-[#1C1C1C] mb-1.5">
              College / University Name <span className="text-[#536878] font-normal">(Optional)</span>
            </label>
            <input
              id="set-college"
              type="text"
              placeholder="e.g., National Institute of Technology"
              value={college}
              onChange={(e) => setCollege(e.target.value)}
              className="w-full min-h-[44px] px-3.5 py-2 rounded-lg border border-[#D3D1CE] text-sm text-[#0A0A0A] focus:outline-none focus:border-[#2F466F]"
            />
          </div>

          <div>
            <label htmlFor="set-branch" className="block text-xs font-medium text-[#1C1C1C] mb-1.5">
              Degree & Branch / Department
            </label>
            <select
              id="set-branch"
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value)}
              className="w-full min-h-[44px] px-3.5 py-2 rounded-lg border border-[#D3D1CE] bg-white text-sm text-[#0A0A0A] focus:outline-none focus:border-[#2F466F]"
            >
              {BRANCH_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.value}
                </option>
              ))}
              <option value="Other">Other (Custom Degree / Branch)</option>
            </select>
            {selectedBranch === 'Other' && (
              <input
                type="text"
                aria-label="Custom degree and branch"
                placeholder="Enter your degree and branch (e.g., B.Des Industrial Design)"
                value={customBranch}
                onChange={(e) => setCustomBranch(e.target.value)}
                className="mt-2.5 w-full min-h-[44px] px-3.5 py-2 rounded-lg border border-[#D3D1CE] text-sm text-[#0A0A0A] focus:outline-none focus:border-[#2F466F]"
              />
            )}
          </div>

          <div>
            <span className="block text-xs font-medium text-[#1C1C1C] mb-1.5">
              Current Semester
            </span>
            <div className="grid grid-cols-4 sm:grid-cols-8 gap-2" role="group" aria-label="Current semester">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((sem) => {
                const active = semesterNumber === sem;
                return (
                  <button
                    key={sem}
                    type="button"
                    onClick={() => setSemesterNumber(sem)}
                    aria-pressed={active}
                    className={`min-h-[44px] px-2 rounded-lg border text-xs font-medium transition-colors cursor-pointer ${
                      active
                        ? 'bg-[#0F223A] border-[#0F223A] text-white'
                        : 'bg-white border-[#D3D1CE] text-[#1C1C1C] hover:border-[#2F466F]'
                    }`}
                  >
                    Sem {sem}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="set-start" className="block text-xs font-medium text-[#1C1C1C] mb-1.5">
                Semester Start Date
              </label>
              <input
                id="set-start"
                type="date"
                value={semesterStart}
                onChange={(e) => setSemesterStart(e.target.value)}
                className="w-full min-h-[44px] px-3.5 py-2 rounded-lg border border-[#D3D1CE] text-sm font-mono-tabular text-[#0A0A0A] focus:outline-none focus:border-[#2F466F]"
              />
            </div>
            <div>
              <label htmlFor="set-end" className="block text-xs font-medium text-[#1C1C1C] mb-1.5">
                Semester End Date
              </label>
              <input
                id="set-end"
                type="date"
                value={semesterEnd}
                onChange={(e) => setSemesterEnd(e.target.value)}
                className="w-full min-h-[44px] px-3.5 py-2 rounded-lg border border-[#D3D1CE] text-sm font-mono-tabular text-[#0A0A0A] focus:outline-none focus:border-[#2F466F]"
              />
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              className="min-h-[44px] px-5 py-2 rounded-lg bg-[#0F223A] text-white text-sm font-medium hover:bg-[#2F466F] transition-colors cursor-pointer"
            >
              Save Profile
            </button>
          </div>
        </form>

        {/* Right Column: Benchmark, Alert Preferences, Sample Data & Session */}
        <div className="lg:col-span-5 space-y-5">
          {/* Custom Attendance Benchmark */}
          <section className="luxury-card rounded-xl p-5 sm:p-6">
            <h2 className="font-display text-base font-semibold text-[#1C1C1C]">
              Attendance Benchmark
            </h2>
            <p className="mt-1 text-xs text-[#262E36]">
              University minimum threshold used across gauges, predictors, and recovery math
            </p>

            <div className="mt-4">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-[#262E36]">Target Threshold</span>
                <span className="font-mono-tabular font-semibold text-[#0F223A]">
                  {draftBenchmark}%
                </span>
              </div>
              <input
                type="range"
                min={50}
                max={95}
                step={1}
                value={draftBenchmark}
                onChange={(e) => setDraftBenchmark(Number(e.target.value))}
                onMouseUp={() => void commitBenchmark(draftBenchmark)}
                onTouchEnd={() => void commitBenchmark(draftBenchmark)}
                onKeyUp={() => void commitBenchmark(draftBenchmark)}
                onBlur={() => void commitBenchmark(draftBenchmark)}
                aria-label="Minimum attendance threshold percentage"
                className="w-full h-11 accent-[#2F466F] cursor-pointer"
              />
              <div className="mt-2 flex items-center gap-2">
                {[75, 80, 85].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => {
                      setDraftBenchmark(preset);
                      void updateTargetAttendance(preset);
                    }}
                    className={`min-h-[44px] px-3.5 rounded-lg text-xs font-mono-tabular font-medium border transition-colors cursor-pointer ${
                      draftBenchmark === preset
                        ? 'bg-[#0F223A] border-[#0F223A] text-white'
                        : 'bg-white border-[#D3D1CE] text-[#1C1C1C] hover:border-[#2F466F]'
                    }`}
                  >
                    {preset}%
                  </button>
                ))}
              </div>
            </div>
          </section>

          {/* Alert Preferences */}
          <section className="luxury-card rounded-xl p-5 sm:p-6">
            <h2 className="font-display text-base font-semibold text-[#1C1C1C]">
              Alert Preferences
            </h2>
            <p className="mt-1 text-xs text-[#262E36]">
              Control automated threshold alerts and deadline reminders
            </p>

            <div className="mt-4 divide-y divide-[#EDEAE6]">
              {[
                {
                  id: 'alertLowAttendance' as const,
                  label: 'Low Attendance Warnings',
                  desc: `Notify when any course drops below ${draftBenchmark}%`,
                  enabled: alertLowAttendance,
                },
                {
                  id: 'alertExamReminders' as const,
                  label: 'Exam & Deadline Reminders',
                  desc: 'Surface alerts 5 days before exams and assignments',
                  enabled: alertExamReminders,
                },
                {
                  id: 'alertWeeklyDigest' as const,
                  label: 'Weekly Standing Digest',
                  desc: 'Summarize weekly class velocity and study hours',
                  enabled: alertWeeklyDigest,
                },
              ].map((pref) => (
                <div key={pref.id} className="py-3.5 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[#0A0A0A]">{pref.label}</p>
                    <p className="text-xs text-[#262E36] mt-0.5">{pref.desc}</p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={pref.enabled}
                    aria-label={pref.label}
                    onClick={() =>
                      void updateAlertPreferences({
                        [pref.id]: !pref.enabled,
                      })
                    }
                    className="min-h-[44px] min-w-[44px] flex items-center justify-end shrink-0 cursor-pointer"
                  >
                    <span
                      className={`relative w-11 h-6 rounded-full transition-colors flex items-center ${
                        pref.enabled ? 'bg-[#0F223A]' : 'bg-[#D3D1CE]'
                      }`}
                    >
                      <span
                        className={`block w-4 h-4 rounded-full bg-white transition-transform ${
                          pref.enabled ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </span>
                  </button>
                </div>
              ))}
            </div>
          </section>

          {/* Sample Data Reset & Account Session */}
          <section className="luxury-card rounded-xl p-5 sm:p-6 space-y-3">
            <div>
              <h2 className="font-display text-base font-semibold text-[#1C1C1C]">
                Data & Session
              </h2>
              <p className="mt-1 text-xs text-[#262E36]">
                Signed in as {student.email} ·{' '}
                {isFirebaseLive ? 'Cloud Firestore Active' : 'Offline / Guest Demo Mode'}
              </p>
            </div>

            <button
              type="button"
              disabled={isLoadingPreset || isResetting}
              onClick={() => void handleLoadUitPreset()}
              className="w-full min-h-[44px] px-4 py-2 rounded-lg bg-[#0F223A] text-white text-sm font-medium hover:bg-[#2F466F] transition-colors inline-flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>
                {isLoadingPreset
                  ? 'Loading UIT Preset...'
                  : 'Load Preset: UIT Sem 1 ECE (Section A)'}
              </span>
            </button>

            <Link
              to="/onboarding"
              className="w-full min-h-[44px] px-4 py-2 rounded-lg border border-[#D3D1CE] bg-white text-sm font-medium text-[#1C1C1C] hover:border-[#2F466F] transition-colors inline-flex items-center justify-center gap-2"
            >
              <Compass className="w-4 h-4 text-[#2F466F]" aria-hidden="true" />
              <span>Re-run Academic Onboarding Wizard</span>
            </Link>

            <button
              type="button"
              onClick={() => setConfirmResetOpen(true)}
              className="w-full min-h-[44px] px-4 py-2 rounded-lg border border-[#2F466F] bg-white text-sm font-medium text-[#0F223A] hover:bg-[#EDEAE6]/50 transition-colors inline-flex items-center justify-center gap-2 cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" aria-hidden="true" />
              <span>Reset / Seed Sample Academic Data</span>
            </button>

            <button
              type="button"
              onClick={() => void handleSignOut()}
              className="w-full min-h-[44px] px-4 py-2 rounded-lg border border-[#D3D1CE] text-sm font-medium text-[#8B2626] hover:border-[#8B2626] transition-colors inline-flex items-center justify-center gap-2 cursor-pointer"
            >
              <LogOut className="w-4 h-4" aria-hidden="true" />
              <span>Sign Out</span>
            </button>
          </section>
        </div>
      </div>

      {/* Confirm Reset / Seed Modal */}
      {confirmResetOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-[#0A0A0A]/45 backdrop-blur-xs"
            onClick={() => !isResetting && setConfirmResetOpen(false)}
            aria-hidden="true"
          />
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="reset-dialog-title"
            className="relative w-full max-w-[420px] bg-white border border-[#D3D1CE] rounded-xl p-6"
          >
            <h2 id="reset-dialog-title" className="font-display text-lg font-semibold text-[#0A0A0A]">
              Reset & Seed Sample Data?
            </h2>
            <p className="mt-2 text-sm text-[#262E36] leading-relaxed">
              This restores the Karnavati University (UIT) Semester 1 ECE (Section A) courses, Mon–Fri timetable, official exam &amp; holiday calendar, attendance logs, study tasks, and marks. Any custom edits will be overwritten.
            </p>
            <div className="mt-6 flex items-center justify-end gap-2">
              <button
                type="button"
                disabled={isResetting}
                onClick={() => setConfirmResetOpen(false)}
                className="min-h-[44px] px-4 py-2 rounded-lg border border-[#D3D1CE] text-xs font-medium text-[#1C1C1C] hover:border-[#0F223A] cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isResetting}
                onClick={() => void handleConfirmReset()}
                className="min-h-[44px] px-4 py-2 rounded-lg bg-[#0F223A] text-white text-xs font-medium hover:bg-[#2F466F] cursor-pointer disabled:opacity-50"
              >
                {isResetting ? 'Restoring...' : 'Restore Sample Data'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
