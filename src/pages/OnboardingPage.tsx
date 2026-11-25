import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  ChevronDown,
  Plus,
  Search,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { BrandLogo } from '../components/BrandLogo';
import { LoadingSkeleton } from '../components/LoadingSkeleton';
import { useAcademic } from '../context/AcademicContext';
import {
  BRANCH_OPTIONS,
  extractSemesterNumber,
  getSampleSubjectsForBranchAndSem,
  getShortBranchLabel,
} from '../data/academicCatalog';
import { UIT_PROFILE_DEFAULTS } from '../data/uitAcademicCalendar';
import { calculateAttendancePercent } from '../utils/attendanceMath';

interface DraftSubjectRow {
  localId: string;
  code: string;
  name: string;
  credits: number;
  weeklyHours: number;
  attendedClasses: number;
  totalClasses: number;
}

export function OnboardingPage() {
  const {
    student,
    isAuthenticated,
    isAuthLoading,
    isDataLoading,
    completeOnboarding,
    skipOnboarding,
  } = useAcademic();
  const navigate = useNavigate();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [submitting, setSubmitting] = useState(false);
  const [stepError, setStepError] = useState('');

  // Step 1: Academic Profile
  const [fullName, setFullName] = useState(student.name);
  const [college, setCollege] = useState(student.college ?? '');
  const [selectedBranch, setSelectedBranch] = useState(() => {
    const initial = student.branch || student.program || 'B.Tech Computer Engineering';
    const matchesPreset = BRANCH_OPTIONS.some(
      (b) => b.value.toLowerCase() === initial.toLowerCase(),
    );
    return matchesPreset ? initial : 'Other';
  });
  const [customBranch, setCustomBranch] = useState(() => {
    const initial = student.branch || student.program || '';
    const matchesPreset = BRANCH_OPTIONS.some(
      (b) => b.value.toLowerCase() === initial.toLowerCase(),
    );
    return matchesPreset ? '' : initial;
  });
  const [branchDropdownOpen, setBranchDropdownOpen] = useState(false);
  const [branchSearch, setBranchSearch] = useState('');
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  const [semesterNumber, setSemesterNumber] = useState<number>(() =>
    extractSemesterNumber(student.semester, student.semesterNumber),
  );
  const [studentId, setStudentId] = useState(student.studentId ?? '');

  // Step 2: Semester Rules & Benchmark
  const [targetAttendance, setTargetAttendance] = useState<number>(
    student.targetAttendance || 75,
  );
  const [semesterStart, setSemesterStart] = useState<string>(
    student.semesterStart || '2026-07-28',
  );
  const [semesterEnd, setSemesterEnd] = useState<string>(
    student.semesterEnd || '2026-12-16',
  );

  // Step 3: Quick Subject Setup
  const [draftSubjects, setDraftSubjects] = useState<DraftSubjectRow[]>([]);
  const [newSubName, setNewSubName] = useState('');
  const [newSubCode, setNewSubCode] = useState('');
  const [newSubAttended, setNewSubAttended] = useState(0);
  const [newSubTotal, setNewSubTotal] = useState(0);
  const [uitPresetSelected, setUitPresetSelected] = useState(false);

  // Keep pre-filled values in sync if Firestore profile loads after mount
  useEffect(() => {
    if (student.name && (fullName === 'Aarav Mehta' || fullName === 'Aarav Patel') && !student.isGuest) {
      setFullName(student.name);
    }
  }, [student.name, student.isGuest, fullName]);

  useEffect(() => {
    if (!branchDropdownOpen) return;
    const onMouseDown = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setBranchDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [branchDropdownOpen]);

  const resolvedBranch = useMemo(() => {
    if (selectedBranch === 'Other') {
      return customBranch.trim();
    }
    return selectedBranch;
  }, [selectedBranch, customBranch]);

  const filteredBranches = useMemo(() => {
    const q = branchSearch.trim().toLowerCase();
    if (!q) return BRANCH_OPTIONS;
    return BRANCH_OPTIONS.filter(
      (b) =>
        b.value.toLowerCase().includes(q) ||
        b.shortLabel.toLowerCase().includes(q) ||
        b.category.toLowerCase().includes(q),
    );
  }, [branchSearch]);

  if (isAuthLoading || isDataLoading) {
    return (
      <div className="min-h-screen bg-[#EDEAE6] p-6 lg:p-12 max-w-[900px] mx-auto">
        <LoadingSkeleton />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  const shortBranchDisplay = getShortBranchLabel(resolvedBranch || 'B.Tech CE');
  const progressPercent = step === 1 ? 33.33 : step === 2 ? 66.67 : 100;

  const handleNext = () => {
    setStepError('');
    if (step === 1) {
      if (!fullName.trim()) {
        setStepError('Please enter your full name to continue.');
        return;
      }
      if (!resolvedBranch) {
        setStepError('Please select or enter your degree & branch.');
        return;
      }
      setStep(2);
      return;
    }

    if (step === 2) {
      if (!Number.isFinite(targetAttendance) || targetAttendance < 50 || targetAttendance > 95) {
        setStepError('Minimum attendance requirement must be between 50% and 95%.');
        return;
      }
      if (!semesterStart || !semesterEnd || semesterStart >= semesterEnd) {
        setStepError('Semester end date must be after the semester start date.');
        return;
      }
      setStep(3);
    }
  };

  const handleBack = () => {
    setStepError('');
    if (step === 2) setStep(1);
    if (step === 3) setStep(2);
  };

  const handleApplyUitPreset = () => {
    setStepError('');
    setCollege(UIT_PROFILE_DEFAULTS.college ?? '');
    setSelectedBranch(UIT_PROFILE_DEFAULTS.branch ?? 'B.Tech Electronics & Communication Engineering (ECE) — Section A');
    setCustomBranch('');
    setSemesterNumber(1);
    setTargetAttendance(75);
    setSemesterStart(UIT_PROFILE_DEFAULTS.semesterStart);
    setSemesterEnd(UIT_PROFILE_DEFAULTS.semesterEnd);
    const samples = getSampleSubjectsForBranchAndSem(
      UIT_PROFILE_DEFAULTS.branch ?? 'B.Tech Electronics & Communication Engineering (ECE) — Section A',
      1,
    );
    setDraftSubjects(
      samples.map((s, idx) => ({
        localId: `uit_${Date.now()}_${idx}`,
        code: s.code,
        name: s.name,
        credits: s.credits,
        weeklyHours: s.weeklyHours,
        attendedClasses: s.attendedClasses,
        totalClasses: s.totalClasses,
      })),
    );
    setUitPresetSelected(true);
  };

  const handleLoadSampleSubjects = () => {
    setStepError('');
    const samples = getSampleSubjectsForBranchAndSem(
      resolvedBranch || 'B.Tech Computer Engineering',
      semesterNumber,
    );
    setDraftSubjects(
      samples.map((s, idx) => ({
        localId: `sample_${Date.now()}_${idx}`,
        code: s.code,
        name: s.name,
        credits: s.credits,
        weeklyHours: s.weeklyHours,
        attendedClasses: s.attendedClasses,
        totalClasses: s.totalClasses,
      })),
    );
  };

  const handleAddDraftSubject = (e: React.FormEvent) => {
    e.preventDefault();
    setStepError('');
    const cleanName = newSubName.trim();
    const cleanCode = newSubCode.trim().toUpperCase();
    if (!cleanName || !cleanCode) {
      setStepError('Enter both Subject Name and Course Code to add a subject.');
      return;
    }
    const total = Math.max(0, Math.round(Number(newSubTotal) || 0));
    const attended = Math.max(0, Math.round(Number(newSubAttended) || 0));
    if (attended > total) {
      setStepError('Initial attended classes (A) cannot exceed total classes (T).');
      return;
    }

    setDraftSubjects((prev) => [
      ...prev,
      {
        localId: `draft_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        code: cleanCode,
        name: cleanName,
        credits: 3,
        weeklyHours: 3,
        attendedClasses: attended,
        totalClasses: total,
      },
    ]);
    setNewSubName('');
    setNewSubCode('');
    setNewSubAttended(0);
    setNewSubTotal(0);
  };

  const updateDraftSubject = (localId: string, patch: Partial<DraftSubjectRow>) => {
    setDraftSubjects((prev) =>
      prev.map((row) => (row.localId === localId ? { ...row, ...patch } : row)),
    );
  };

  const handleCompleteSetup = async () => {
    setStepError('');
    for (const row of draftSubjects) {
      if (!row.name.trim() || !row.code.trim()) {
        setStepError('Every subject row must have both a Course Code and Subject Name.');
        return;
      }
      if (row.totalClasses < 0 || row.attendedClasses < 0 || row.attendedClasses > row.totalClasses) {
        setStepError(`For ${row.code}, Initial Attended (A) must be <= Total Classes (T).`);
        return;
      }
    }

    setSubmitting(true);
    try {
      await completeOnboarding({
        name: fullName.trim(),
        college: college.trim(),
        branch: resolvedBranch || 'B.Tech Electronics & Communication Engineering (ECE) — Section A',
        semesterNumber,
        studentId: studentId.trim(),
        targetAttendance,
        semesterStart,
        semesterEnd,
        loadUitSchedulePreset:
          uitPresetSelected ||
          (college.toLowerCase().includes('karnavati') && semesterNumber === 1),
        initialSubjects: draftSubjects.map((r) => ({
          code: r.code.trim().toUpperCase(),
          name: r.name.trim(),
          credits: r.credits,
          weeklyHours: r.weeklyHours,
          attendedClasses: r.attendedClasses,
          totalClasses: r.totalClasses,
        })),
      });
      navigate('/dashboard', { replace: true });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSkip = async () => {
    setSubmitting(true);
    try {
      await skipOnboarding();
      navigate('/dashboard', { replace: true });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#EDEAE6] text-[#0A0A0A] flex flex-col justify-center px-4 py-6 sm:p-8 overflow-x-clip">
      <div className="w-full max-w-[680px] mx-auto space-y-4">
        {/* Top Bar with Brand & Skip */}
        <div className="flex items-center justify-between gap-3">
          <BrandLogo variant="dark" compact />
          <button
            type="button"
            disabled={submitting}
            onClick={() => void handleSkip()}
            className="min-h-[44px] px-3 py-2 rounded-lg text-xs font-medium text-[#262E36] hover:text-[#0F223A] hover:bg-white/60 transition-colors cursor-pointer disabled:opacity-50"
          >
            Skip for now
          </button>
        </div>

        {/* Elevated Onboarding Wizard Card */}
        <div className="luxury-card rounded-xl p-5 sm:p-8">
          {/* Progress Header */}
          <div className="pb-5 border-b border-[#EDEAE6]">
            <div className="flex items-center justify-between gap-3 text-xs">
              <span className="font-mono-tabular font-semibold text-[#2F466F]">
                Step {step} of 3
              </span>
              <span className="text-[#262E36]">
                {step === 1
                  ? 'Academic Profile'
                  : step === 2
                    ? 'Semester Rules & Benchmark'
                    : 'Quick Subject Setup'}
              </span>
            </div>

            <div
              role="progressbar"
              aria-valuenow={Math.round(progressPercent)}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`Onboarding progress: step ${step} of 3`}
              className="mt-2.5 h-2 w-full rounded-full bg-[#EDEAE6] overflow-hidden"
            >
              <div
                className="h-full rounded-full bg-[#2F466F] transition-all duration-200"
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            <h1 className="mt-4 font-display text-xl sm:text-2xl font-semibold tracking-tight text-[#0A0A0A] text-balance">
              {step === 1
                ? 'Tell us about your academic program'
                : step === 2
                  ? 'Set your attendance rules & semester window'
                  : 'Add your current semester subjects'}
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-[#262E36]">
              {step === 1
                ? 'Your branch and semester personalize course suggestions, header badges, and AI guidance.'
                : step === 2
                  ? 'Predictors, recovery calculators, and threshold alerts calibrate automatically to these rules.'
                  : 'Start fresh at 0 / 0 or enter mid-semester totals. You can also load branch presets in one tap.'}
            </p>
          </div>

          {/* Step 1: Academic Profile */}
          {step === 1 && (
            <div className="mt-5 space-y-4">
              {/* Official Karnavati UIT Sem 1 ECE (Section A) One-Tap Preset */}
              <div className="rounded-xl border border-[#D3D1CE] bg-[#EDEAE6]/45 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-[#0A0A0A]">
                    Karnavati University (UIT) Quick Preset
                  </p>
                  <p className="text-[11px] text-[#262E36] mt-0.5">
                    Pre-fills UIT Odd Sem 2026–27 dates, 7 ECE subjects, Mon–Fri timetable, and holidays.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleApplyUitPreset}
                  className={`min-h-[44px] px-3.5 py-2 rounded-lg border text-xs font-semibold transition-colors inline-flex items-center justify-center gap-1.5 text-center sm:whitespace-nowrap shrink-0 cursor-pointer ${
                    uitPresetSelected
                      ? 'bg-[#0F223A] border-[#0F223A] text-white'
                      : 'bg-white border-[#2F466F] text-[#0F223A] hover:bg-[#EDEAE6]'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  <span>
                    {uitPresetSelected
                      ? 'Preset Loaded: UIT Sem 1 ECE (Section A)'
                      : 'Load Preset: UIT Sem 1 ECE (Section A)'}
                  </span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label htmlFor="ob-name" className="block text-xs font-medium text-[#1C1C1C] mb-1.5">
                    Full Name <span className="text-[#8B2626]">*</span>
                  </label>
                  <input
                    id="ob-name"
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Aarav Patel"
                    className="w-full min-h-[44px] px-3.5 py-2 rounded-lg border border-[#D3D1CE] bg-white text-sm text-[#0A0A0A] placeholder:text-[#536878] focus:outline-none focus:border-[#2F466F]"
                  />
                </div>

                <div>
                  <label htmlFor="ob-roll" className="block text-xs font-medium text-[#1C1C1C] mb-1.5">
                    Roll Number / Student ID <span className="text-[#536878]">(Optional)</span>
                  </label>
                  <input
                    id="ob-roll"
                    type="text"
                    value={studentId}
                    onChange={(e) => setStudentId(e.target.value)}
                    placeholder="e.g. 2024CE0418"
                    className="w-full min-h-[44px] px-3.5 py-2 rounded-lg border border-[#D3D1CE] bg-white text-sm font-mono-tabular text-[#0A0A0A] placeholder:text-[#536878] focus:outline-none focus:border-[#2F466F]"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="ob-college" className="block text-xs font-medium text-[#1C1C1C] mb-1.5">
                  College / University Name <span className="text-[#536878]">(Optional)</span>
                </label>
                <input
                  id="ob-college"
                  type="text"
                  value={college}
                  onChange={(e) => setCollege(e.target.value)}
                  placeholder="e.g. Karnavati University"
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-lg border border-[#D3D1CE] bg-white text-sm text-[#0A0A0A] placeholder:text-[#536878] focus:outline-none focus:border-[#2F466F]"
                />
              </div>

              {/* Searchable Degree & Branch / Department Selector */}
              <div ref={dropdownRef} className="relative">
                <label
                  htmlFor="ob-branch-trigger"
                  className="block text-xs font-medium text-[#1C1C1C] mb-1.5"
                >
                  Degree &amp; Branch / Department <span className="text-[#8B2626]">*</span>
                </label>
                <button
                  id="ob-branch-trigger"
                  type="button"
                  aria-expanded={branchDropdownOpen}
                  onClick={() => setBranchDropdownOpen((prev) => !prev)}
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-lg border border-[#D3D1CE] bg-white text-sm text-[#0A0A0A] flex items-center justify-between gap-2 text-left hover:border-[#2F466F] focus:outline-none focus:border-[#2F466F] cursor-pointer"
                >
                  <span className="truncate">
                    {selectedBranch === 'Other'
                      ? customBranch.trim() || 'Other (Enter custom branch below)'
                      : selectedBranch}
                  </span>
                  <ChevronDown className="w-4 h-4 text-[#536878] shrink-0" aria-hidden="true" />
                </button>

                {branchDropdownOpen && (
                  <div className="mt-1.5 rounded-xl border border-[#D3D1CE] bg-white shadow-lg overflow-hidden z-30">
                    <div className="p-2 border-b border-[#EDEAE6] relative">
                      <Search
                        className="w-4 h-4 text-[#536878] absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none"
                        aria-hidden="true"
                      />
                      <input
                        type="text"
                        value={branchSearch}
                        onChange={(e) => setBranchSearch(e.target.value)}
                        placeholder="Search branch or degree (e.g. CE, ME, BBA)..."
                        aria-label="Search branches"
                        className="w-full min-h-[44px] pl-9 pr-3 py-1.5 rounded-lg border border-[#D3D1CE] text-sm text-[#0A0A0A] placeholder:text-[#536878] focus:outline-none focus:border-[#2F466F]"
                      />
                    </div>
                    <div className="max-h-56 overflow-y-auto divide-y divide-[#EDEAE6]">
                      {filteredBranches.map((opt) => {
                        const active = selectedBranch === opt.value;
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => {
                              setSelectedBranch(opt.value);
                              setBranchDropdownOpen(false);
                              setBranchSearch('');
                            }}
                            className={`w-full min-h-[44px] px-3.5 py-2 text-left flex items-center justify-between gap-2 text-sm transition-colors cursor-pointer ${
                              active
                                ? 'bg-[#EDEAE6] text-[#0F223A] font-medium'
                                : 'text-[#0A0A0A] hover:bg-[#EDEAE6]/50'
                            }`}
                          >
                            <span className="truncate">{opt.value}</span>
                            <span className="text-xs text-[#536878] shrink-0">{opt.category}</span>
                          </button>
                        );
                      })}
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedBranch('Other');
                          setBranchDropdownOpen(false);
                          setBranchSearch('');
                        }}
                        className={`w-full min-h-[44px] px-3.5 py-2 text-left flex items-center justify-between gap-2 text-sm transition-colors cursor-pointer ${
                          selectedBranch === 'Other'
                            ? 'bg-[#EDEAE6] text-[#0F223A] font-medium'
                            : 'text-[#2F466F] hover:bg-[#EDEAE6]/50'
                        }`}
                      >
                        <span>Other (Specify custom degree or branch)</span>
                        <span className="text-xs text-[#536878]">Custom</span>
                      </button>
                    </div>
                  </div>
                )}

                {selectedBranch === 'Other' && (
                  <input
                    type="text"
                    value={customBranch}
                    onChange={(e) => setCustomBranch(e.target.value)}
                    placeholder="Enter your degree & branch (e.g. B.Arch, M.Tech AI)"
                    aria-label="Custom degree and branch"
                    className="mt-2.5 w-full min-h-[44px] px-3.5 py-2 rounded-lg border border-[#D3D1CE] bg-white text-sm text-[#0A0A0A] placeholder:text-[#536878] focus:outline-none focus:border-[#2F466F]"
                  />
                )}
              </div>

              {/* Current Semester Touch-Friendly Selector: Sem 1 - Sem 8 */}
              <div>
                <span className="block text-xs font-medium text-[#1C1C1C] mb-2">
                  Current Semester
                </span>
                <div className="grid grid-cols-4 gap-2">
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((sem) => (
                    <button
                      key={sem}
                      type="button"
                      onClick={() => setSemesterNumber(sem)}
                      aria-pressed={semesterNumber === sem}
                      className={`min-h-[44px] px-2 py-2 rounded-lg border text-xs font-mono-tabular font-medium transition-colors cursor-pointer ${
                        semesterNumber === sem
                          ? 'bg-[#0F223A] border-[#0F223A] text-white'
                          : 'bg-white border-[#D3D1CE] text-[#1C1C1C] hover:border-[#2F466F]'
                      }`}
                    >
                      Sem {sem}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Semester Rules & Attendance Benchmark */}
          {step === 2 && (
            <div className="mt-5 space-y-5">
              <div className="rounded-xl border border-[#D3D1CE] bg-[#EDEAE6]/35 p-4 space-y-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div>
                    <h2 className="font-display text-sm font-semibold text-[#0A0A0A]">
                      Minimum Attendance Requirement
                    </h2>
                    <p className="text-xs text-[#262E36] mt-0.5">
                      All predictors, recovery calculations, and low-attendance alerts calibrate to this benchmark.
                    </p>
                  </div>
                  <span className="font-display text-2xl font-semibold text-[#0F223A] tabular-nums">
                    {targetAttendance}%
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {[75, 80, 85].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setTargetAttendance(preset)}
                      aria-pressed={targetAttendance === preset}
                      className={`min-h-[44px] px-3 py-2 rounded-lg border text-xs font-mono-tabular font-semibold transition-colors cursor-pointer ${
                        targetAttendance === preset
                          ? 'bg-[#0F223A] border-[#0F223A] text-white'
                          : 'bg-white border-[#D3D1CE] text-[#1C1C1C] hover:border-[#2F466F]'
                      }`}
                    >
                      {preset}% {preset === 75 ? '(Default)' : ''}
                    </button>
                  ))}
                </div>

                <div>
                  <div className="flex items-center justify-between text-xs text-[#262E36] mb-1">
                    <label htmlFor="ob-benchmark-slider">Custom Threshold Slider</label>
                    <span className="font-mono-tabular">50% – 95%</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <input
                      id="ob-benchmark-slider"
                      type="range"
                      min={50}
                      max={95}
                      step={1}
                      value={targetAttendance}
                      onChange={(e) => setTargetAttendance(Number(e.target.value))}
                      className="flex-1 h-11 accent-[#2F466F] cursor-pointer"
                    />
                    <input
                      type="number"
                      min={50}
                      max={95}
                      value={targetAttendance}
                      onChange={(e) => setTargetAttendance(Number(e.target.value))}
                      aria-label="Custom minimum attendance percentage"
                      className="w-20 min-h-[44px] px-2.5 py-2 rounded-lg border border-[#D3D1CE] bg-white text-sm font-mono-tabular text-center text-[#0A0A0A] focus:outline-none focus:border-[#2F466F]"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <h2 className="font-display text-sm font-semibold text-[#0A0A0A]">
                    Semester Timeline
                  </h2>
                  <p className="text-xs text-[#262E36] mt-0.5">
                    Used by the Attendance Predictor to estimate remaining lectures before finals.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label htmlFor="ob-start" className="block text-xs font-medium text-[#1C1C1C] mb-1.5">
                      Semester Start Date
                    </label>
                    <input
                      id="ob-start"
                      type="date"
                      value={semesterStart}
                      onChange={(e) => setSemesterStart(e.target.value)}
                      className="w-full min-h-[44px] px-3.5 py-2 rounded-lg border border-[#D3D1CE] bg-white text-sm font-mono-tabular text-[#0A0A0A] focus:outline-none focus:border-[#2F466F]"
                    />
                  </div>
                  <div>
                    <label htmlFor="ob-end" className="block text-xs font-medium text-[#1C1C1C] mb-1.5">
                      Expected End Date
                    </label>
                    <input
                      id="ob-end"
                      type="date"
                      value={semesterEnd}
                      onChange={(e) => setSemesterEnd(e.target.value)}
                      className="w-full min-h-[44px] px-3.5 py-2 rounded-lg border border-[#D3D1CE] bg-white text-sm font-mono-tabular text-[#0A0A0A] focus:outline-none focus:border-[#2F466F]"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Quick Subject Setup (Optional / Fast-Start) */}
          {step === 3 && (
            <div className="mt-5 space-y-5">
              {/* One-Tap Branch & Semester Preset Helper */}
              <div className="rounded-xl border border-[#D3D1CE] bg-[#EDEAE6]/40 p-4 flex flex-col gap-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-[#0A0A0A]">
                      Fast-Start Course Presets
                    </p>
                    <p className="text-xs text-[#262E36] mt-0.5">
                      Populate subjects for {shortBranchDisplay} · Semester {semesterNumber}, or apply the verified Karnavati UIT Sem 1 ECE (Section A) timetable &amp; calendar.
                    </p>
                  </div>
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={handleApplyUitPreset}
                      className={`min-h-[44px] px-3.5 py-2 rounded-lg border text-xs font-semibold transition-colors inline-flex items-center justify-center gap-1.5 text-center sm:whitespace-nowrap cursor-pointer ${
                        uitPresetSelected
                          ? 'bg-[#0F223A] border-[#0F223A] text-white'
                          : 'bg-white border-[#0F223A] text-[#0F223A] hover:bg-[#EDEAE6]'
                      }`}
                    >
                      <Sparkles className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                      <span>Load Preset: UIT Sem 1 ECE (Section A)</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleLoadSampleSubjects}
                      className="min-h-[44px] px-3.5 py-2 rounded-lg border border-[#2F466F] bg-white text-xs font-semibold text-[#0F223A] hover:bg-[#EDEAE6] transition-colors inline-flex items-center justify-center gap-1.5 text-center sm:whitespace-nowrap cursor-pointer"
                    >
                      <span>
                        Load {shortBranchDisplay} Sem {semesterNumber}
                      </span>
                    </button>
                  </div>
                </div>
                {uitPresetSelected && (
                  <p className="text-[11px] font-medium text-[#1F5E3B]">
                    Karnavati University (UIT) Odd Sem 2026–27 timetable (Mon–Fri, Section A) and holiday calendar will also be initialized on completion.
                  </p>
                )}
              </div>

              {/* Add Individual Subject Form */}
              <form
                onSubmit={handleAddDraftSubject}
                className="rounded-xl border border-[#D3D1CE] bg-white p-4 space-y-3"
              >
                <p className="text-xs font-semibold text-[#1C1C1C]">Add a Subject</p>
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
                  <div className="sm:col-span-5">
                    <label htmlFor="ob-sub-name" className="block text-[11px] text-[#262E36] mb-1">
                      Subject Name
                    </label>
                    <input
                      id="ob-sub-name"
                      type="text"
                      value={newSubName}
                      onChange={(e) => setNewSubName(e.target.value)}
                      placeholder="e.g. Operating Systems"
                      className="w-full min-h-[44px] px-3 py-2 rounded-lg border border-[#D3D1CE] text-sm text-[#0A0A0A] focus:outline-none focus:border-[#2F466F]"
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <label htmlFor="ob-sub-code" className="block text-[11px] text-[#262E36] mb-1">
                      Subject Code
                    </label>
                    <input
                      id="ob-sub-code"
                      type="text"
                      value={newSubCode}
                      onChange={(e) => setNewSubCode(e.target.value)}
                      placeholder="CE501"
                      className="w-full min-h-[44px] px-3 py-2 rounded-lg border border-[#D3D1CE] text-sm font-mono-tabular uppercase text-[#0A0A0A] focus:outline-none focus:border-[#2F466F]"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:col-span-2">
                    <div>
                      <label htmlFor="ob-sub-a" className="block text-[11px] text-[#262E36] mb-1">
                        Attended
                      </label>
                      <input
                        id="ob-sub-a"
                        type="number"
                        min={0}
                        value={newSubAttended}
                        onChange={(e) => setNewSubAttended(Number(e.target.value))}
                        className="w-full min-h-[44px] px-2.5 py-2 rounded-lg border border-[#D3D1CE] text-sm font-mono-tabular text-[#0A0A0A] focus:outline-none focus:border-[#2F466F]"
                      />
                    </div>
                    <div>
                      <label htmlFor="ob-sub-t" className="block text-[11px] text-[#262E36] mb-1">
                        Total
                      </label>
                      <input
                        id="ob-sub-t"
                        type="number"
                        min={0}
                        value={newSubTotal}
                        onChange={(e) => setNewSubTotal(Number(e.target.value))}
                        className="w-full min-h-[44px] px-2.5 py-2 rounded-lg border border-[#D3D1CE] text-sm font-mono-tabular text-[#0A0A0A] focus:outline-none focus:border-[#2F466F]"
                      />
                    </div>
                  </div>
                  <div className="sm:col-span-2">
                    <button
                      type="submit"
                      className="w-full min-h-[44px] px-3 py-2 rounded-lg bg-[#2F466F] text-white text-xs font-medium hover:bg-[#0F223A] transition-colors inline-flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Add</span>
                    </button>
                  </div>
                </div>
              </form>

              {/* Queued Subjects List */}
              {draftSubjects.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[#D3D1CE] py-8 px-4 text-center">
                  <BookOpen className="w-6 h-6 text-[#536878] mx-auto mb-2" aria-hidden="true" />
                  <p className="text-sm font-medium text-[#0A0A0A]">No subjects added yet</p>
                  <p className="mt-1 text-xs text-[#262E36]">
                    Add courses above, load sample subjects in one tap, or complete setup now and import an ERP screenshot later.
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between text-xs text-[#262E36]">
                    <span className="font-medium text-[#1C1C1C]">
                      Subjects to Save ({draftSubjects.length})
                    </span>
                    <span>Edit A / T or course names before finishing</span>
                  </div>
                  <div className="divide-y divide-[#EDEAE6] rounded-xl border border-[#D3D1CE] bg-white">
                    {draftSubjects.map((row) => {
                      const pct = calculateAttendancePercent(row.attendedClasses, row.totalClasses);
                      return (
                        <div
                          key={row.localId}
                          className="p-3 grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-center"
                        >
                          <div className="sm:col-span-3">
                            <input
                              type="text"
                              value={row.code}
                              onChange={(e) =>
                                updateDraftSubject(row.localId, { code: e.target.value })
                              }
                              aria-label="Subject code"
                              className="w-full min-h-[44px] px-2.5 py-1.5 rounded-lg border border-[#D3D1CE] text-xs font-mono-tabular uppercase"
                            />
                          </div>
                          <div className="sm:col-span-5">
                            <input
                              type="text"
                              value={row.name}
                              onChange={(e) =>
                                updateDraftSubject(row.localId, { name: e.target.value })
                              }
                              aria-label="Subject name"
                              className="w-full min-h-[44px] px-2.5 py-1.5 rounded-lg border border-[#D3D1CE] text-xs"
                            />
                          </div>
                          <div className="sm:col-span-3 flex items-center gap-1.5">
                            <input
                              type="number"
                              min={0}
                              value={row.attendedClasses}
                              onChange={(e) =>
                                updateDraftSubject(row.localId, {
                                  attendedClasses: Number(e.target.value),
                                })
                              }
                              aria-label="Initial attended classes"
                              className="w-full min-h-[44px] px-2 py-1.5 rounded-lg border border-[#D3D1CE] text-xs font-mono-tabular text-center"
                            />
                            <span className="text-xs text-[#536878]">/</span>
                            <input
                              type="number"
                              min={0}
                              value={row.totalClasses}
                              onChange={(e) =>
                                updateDraftSubject(row.localId, {
                                  totalClasses: Number(e.target.value),
                                })
                              }
                              aria-label="Initial total classes"
                              className="w-full min-h-[44px] px-2 py-1.5 rounded-lg border border-[#D3D1CE] text-xs font-mono-tabular text-center"
                            />
                            <span className="w-12 text-right text-[11px] font-mono-tabular text-[#262E36] shrink-0">
                              {pct.toFixed(0)}%
                            </span>
                          </div>
                          <div className="sm:col-span-1 flex justify-end">
                            <button
                              type="button"
                              onClick={() =>
                                setDraftSubjects((prev) =>
                                  prev.filter((item) => item.localId !== row.localId),
                                )
                              }
                              aria-label={`Remove ${row.code}`}
                              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-[#536878] hover:text-[#8B2626] hover:bg-[#FDF2F2] cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" aria-hidden="true" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {stepError && (
            <p role="alert" className="mt-4 text-xs font-medium text-[#8B2626]">
              {stepError}
            </p>
          )}

          {/* Footer Back / Next / Complete Setup Controls */}
          <div className="mt-6 pt-5 border-t border-[#EDEAE6] flex items-center justify-between gap-3">
            {step > 1 ? (
              <button
                type="button"
                disabled={submitting}
                onClick={handleBack}
                className="min-h-[44px] px-4 py-2 rounded-lg border border-[#D3D1CE] bg-white text-xs font-medium text-[#1C1C1C] hover:border-[#0F223A] inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Back</span>
              </button>
            ) : (
              <div />
            )}

            {step < 3 ? (
              <button
                type="button"
                onClick={handleNext}
                className="min-h-[44px] px-5 py-2 rounded-lg bg-[#0F223A] text-white text-xs font-medium hover:bg-[#2F466F] transition-colors inline-flex items-center gap-1.5 cursor-pointer"
              >
                <span>Continue</span>
                <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            ) : (
              <button
                type="button"
                disabled={submitting}
                onClick={() => void handleCompleteSetup()}
                className="min-h-[44px] px-5 py-2 rounded-lg bg-[#0F223A] text-white text-xs font-medium hover:bg-[#2F466F] disabled:opacity-50 transition-colors inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{submitting ? 'Completing Setup...' : 'Complete Setup'}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
