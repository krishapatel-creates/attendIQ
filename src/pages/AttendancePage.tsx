import React, { useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Calendar,
  Camera,
  Check,
  Edit3,
  Loader2,
  Plus,
  Search,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { StandingText } from '../components/StandingText';
import { TodayCheckInBar } from '../components/TodayCheckInBar';
import { useAcademic, type ImportedSubjectRow } from '../context/AcademicContext';
import type { ClassLogEntry, ClassLogStatus, SubjectRecord } from '../types/academic';
import {
  calculateAttendancePercent,
  calculateRecoveryMetrics,
  deriveStanding,
} from '../utils/attendanceMath';

interface SubjectModalState {
  open: boolean;
  editingSubject: SubjectRecord | null;
}

interface LogModalState {
  open: boolean;
  editingLog: ClassLogEntry | null;
}

interface ReviewImportRow {
  localId: string;
  include: boolean;
  matchedSubjectId?: string;
  code: string;
  name: string;
  attended: number;
  total: number;
}

function deriveCourseCode(name: string, index: number, existingCodes: Set<string>): string {
  const words = name
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0 && !['and', 'of', 'the', 'for', 'in', 'to'].includes(w.toLowerCase()));
  const initials = words
    .slice(0, 3)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
  let candidate = `${initials || 'SUB'}${101 + index}`;
  let suffix = 1;
  while (existingCodes.has(candidate)) {
    candidate = `${initials || 'SUB'}${101 + index + suffix}`;
    suffix += 1;
  }
  existingCodes.add(candidate);
  return candidate;
}

export function AttendancePage() {
  const {
    student,
    subjects,
    classLogs,
    overallStats,
    todayDateISO,
    getEffectiveTarget,
    addSubject,
    updateSubject,
    bulkSyncImportedSubjects,
    deleteSubject,
    logClassSession,
    updateClassLog,
    deleteClassLog,
  } = useAcademic();

  const [filter, setFilter] = useState<'all' | 'at_risk' | 'on_track'>('all');

  // Mid-Semester Add / Edit Subject modal state
  const [subjectModal, setSubjectModal] = useState<SubjectModalState>({
    open: false,
    editingSubject: null,
  });
  const [formCode, setFormCode] = useState('');
  const [formName, setFormName] = useState('');
  const [formInstructor, setFormInstructor] = useState('');
  const [formCredits, setFormCredits] = useState(3);
  const [formWeeklyHours, setFormWeeklyHours] = useState(3);
  const [formAttended, setFormAttended] = useState(0);
  const [formTotal, setFormTotal] = useState(0);
  const [formUseCustomTarget, setFormUseCustomTarget] = useState(false);
  const [formTargetValue, setFormTargetValue] = useState<number>(student.targetAttendance);
  const [formError, setFormError] = useState('');
  const [savingSubject, setSavingSubject] = useState(false);

  // Subject delete confirmation modal
  const [deleteTarget, setDeleteTarget] = useState<SubjectRecord | null>(null);

  // Retroactive Log Past Date / Edit Log modal
  const [logModal, setLogModal] = useState<LogModalState>({
    open: false,
    editingLog: null,
  });
  const [logSubjectId, setLogSubjectId] = useState<string>(subjects[0]?.id ?? '');
  const [logStatus, setLogStatus] = useState<ClassLogStatus>('present');
  const [logDateISO, setLogDateISO] = useState(todayDateISO);
  const [logTopic, setLogTopic] = useState('');
  const [logModalError, setLogModalError] = useState('');
  const [savingLog, setSavingLog] = useState(false);

  // Delete Log Confirmation modal
  const [deleteLogTarget, setDeleteLogTarget] = useState<ClassLogEntry | null>(null);

  // Log History Filters
  const [historySearch, setHistorySearch] = useState('');
  const [historySubjectFilter, setHistorySubjectFilter] = useState<string>('all');
  const [historyStatusFilter, setHistoryStatusFilter] = useState<'all' | ClassLogStatus>('all');

  // Gemini Vision Screenshot Importer modal
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importPreviewUrl, setImportPreviewUrl] = useState<string | null>(null);
  const [importFileName, setImportFileName] = useState('');
  const [importParsing, setImportParsing] = useState(false);
  const [importError, setImportError] = useState('');
  const [importRows, setImportRows] = useState<ReviewImportRow[]>([]);
  const [importSyncing, setImportSyncing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const filteredSubjects = useMemo(() => {
    return subjects.filter((sub) => {
      const pct = calculateAttendancePercent(sub.attendedClasses, sub.totalClasses);
      const effectiveTarget = getEffectiveTarget(sub);
      if (filter === 'at_risk') return pct + 1e-9 < effectiveTarget;
      if (filter === 'on_track') return pct + 1e-9 >= effectiveTarget;
      return true;
    });
  }, [subjects, filter, getEffectiveTarget]);

  const atRiskCount = useMemo(
    () =>
      subjects.filter((s) => {
        const effectiveTarget = getEffectiveTarget(s);
        return (
          calculateAttendancePercent(s.attendedClasses, s.totalClasses) + 1e-9 < effectiveTarget
        );
      }).length,
    [subjects, getEffectiveTarget],
  );

  const filteredLogs = useMemo(() => {
    const query = historySearch.trim().toLowerCase();
    return classLogs.filter((log) => {
      if (historySubjectFilter !== 'all' && log.subjectId !== historySubjectFilter && log.courseCode !== historySubjectFilter) {
        return false;
      }
      if (historyStatusFilter !== 'all' && log.status !== historyStatusFilter) {
        return false;
      }
      if (query) {
        const hay = `${log.dateISO} ${log.courseCode} ${log.subjectName} ${log.topic} ${log.status}`.toLowerCase();
        if (!hay.includes(query)) return false;
      }
      return true;
    });
  }, [classLogs, historySearch, historySubjectFilter, historyStatusFilter]);

  // Subject Modal Helpers
  const openAddModal = () => {
    setFormCode('');
    setFormName('');
    setFormInstructor('');
    setFormCredits(3);
    setFormWeeklyHours(3);
    setFormAttended(0);
    setFormTotal(0);
    setFormUseCustomTarget(false);
    setFormTargetValue(student.targetAttendance);
    setFormError('');
    setSubjectModal({ open: true, editingSubject: null });
  };

  const openEditModal = (sub: SubjectRecord) => {
    setFormCode(sub.code);
    setFormName(sub.name);
    setFormInstructor(sub.instructor);
    setFormCredits(sub.credits);
    setFormWeeklyHours(sub.weeklyHours);
    setFormAttended(sub.attendedClasses);
    setFormTotal(sub.totalClasses);
    const hasOverride =
      sub.targetAttendance !== undefined && Number.isFinite(sub.targetAttendance);
    setFormUseCustomTarget(hasOverride);
    setFormTargetValue(hasOverride ? Number(sub.targetAttendance) : student.targetAttendance);
    setFormError('');
    setSubjectModal({ open: true, editingSubject: sub });
  };

  const previewTarget = formUseCustomTarget
    ? Math.min(95, Math.max(50, Math.round(Number(formTargetValue) || student.targetAttendance)))
    : student.targetAttendance;
  const safePreviewTotal = Number.isFinite(formTotal) ? Math.max(0, Math.round(formTotal)) : 0;
  const safePreviewAttended = Number.isFinite(formAttended) ? Math.max(0, Math.round(formAttended)) : 0;
  const previewValidCounts = safePreviewTotal >= 0 && safePreviewAttended >= 0 && safePreviewAttended <= safePreviewTotal;
  const previewPct = previewValidCounts
    ? calculateAttendancePercent(safePreviewAttended, safePreviewTotal)
    : 0;
  const previewMetrics = previewValidCounts
    ? calculateRecoveryMetrics(safePreviewAttended, safePreviewTotal, previewTarget)
    : null;
  const previewStanding = previewValidCounts
    ? deriveStanding(safePreviewAttended, safePreviewTotal, previewTarget)
    : null;

  const handleSaveSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!formCode.trim() || !formName.trim()) {
      setFormError('Course code and subject name are required.');
      return;
    }
    if (!Number.isFinite(formTotal) || !Number.isFinite(formAttended) || formTotal < 0 || formAttended < 0) {
      setFormError('Initial attended (A) and total classes (T) must be 0 or greater.');
      return;
    }
    if (Math.round(formAttended) > Math.round(formTotal)) {
      setFormError('Attended classes (A) cannot exceed total conducted classes (T).');
      return;
    }
    if (formUseCustomTarget && (!Number.isFinite(formTargetValue) || formTargetValue < 50 || formTargetValue > 95)) {
      setFormError('Target benchmark override must be between 50% and 95%.');
      return;
    }

    setSavingSubject(true);
    try {
      const payload = {
        code: formCode,
        name: formName,
        instructor: formInstructor,
        credits: formCredits,
        weeklyHours: formWeeklyHours,
        attendedClasses: Math.round(formAttended),
        totalClasses: Math.round(formTotal),
        targetAttendance: formUseCustomTarget ? Math.round(formTargetValue) : undefined,
      };

      if (subjectModal.editingSubject) {
        await updateSubject(subjectModal.editingSubject.id, payload);
      } else {
        await addSubject(payload);
      }
      setSubjectModal({ open: false, editingSubject: null });
    } finally {
      setSavingSubject(false);
    }
  };

  const handleConfirmDeleteSubject = async () => {
    if (!deleteTarget) return;
    await deleteSubject(deleteTarget.id);
    if (logSubjectId === deleteTarget.id) {
      const remaining = subjects.find((s) => s.id !== deleteTarget.id);
      setLogSubjectId(remaining?.id ?? '');
    }
    setDeleteTarget(null);
  };

  // Retroactive Log Modal Helpers
  const openLogPastModal = (presetSubjectId?: string) => {
    setLogSubjectId(presetSubjectId || subjects[0]?.id || '');
    setLogStatus('present');
    setLogDateISO(todayDateISO);
    setLogTopic('');
    setLogModalError('');
    setLogModal({ open: true, editingLog: null });
  };

  const openEditLogModal = (log: ClassLogEntry) => {
    const matchedSub =
      subjects.find((s) => s.id === log.subjectId) ||
      subjects.find((s) => s.code.toUpperCase() === log.courseCode.toUpperCase());
    setLogSubjectId(matchedSub?.id ?? log.subjectId);
    setLogStatus(log.status);
    setLogDateISO(log.dateISO);
    setLogTopic(log.topic);
    setLogModalError('');
    setLogModal({ open: true, editingLog: log });
  };

  const handleSaveLogModal = async (e: React.FormEvent) => {
    e.preventDefault();
    setLogModalError('');
    const targetId = logSubjectId || subjects[0]?.id;
    if (!targetId) {
      setLogModalError('Please add a subject before logging a class session.');
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(logDateISO)) {
      setLogModalError('Please choose a valid session date.');
      return;
    }

    setSavingLog(true);
    try {
      if (logModal.editingLog) {
        await updateClassLog(logModal.editingLog.id, {
          subjectId: targetId,
          status: logStatus,
          dateISO: logDateISO,
          topic: logTopic,
        });
      } else {
        await logClassSession({
          subjectId: targetId,
          status: logStatus,
          dateISO: logDateISO,
          topic: logTopic,
        });
      }
      setLogModal({ open: false, editingLog: null });
    } finally {
      setSavingLog(false);
    }
  };

  const handleConfirmDeleteLog = async () => {
    if (!deleteLogTarget) return;
    await deleteClassLog(deleteLogTarget.id);
    setDeleteLogTarget(null);
  };

  // Gemini Vision ERP Screenshot Importer Helpers
  const openImportModal = () => {
    setImportPreviewUrl(null);
    setImportFileName('');
    setImportError('');
    setImportRows([]);
    setImportParsing(false);
    setImportSyncing(false);
    setImportModalOpen(true);
  };

  const handleScreenshotSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setImportError('');
    setImportRows([]);

    const allowedTypes = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp']);
    const mimeType = file.type === 'image/jpg' ? 'image/jpeg' : file.type;
    if (!allowedTypes.has(file.type)) {
      setImportError('Please upload a PNG, JPG, or WEBP screenshot of your attendance portal.');
      return;
    }
    if (file.size > 5.8 * 1024 * 1024) {
      setImportError('Screenshot exceeds 5.8 MB. Please crop or compress the image first.');
      return;
    }

    setImportFileName(file.name);

    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
      reader.onerror = () => reject(new Error('Could not read the selected image file.'));
      reader.readAsDataURL(file);
    }).catch((err: unknown) => {
      setImportError(err instanceof Error ? err.message : 'Unable to read file.');
      return '';
    });

    if (!dataUrl) return;
    setImportPreviewUrl(dataUrl);
    setImportParsing(true);

    try {
      const response = await fetch('/api/parse-attendance-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: dataUrl,
          mimeType,
        }),
      });

      const payload = (await response.json()) as {
        error?: string;
        courses?: Array<{
          subjectName: string;
          courseCode?: string;
          attended: number;
          total: number;
        }>;
      };

      if (!response.ok) {
        throw new Error(payload.error || 'Could not parse attendance screenshot.');
      }

      const extracted = Array.isArray(payload.courses) ? payload.courses : [];
      if (extracted.length === 0) {
        setImportError(
          'No subject attendance rows were detected in that screenshot. You can add rows manually below or try a clearer image.',
        );
        return;
      }

      const usedCodes = new Set(subjects.map((s) => s.code.toUpperCase()));
      const mappedRows: ReviewImportRow[] = extracted.map((row, idx) => {
        const cleanCode = (row.courseCode ?? '').trim().toUpperCase();
        const cleanName = row.subjectName.trim();
        const matched = subjects.find(
          (s) =>
            (cleanCode && s.code.toUpperCase() === cleanCode) ||
            s.name.toLowerCase() === cleanName.toLowerCase() ||
            s.name.toLowerCase().includes(cleanName.toLowerCase()) ||
            cleanName.toLowerCase().includes(s.name.toLowerCase()),
        );
        const resolvedCode =
          matched?.code || cleanCode || deriveCourseCode(cleanName, idx, usedCodes);
        const total = Math.max(0, Math.round(row.total));
        const attended = Math.min(total, Math.max(0, Math.round(row.attended)));

        return {
          localId: `imp_${Date.now()}_${idx}`,
          include: true,
          matchedSubjectId: matched?.id,
          code: resolvedCode,
          name: cleanName,
          attended,
          total,
        };
      });

      setImportRows(mappedRows);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Failed to extract attendance table.');
    } finally {
      setImportParsing(false);
    }
  };

  const updateImportRow = (localId: string, patch: Partial<ReviewImportRow>) => {
    setImportRows((prev) =>
      prev.map((r) => {
        if (r.localId !== localId) return r;
        const next = { ...r, ...patch };
        if (patch.code !== undefined) {
          const upper = patch.code.trim().toUpperCase();
          const matched = subjects.find((s) => s.code.toUpperCase() === upper);
          next.matchedSubjectId = matched?.id;
        }
        return next;
      }),
    );
  };

  const addBlankImportRow = () => {
    const usedCodes = new Set([
      ...subjects.map((s) => s.code.toUpperCase()),
      ...importRows.map((r) => r.code.toUpperCase()),
    ]);
    setImportRows((prev) => [
      ...prev,
      {
        localId: `imp_${Date.now()}_manual`,
        include: true,
        code: deriveCourseCode('New Course', prev.length, usedCodes),
        name: '',
        attended: 0,
        total: 0,
      },
    ]);
  };

  const handleConfirmSyncImports = async () => {
    setImportError('');
    const selected = importRows.filter((r) => r.include);
    if (selected.length === 0) {
      setImportError('Select at least one row to sync.');
      return;
    }

    for (const row of selected) {
      if (!row.name.trim() || !row.code.trim()) {
        setImportError('Every selected row must have both a Course Code and Subject Name.');
        return;
      }
      if (row.total < 0 || row.attended < 0 || row.attended > row.total) {
        setImportError(`Invalid counts for ${row.code}: Attended (A) must be <= Total (T).`);
        return;
      }
    }

    setImportSyncing(true);
    try {
      const payload: ImportedSubjectRow[] = selected.map((r) => ({
        matchedSubjectId: r.matchedSubjectId,
        code: r.code.trim().toUpperCase(),
        name: r.name.trim(),
        attendedClasses: Math.round(r.attended),
        totalClasses: Math.round(r.total),
      }));
      await bulkSyncImportedSubjects(payload);
      setImportModalOpen(false);
    } finally {
      setImportSyncing(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Attendance"
        subtitle={`Check in today’s classes, import ERP portal screenshots, or edit your course ledger (${student.targetAttendance}% global target)`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => openLogPastModal()}
              className="min-h-[44px] px-3.5 py-2 rounded-lg border border-[#D3D1CE] bg-white text-xs font-medium text-[#0F223A] hover:border-[#2F466F] transition-colors inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
            >
              <Calendar className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Log Past Date</span>
            </button>
            <button
              type="button"
              onClick={openImportModal}
              className="min-h-[44px] px-3.5 py-2 rounded-lg border border-[#2F466F] bg-white text-xs font-semibold text-[#0F223A] hover:bg-[#EDEAE6]/60 transition-colors inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
            >
              <Camera className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Import from Screenshot</span>
            </button>
            <button
              type="button"
              onClick={openAddModal}
              className="min-h-[44px] px-4 py-2 rounded-lg bg-[#0F223A] text-white text-xs font-medium hover:bg-[#2F466F] transition-colors inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Add Subject</span>
            </button>
          </div>
        }
      />

      {/* 1. Today's Smart Check-In Bar */}
      <TodayCheckInBar compactHeaderLink />

      {/* Executive Summary & Filter Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="grid grid-cols-3 gap-2 sm:gap-3 flex-1">
          <div className="luxury-card rounded-xl p-3 sm:p-4 min-w-0">
            <p className="text-[11px] sm:text-xs text-[#262E36] truncate">Aggregate</p>
            <p className="mt-0.5 font-display text-base sm:text-2xl font-semibold text-[#0A0A0A] tabular-nums">
              {overallStats.percentage.toFixed(1)}%
            </p>
          </div>
          <div className="luxury-card rounded-xl p-3 sm:p-4 min-w-0">
            <p className="text-[11px] sm:text-xs text-[#262E36] truncate">Sessions</p>
            <p className="mt-0.5 font-display text-base sm:text-2xl font-semibold text-[#0A0A0A] tabular-nums">
              {overallStats.attended}/{overallStats.total}
            </p>
          </div>
          <div className="luxury-card rounded-xl p-3 sm:p-4 min-w-0">
            <p className="text-[11px] sm:text-xs text-[#262E36] truncate">Below Target</p>
            <p className="mt-0.5 font-display text-base sm:text-2xl font-semibold text-[#0A0A0A] tabular-nums">
              {atRiskCount} of {subjects.length}
            </p>
          </div>
        </div>

        <div className="w-full md:w-auto grid grid-cols-3 md:flex items-center gap-1 p-1 rounded-lg bg-white border border-[#D3D1CE] shrink-0">
          {(
            [
              { id: 'all', label: 'All Courses' },
              { id: 'at_risk', label: 'Below Target' },
              { id: 'on_track', label: 'Safe Zone' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilter(tab.id)}
              className={`min-h-[44px] md:min-h-[38px] px-2.5 sm:px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap truncate cursor-pointer ${
                filter === tab.id
                  ? 'bg-[#0F223A] text-white'
                  : 'text-[#262E36] hover:text-[#0A0A0A]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* 2. Responsive Subject Cards Grid */}
      {filteredSubjects.length === 0 ? (
        <div className="luxury-card rounded-xl p-10 text-center">
          <p className="text-sm font-medium text-[#0A0A0A]">No courses match this filter</p>
          <p className="mt-1 text-xs text-[#262E36]">
            Adjust the filter above, add a course manually, or import from an ERP screenshot.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filteredSubjects.map((sub) => {
            const effectiveTarget = getEffectiveTarget(sub);
            const hasOverride =
              sub.targetAttendance !== undefined &&
              sub.targetAttendance !== student.targetAttendance;
            const pct = calculateAttendancePercent(sub.attendedClasses, sub.totalClasses);
            const calc = calculateRecoveryMetrics(
              sub.attendedClasses,
              sub.totalClasses,
              effectiveTarget,
            );
            const standing = deriveStanding(
              sub.attendedClasses,
              sub.totalClasses,
              effectiveTarget,
            );
            const barWidth = Math.min(100, Math.max(0, pct));

            return (
              <article
                key={sub.id}
                className="luxury-card rounded-xl p-5 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="font-mono-tabular font-semibold text-[#0F223A]">
                        {sub.code}
                      </span>
                      <span aria-hidden="true" className="text-[#536878]">
                        ·
                      </span>
                      <StandingText standing={standing} />
                      {hasOverride && (
                        <>
                          <span aria-hidden="true" className="text-[#536878]">
                            ·
                          </span>
                          <span className="font-mono-tabular font-medium text-[#2F466F]">
                            Target {effectiveTarget}%
                          </span>
                        </>
                      )}
                    </div>

                    <div className="flex items-center gap-0.5 shrink-0 -mr-1.5 -mt-1.5">
                      <button
                        type="button"
                        onClick={() => openEditModal(sub)}
                        aria-label={`Edit ${sub.code}`}
                        className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-[#536878] hover:text-[#0F223A] hover:bg-[#EDEAE6]/60 transition-colors cursor-pointer"
                      >
                        <Edit3 className="w-4 h-4" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(sub)}
                        aria-label={`Delete ${sub.code}`}
                        className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-[#536878] hover:text-[#8B2626] hover:bg-[#FDF2F2] transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" aria-hidden="true" />
                      </button>
                    </div>
                  </div>

                  <h2 className="mt-1 font-display text-base font-semibold text-[#0A0A0A] leading-snug">
                    {sub.name}
                  </h2>
                  <p className="mt-0.5 text-xs text-[#262E36]">
                    {sub.instructor} · {sub.credits} Credits · {sub.weeklyHours} hrs/wk
                  </p>

                  <div className="mt-4 flex items-baseline justify-between gap-2">
                    <span className="font-display text-3xl font-semibold text-[#0A0A0A] tabular-nums">
                      {pct.toFixed(1)}%
                    </span>
                    <span className="font-mono-tabular text-xs font-medium text-[#262E36]">
                      {sub.attendedClasses} / {sub.totalClasses} classes
                    </span>
                  </div>

                  <div className="relative mt-2.5 h-2.5 w-full rounded-full bg-[#EDEAE6] overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-200 ${
                        calc.isSafeZone ? 'bg-[#0F223A]' : 'bg-[#2F466F]'
                      }`}
                      style={{ width: `${barWidth}%` }}
                    />
                    <div
                      title={`${effectiveTarget}% benchmark`}
                      className="absolute top-0 bottom-0 w-0.5 bg-[#8B2626]"
                      style={{ left: `${effectiveTarget}%` }}
                    />
                  </div>
                </div>

                <div className="mt-4 pt-3.5 border-t border-[#EDEAE6] flex items-center justify-between gap-3">
                  <p className="text-xs text-[#262E36] tabular-nums">
                    {calc.isSafeZone ? (
                      <span>
                        <span className="font-semibold text-[#1F5E3B]">Safe Zone</span> ·{' '}
                        {calc.safeToMiss} skip{calc.safeToMiss === 1 ? '' : 's'} left
                      </span>
                    ) : (
                      <span>
                        Need{' '}
                        <span className="font-semibold text-[#8B2626]">{calc.classesNeeded}</span>{' '}
                        consecutive
                      </span>
                    )}
                  </p>

                  <button
                    type="button"
                    onClick={() => openLogPastModal(sub.id)}
                    className="min-h-[44px] px-3.5 py-2 rounded-lg border border-[#D3D1CE] text-xs font-medium text-[#0F223A] hover:border-[#2F466F] hover:bg-[#EDEAE6]/50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    Log Past Date
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* 3. Filterable Attendance Log History */}
      <section aria-label="Attendance Log History" className="luxury-card rounded-xl p-5 sm:p-6">
        <div className="pb-4 border-b border-[#EDEAE6] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-base font-semibold text-[#1C1C1C]">
              Attendance Log History
            </h2>
            <p className="text-xs text-[#262E36] mt-0.5">
              Filterable audit trail — editing or deleting any record immediately recalculates course A & T
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <span className="text-xs font-mono-tabular text-[#536878]">
              {filteredLogs.length} of {classLogs.length} entries
            </span>
            <button
              type="button"
              onClick={() => openLogPastModal()}
              className="min-h-[44px] px-3.5 py-2 rounded-lg border border-[#D3D1CE] bg-white text-xs font-medium text-[#0F223A] hover:border-[#2F466F] transition-colors inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
            >
              <Calendar className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Log Past Date</span>
            </button>
          </div>
        </div>

        {/* History Filter Controls */}
        <div className="mt-4 grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
          <div className="md:col-span-5 relative">
            <Search
              className="w-4 h-4 text-[#536878] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
            <input
              type="search"
              value={historySearch}
              onChange={(e) => setHistorySearch(e.target.value)}
              placeholder="Search notes, course, or YYYY-MM-DD..."
              aria-label="Search attendance history"
              className="w-full min-h-[44px] pl-9 pr-3 py-2 rounded-lg border border-[#D3D1CE] bg-white text-sm text-[#0A0A0A] placeholder:text-[#536878] focus:outline-none focus:border-[#2F466F]"
            />
          </div>

          <div className="md:col-span-3">
            <select
              value={historySubjectFilter}
              onChange={(e) => setHistorySubjectFilter(e.target.value)}
              aria-label="Filter history by subject"
              className="w-full min-h-[44px] px-3 py-2 rounded-lg border border-[#D3D1CE] bg-white text-sm text-[#0A0A0A] focus:outline-none focus:border-[#2F466F]"
            >
              <option value="all">All Subjects</option>
              {subjects.map((sub) => (
                <option key={sub.id} value={sub.id}>
                  {sub.code} — {sub.name}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-4 grid grid-cols-4 gap-1 p-1 rounded-lg bg-[#EDEAE6] border border-[#D3D1CE]">
            {(['all', 'present', 'absent', 'cancelled'] as const).map((statusTab) => (
              <button
                key={statusTab}
                type="button"
                onClick={() => setHistoryStatusFilter(statusTab)}
                className={`min-h-[44px] md:min-h-[36px] px-2 py-1 rounded-md text-xs font-medium capitalize transition-colors cursor-pointer ${
                  historyStatusFilter === statusTab
                    ? 'bg-[#0F223A] text-white'
                    : 'text-[#1C1C1C] hover:text-[#0A0A0A]'
                }`}
              >
                {statusTab}
              </button>
            ))}
          </div>
        </div>

        {filteredLogs.length === 0 ? (
          <div className="py-10 text-center">
            <p className="text-sm font-medium text-[#0A0A0A]">No matching log entries</p>
            <p className="mt-1 text-xs text-[#262E36]">
              Clear your filters or use &ldquo;Log Past Date&rdquo; to record an earlier session.
            </p>
          </div>
        ) : (
          <>
            {/* Mobile Stacked History List (< md) */}
            <div className="mt-4 divide-y divide-[#EDEAE6] md:hidden">
              {filteredLogs.map((log) => (
                <div key={log.id} className="py-3.5 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5 text-xs text-[#262E36]">
                        <span className="font-mono-tabular font-medium text-[#0A0A0A]">
                          {log.dateISO}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono-tabular font-semibold text-[#0F223A]">
                          {log.courseCode}
                        </span>
                      </div>
                      <p className="mt-0.5 text-sm font-semibold text-[#0A0A0A] truncate">
                        {log.subjectName}
                      </p>
                      <p className="mt-0.5 text-xs text-[#262E36] break-words">{log.topic}</p>
                    </div>
                    <span
                      className={`text-xs font-semibold capitalize shrink-0 ${
                        log.status === 'present'
                          ? 'text-[#1F5E3B]'
                          : log.status === 'absent'
                            ? 'text-[#8B2626]'
                            : 'text-[#536878]'
                      }`}
                    >
                      {log.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => openEditLogModal(log)}
                      className="min-h-[44px] flex-1 px-3 py-1.5 rounded-lg border border-[#D3D1CE] text-xs font-medium text-[#0F223A] hover:border-[#2F466F] inline-flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Edit</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteLogTarget(log)}
                      className="min-h-[44px] flex-1 px-3 py-1.5 rounded-lg border border-[#D3D1CE] text-xs font-medium text-[#8B2626] hover:border-[#8B2626] inline-flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Delete</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop History Table (>= md) */}
            <div className="mt-4 hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#D3D1CE] text-[11px] uppercase tracking-wider text-[#262E36]">
                    <th className="py-2.5 pr-4 font-medium">Date</th>
                    <th className="py-2.5 px-4 font-medium">Subject</th>
                    <th className="py-2.5 px-4 font-medium">Status</th>
                    <th className="py-2.5 px-4 font-medium">Notes / Topic</th>
                    <th className="py-2.5 pl-4 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EDEAE6] text-sm">
                  {filteredLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-[#EDEAE6]/35 transition-colors">
                      <td className="py-3 pr-4 font-mono-tabular text-xs text-[#0A0A0A] whitespace-nowrap">
                        {log.dateISO}
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-mono-tabular text-xs font-semibold text-[#0F223A] mr-2">
                          {log.courseCode}
                        </span>
                        <span className="text-sm text-[#0A0A0A]">{log.subjectName}</span>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`text-xs font-semibold capitalize ${
                            log.status === 'present'
                              ? 'text-[#1F5E3B]'
                              : log.status === 'absent'
                                ? 'text-[#8B2626]'
                                : 'text-[#536878]'
                          }`}
                        >
                          {log.status === 'cancelled' ? 'Cancelled / Holiday' : log.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-xs text-[#262E36] max-w-[320px] truncate">
                        {log.topic}
                      </td>
                      <td className="py-3 pl-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => openEditLogModal(log)}
                            aria-label={`Edit log for ${log.courseCode} on ${log.dateISO}`}
                            className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg text-[#536878] hover:text-[#0F223A] hover:bg-[#EDEAE6]/60 cursor-pointer"
                          >
                            <Edit3 className="w-4 h-4" aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteLogTarget(log)}
                            aria-label={`Delete log for ${log.courseCode} on ${log.dateISO}`}
                            className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg text-[#536878] hover:text-[#8B2626] hover:bg-[#FDF2F2] cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" aria-hidden="true" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      {/* Mid-Semester Add / Edit Subject Modal */}
      {subjectModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-[#0A0A0A]/45 backdrop-blur-xs"
            onClick={() => setSubjectModal({ open: false, editingSubject: null })}
            aria-hidden="true"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label={subjectModal.editingSubject ? 'Edit Subject' : 'Add Subject'}
            className="relative w-full max-w-[540px] bg-white border border-[#D3D1CE] rounded-xl p-6 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between pb-4 border-b border-[#EDEAE6]">
              <div>
                <h2 className="font-display text-lg font-semibold text-[#0A0A0A]">
                  {subjectModal.editingSubject ? 'Edit Subject & Counters' : 'Mid-Semester Subject Setup'}
                </h2>
                <p className="text-xs text-[#262E36] mt-0.5">
                  Enter current portal totals to calibrate recovery math immediately
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSubjectModal({ open: false, editingSubject: null })}
                aria-label="Close modal"
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-[#536878] hover:bg-[#EDEAE6] cursor-pointer"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>

            <form onSubmit={handleSaveSubject} className="mt-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label htmlFor="sub-code" className="block text-xs font-medium text-[#1C1C1C] mb-1.5">
                    Course Code
                  </label>
                  <input
                    id="sub-code"
                    type="text"
                    value={formCode}
                    onChange={(e) => setFormCode(e.target.value)}
                    placeholder="CS308"
                    className="w-full min-h-[44px] px-3 py-2 rounded-lg border border-[#D3D1CE] text-sm font-mono-tabular uppercase focus:outline-none focus:border-[#2F466F]"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="sub-name" className="block text-xs font-medium text-[#1C1C1C] mb-1.5">
                    Subject Name
                  </label>
                  <input
                    id="sub-name"
                    type="text"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="Distributed Systems"
                    className="w-full min-h-[44px] px-3 py-2 rounded-lg border border-[#D3D1CE] text-sm focus:outline-none focus:border-[#2F466F]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-1">
                  <label htmlFor="sub-credits" className="block text-xs font-medium text-[#1C1C1C] mb-1.5">
                    Credits
                  </label>
                  <input
                    id="sub-credits"
                    type="number"
                    min={1}
                    max={6}
                    value={formCredits}
                    onChange={(e) => setFormCredits(Number(e.target.value))}
                    className="w-full min-h-[44px] px-3 py-2 rounded-lg border border-[#D3D1CE] text-sm font-mono-tabular focus:outline-none focus:border-[#2F466F]"
                  />
                </div>
                <div className="sm:col-span-1">
                  <label htmlFor="sub-weekly" className="block text-xs font-medium text-[#1C1C1C] mb-1.5">
                    Hrs / Week
                  </label>
                  <input
                    id="sub-weekly"
                    type="number"
                    min={1}
                    max={10}
                    value={formWeeklyHours}
                    onChange={(e) => setFormWeeklyHours(Number(e.target.value))}
                    className="w-full min-h-[44px] px-3 py-2 rounded-lg border border-[#D3D1CE] text-sm font-mono-tabular focus:outline-none focus:border-[#2F466F]"
                  />
                </div>
                <div className="sm:col-span-1">
                  <label htmlFor="sub-instructor" className="block text-xs font-medium text-[#1C1C1C] mb-1.5">
                    Instructor
                  </label>
                  <input
                    id="sub-instructor"
                    type="text"
                    value={formInstructor}
                    onChange={(e) => setFormInstructor(e.target.value)}
                    placeholder="Dr. Kavita Rao"
                    className="w-full min-h-[44px] px-3 py-2 rounded-lg border border-[#D3D1CE] text-sm focus:outline-none focus:border-[#2F466F]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="sub-attended" className="block text-xs font-medium text-[#1C1C1C] mb-1.5">
                    Initial Classes Attended (A)
                  </label>
                  <input
                    id="sub-attended"
                    type="number"
                    min={0}
                    value={formAttended}
                    onChange={(e) => setFormAttended(Number(e.target.value))}
                    className="w-full min-h-[44px] px-3 py-2 rounded-lg border border-[#D3D1CE] text-sm font-mono-tabular focus:outline-none focus:border-[#2F466F]"
                  />
                </div>
                <div>
                  <label htmlFor="sub-total" className="block text-xs font-medium text-[#1C1C1C] mb-1.5">
                    Total Classes Conducted (T)
                  </label>
                  <input
                    id="sub-total"
                    type="number"
                    min={0}
                    value={formTotal}
                    onChange={(e) => setFormTotal(Number(e.target.value))}
                    className="w-full min-h-[44px] px-3 py-2 rounded-lg border border-[#D3D1CE] text-sm font-mono-tabular focus:outline-none focus:border-[#2F466F]"
                  />
                </div>
              </div>

              {/* Target Benchmark Override */}
              <div className="rounded-xl border border-[#D3D1CE] bg-[#EDEAE6]/40 p-3.5 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-semibold text-[#0A0A0A]">
                      Target Benchmark Override
                    </p>
                    <p className="text-[11px] text-[#262E36]">
                      Defaults to your global {student.targetAttendance}% benchmark
                    </p>
                  </div>
                  <div className="inline-flex rounded-lg border border-[#D3D1CE] bg-white p-0.5">
                    <button
                      type="button"
                      onClick={() => setFormUseCustomTarget(false)}
                      className={`min-h-[44px] sm:min-h-[36px] px-3 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                        !formUseCustomTarget ? 'bg-[#0F223A] text-white' : 'text-[#1C1C1C]'
                      }`}
                    >
                      Global ({student.targetAttendance}%)
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormUseCustomTarget(true)}
                      className={`min-h-[44px] sm:min-h-[36px] px-3 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                        formUseCustomTarget ? 'bg-[#0F223A] text-white' : 'text-[#1C1C1C]'
                      }`}
                    >
                      Custom
                    </button>
                  </div>
                </div>

                {formUseCustomTarget && (
                  <div className="flex flex-wrap items-center gap-2">
                    {[75, 80, 85].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setFormTargetValue(preset)}
                        className={`min-h-[44px] px-3 rounded-lg border text-xs font-mono-tabular font-medium transition-colors cursor-pointer ${
                          Number(formTargetValue) === preset
                            ? 'bg-[#2F466F] border-[#2F466F] text-white'
                            : 'bg-white border-[#D3D1CE] text-[#0A0A0A]'
                        }`}
                      >
                        {preset}%
                      </button>
                    ))}
                    <div className="flex items-center gap-1.5 ml-auto">
                      <label htmlFor="sub-custom-target" className="text-xs text-[#262E36]">
                        Custom %
                      </label>
                      <input
                        id="sub-custom-target"
                        type="number"
                        min={50}
                        max={95}
                        value={formTargetValue}
                        onChange={(e) => setFormTargetValue(Number(e.target.value))}
                        className="w-20 min-h-[44px] px-2.5 py-1.5 rounded-lg border border-[#D3D1CE] bg-white text-sm font-mono-tabular focus:outline-none focus:border-[#2F466F]"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Live Calculated Percentage Preview */}
              <div className="rounded-xl border border-[#D3D1CE] bg-white p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-[#262E36]">
                    Live Attendance Preview ({previewTarget}% target)
                  </span>
                  {previewStanding && <StandingText standing={previewStanding} />}
                </div>
                {previewValidCounts ? (
                  <div className="mt-2 flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-display text-2xl font-semibold text-[#0A0A0A] tabular-nums">
                      {previewPct.toFixed(1)}%
                    </span>
                    <span className="text-xs text-[#262E36] tabular-nums">
                      {previewMetrics?.isSafeZone
                        ? `Safe Zone — can skip ${previewMetrics.safeToMiss} class${previewMetrics.safeToMiss === 1 ? '' : 'es'}`
                        : `Need ${previewMetrics?.classesNeeded ?? 0} consecutive classes for ${previewTarget}%`}
                    </span>
                  </div>
                ) : (
                  <p className="mt-2 text-xs font-medium text-[#8B2626]">
                    Invalid counts: Attended (A) must be less than or equal to Total (T).
                  </p>
                )}
              </div>

              {formError && (
                <p role="alert" className="text-xs font-medium text-[#8B2626]">
                  {formError}
                </p>
              )}

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSubjectModal({ open: false, editingSubject: null })}
                  className="min-h-[44px] px-4 py-2 rounded-lg border border-[#D3D1CE] text-xs font-medium text-[#1C1C1C] hover:border-[#0F223A] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingSubject}
                  className="min-h-[44px] px-5 py-2 rounded-lg bg-[#0F223A] text-white text-xs font-medium hover:bg-[#2F466F] disabled:opacity-50 cursor-pointer"
                >
                  {savingSubject
                    ? 'Saving...'
                    : subjectModal.editingSubject
                      ? 'Save Changes'
                      : 'Create Subject'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Retroactive Log Past Date / Edit Log Modal */}
      {logModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-[#0A0A0A]/45 backdrop-blur-xs"
            onClick={() => setLogModal({ open: false, editingLog: null })}
            aria-hidden="true"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label={logModal.editingLog ? 'Edit Attendance Log' : 'Log Past Date'}
            className="relative w-full max-w-[480px] bg-white border border-[#D3D1CE] rounded-xl p-6 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between pb-4 border-b border-[#EDEAE6]">
              <div>
                <h2 className="font-display text-lg font-semibold text-[#0A0A0A]">
                  {logModal.editingLog ? 'Edit Attendance Log' : 'Log Past Class Date'}
                </h2>
                <p className="text-xs text-[#262E36] mt-0.5">
                  Present updates A+1 & T+1 · Absent updates T+1 · Cancelled keeps % unchanged
                </p>
              </div>
              <button
                type="button"
                onClick={() => setLogModal({ open: false, editingLog: null })}
                aria-label="Close log modal"
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-[#536878] hover:bg-[#EDEAE6] cursor-pointer"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>

            <form onSubmit={handleSaveLogModal} className="mt-4 space-y-4">
              <div>
                <label htmlFor="modal-log-subject" className="block text-xs font-medium text-[#1C1C1C] mb-1.5">
                  Subject
                </label>
                <select
                  id="modal-log-subject"
                  value={logSubjectId || subjects[0]?.id || ''}
                  onChange={(e) => setLogSubjectId(e.target.value)}
                  className="w-full min-h-[44px] px-3 py-2 rounded-lg border border-[#D3D1CE] bg-white text-sm text-[#0A0A0A] focus:outline-none focus:border-[#2F466F]"
                >
                  {subjects.map((sub) => (
                    <option key={sub.id} value={sub.id}>
                      {sub.code} — {sub.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <span className="block text-xs font-medium text-[#1C1C1C] mb-1.5">Status</span>
                <div className="grid grid-cols-3 gap-1.5 p-1 rounded-lg bg-[#EDEAE6] border border-[#D3D1CE]">
                  {(['present', 'absent', 'cancelled'] as const).map((statusOption) => (
                    <button
                      key={statusOption}
                      type="button"
                      onClick={() => setLogStatus(statusOption)}
                      className={`min-h-[44px] rounded-md text-xs font-medium capitalize transition-colors cursor-pointer ${
                        logStatus === statusOption
                          ? statusOption === 'absent'
                            ? 'bg-[#8B2626] text-white'
                            : statusOption === 'cancelled'
                              ? 'bg-[#2F466F] text-white'
                              : 'bg-[#0F223A] text-white'
                          : 'text-[#1C1C1C] hover:text-[#0A0A0A]'
                      }`}
                    >
                      {statusOption}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label htmlFor="modal-log-date" className="block text-xs font-medium text-[#1C1C1C] mb-1.5">
                  Class Date
                </label>
                <input
                  id="modal-log-date"
                  type="date"
                  value={logDateISO}
                  onChange={(e) => setLogDateISO(e.target.value)}
                  className="w-full min-h-[44px] px-3 py-2 rounded-lg border border-[#D3D1CE] bg-white text-sm font-mono-tabular text-[#0A0A0A] focus:outline-none focus:border-[#2F466F]"
                />
              </div>

              <div>
                <label htmlFor="modal-log-topic" className="block text-xs font-medium text-[#1C1C1C] mb-1.5">
                  Notes / Lecture Topic
                </label>
                <input
                  id="modal-log-topic"
                  type="text"
                  value={logTopic}
                  onChange={(e) => setLogTopic(e.target.value)}
                  placeholder="e.g. Virtual Memory Paging or Medical Leave"
                  className="w-full min-h-[44px] px-3 py-2 rounded-lg border border-[#D3D1CE] bg-white text-sm text-[#0A0A0A] placeholder:text-[#536878] focus:outline-none focus:border-[#2F466F]"
                />
              </div>

              {logModalError && (
                <p role="alert" className="text-xs font-medium text-[#8B2626]">
                  {logModalError}
                </p>
              )}

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setLogModal({ open: false, editingLog: null })}
                  className="min-h-[44px] px-4 py-2 rounded-lg border border-[#D3D1CE] text-xs font-medium text-[#1C1C1C] hover:border-[#0F223A] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingLog || subjects.length === 0}
                  className="min-h-[44px] px-5 py-2 rounded-lg bg-[#0F223A] text-white text-xs font-medium hover:bg-[#2F466F] disabled:opacity-50 inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>
                    {savingLog
                      ? 'Saving...'
                      : logModal.editingLog
                        ? 'Save Log Changes'
                        : 'Save Session'}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Gemini Vision "Scan ERP Portal Screenshot" Importer Modal */}
      {importModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-[#0A0A0A]/45 backdrop-blur-xs"
            onClick={() => !importSyncing && setImportModalOpen(false)}
            aria-hidden="true"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Import from ERP Portal Screenshot"
            className="relative w-full max-w-[780px] bg-white border border-[#D3D1CE] rounded-xl p-6 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between pb-4 border-b border-[#EDEAE6]">
              <div>
                <h2 className="font-display text-lg font-semibold text-[#0A0A0A]">
                  Import Attendance from ERP Screenshot
                </h2>
                <p className="text-xs text-[#262E36] mt-0.5">
                  Upload your college portal screenshot to extract courses and sync A / T totals in one click
                </p>
              </div>
              <button
                type="button"
                disabled={importSyncing}
                onClick={() => setImportModalOpen(false)}
                aria-label="Close importer modal"
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-[#536878] hover:bg-[#EDEAE6] cursor-pointer"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>

            <div className="mt-4 space-y-5">
              {/* Upload Box */}
              <div className="rounded-xl border border-dashed border-[#2F466F]/50 bg-[#EDEAE6]/35 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[#0A0A0A]">
                    {importFileName || 'Upload ERP Attendance Screenshot'}
                  </p>
                  <p className="text-xs text-[#262E36] mt-0.5">
                    Supports PNG, JPG, and WEBP up to 5.8 MB. Review and edit numbers before syncing.
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={handleScreenshotSelected}
                    className="sr-only"
                    aria-label="Choose ERP attendance screenshot"
                  />
                  <button
                    type="button"
                    disabled={importParsing || importSyncing}
                    onClick={() => fileInputRef.current?.click()}
                    className="min-h-[44px] px-4 py-2 rounded-lg bg-[#0F223A] text-white text-xs font-medium hover:bg-[#2F466F] disabled:opacity-50 inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>{importPreviewUrl ? 'Choose Another Image' : 'Select Screenshot'}</span>
                  </button>
                </div>
              </div>

              {importPreviewUrl && (
                <div className="rounded-xl border border-[#D3D1CE] bg-[#EDEAE6]/25 p-3">
                  <img
                    src={importPreviewUrl}
                    alt="Uploaded ERP portal preview"
                    className="max-h-48 w-full object-contain rounded-lg"
                  />
                </div>
              )}

              {importParsing && (
                <div className="rounded-xl border border-[#D3D1CE] bg-[#EDEAE6]/40 p-4 flex items-center gap-3">
                  <Loader2 className="w-5 h-5 text-[#0F223A] animate-spin shrink-0" aria-hidden="true" />
                  <div>
                    <p className="text-sm font-medium text-[#0A0A0A]">
                      Extracting attendance rows with Gemini Vision...
                    </p>
                    <p className="text-xs text-[#262E36]">
                      Identifying subject titles, course codes, attended classes, and total classes.
                    </p>
                  </div>
                </div>
              )}

              {importError && (
                <div
                  role="alert"
                  className="rounded-xl border border-[#8B2626]/30 bg-[#FDF2F2] p-3.5 flex items-start gap-2.5 text-xs text-[#8B2626]"
                >
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                  <span>{importError}</span>
                </div>
              )}

              {/* Editable Review Table */}
              {importRows.length > 0 && (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="font-display text-sm font-semibold text-[#1C1C1C]">
                      Review Extracted Subjects ({importRows.filter((r) => r.include).length} selected)
                    </h3>
                    <button
                      type="button"
                      onClick={addBlankImportRow}
                      className="min-h-[44px] px-3 py-1.5 rounded-lg border border-[#D3D1CE] text-xs font-medium text-[#0F223A] hover:border-[#2F466F] inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Add Row</span>
                    </button>
                  </div>

                  {/* Mobile Editable Cards (< md) */}
                  <div className="space-y-3 md:hidden">
                    {importRows.map((row) => {
                      const pct = calculateAttendancePercent(row.attended, row.total);
                      return (
                        <div
                          key={row.localId}
                          className="rounded-xl border border-[#D3D1CE] bg-white p-3.5 space-y-3"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <label className="min-h-[44px] inline-flex items-center gap-2 text-xs font-medium text-[#0A0A0A] cursor-pointer">
                              <input
                                type="checkbox"
                                checked={row.include}
                                onChange={(e) =>
                                  updateImportRow(row.localId, { include: e.target.checked })
                                }
                                className="w-4 h-4 accent-[#0F223A]"
                              />
                              <span>
                                {row.matchedSubjectId ? `Updates ${row.code}` : 'Creates New Course'}
                              </span>
                            </label>
                            <button
                              type="button"
                              onClick={() =>
                                setImportRows((prev) => prev.filter((r) => r.localId !== row.localId))
                              }
                              aria-label="Remove row"
                              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-[#536878] hover:text-[#8B2626] cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" aria-hidden="true" />
                            </button>
                          </div>

                          <div className="grid grid-cols-3 gap-2">
                            <div>
                              <label className="block text-[11px] text-[#262E36] mb-1">Code</label>
                              <input
                                type="text"
                                value={row.code}
                                onChange={(e) => updateImportRow(row.localId, { code: e.target.value })}
                                className="w-full min-h-[44px] px-2.5 py-1.5 rounded-lg border border-[#D3D1CE] text-xs font-mono-tabular uppercase"
                              />
                            </div>
                            <div className="col-span-2">
                              <label className="block text-[11px] text-[#262E36] mb-1">Subject</label>
                              <input
                                type="text"
                                value={row.name}
                                onChange={(e) => updateImportRow(row.localId, { name: e.target.value })}
                                className="w-full min-h-[44px] px-2.5 py-1.5 rounded-lg border border-[#D3D1CE] text-xs"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-3 gap-2 items-end">
                            <div>
                              <label className="block text-[11px] text-[#262E36] mb-1">Attended (A)</label>
                              <input
                                type="number"
                                min={0}
                                value={row.attended}
                                onChange={(e) =>
                                  updateImportRow(row.localId, { attended: Number(e.target.value) })
                                }
                                className="w-full min-h-[44px] px-2.5 py-1.5 rounded-lg border border-[#D3D1CE] text-xs font-mono-tabular"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] text-[#262E36] mb-1">Total (T)</label>
                              <input
                                type="number"
                                min={0}
                                value={row.total}
                                onChange={(e) =>
                                  updateImportRow(row.localId, { total: Number(e.target.value) })
                                }
                                className="w-full min-h-[44px] px-2.5 py-1.5 rounded-lg border border-[#D3D1CE] text-xs font-mono-tabular"
                              />
                            </div>
                            <div className="pb-2 text-right font-mono-tabular text-xs font-semibold text-[#0F223A]">
                              {pct.toFixed(1)}%
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Desktop Editable Table (>= md) */}
                  <div className="hidden md:block overflow-x-auto rounded-xl border border-[#D3D1CE]">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-[#EDEAE6]/55 border-b border-[#D3D1CE] text-[11px] uppercase tracking-wider text-[#262E36]">
                          <th className="py-2.5 px-3 font-medium">Sync</th>
                          <th className="py-2.5 px-3 font-medium">Code</th>
                          <th className="py-2.5 px-3 font-medium">Subject Name</th>
                          <th className="py-2.5 px-3 font-medium">Attended</th>
                          <th className="py-2.5 px-3 font-medium">Total</th>
                          <th className="py-2.5 px-3 font-medium">Rate</th>
                          <th className="py-2.5 px-3 font-medium">Action</th>
                          <th className="py-2.5 px-2 text-right font-medium">Remove</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#EDEAE6] text-xs">
                        {importRows.map((row) => {
                          const pct = calculateAttendancePercent(row.attended, row.total);
                          return (
                            <tr key={row.localId}>
                              <td className="py-2 px-3">
                                <input
                                  type="checkbox"
                                  checked={row.include}
                                  onChange={(e) =>
                                    updateImportRow(row.localId, { include: e.target.checked })
                                  }
                                  aria-label={`Include ${row.name || row.code}`}
                                  className="w-4 h-4 accent-[#0F223A] cursor-pointer"
                                />
                              </td>
                              <td className="py-2 px-3 w-24">
                                <input
                                  type="text"
                                  value={row.code}
                                  onChange={(e) =>
                                    updateImportRow(row.localId, { code: e.target.value })
                                  }
                                  aria-label="Course code"
                                  className="w-full min-h-[44px] px-2 py-1 rounded-lg border border-[#D3D1CE] font-mono-tabular uppercase"
                                />
                              </td>
                              <td className="py-2 px-3 min-w-[180px]">
                                <input
                                  type="text"
                                  value={row.name}
                                  onChange={(e) =>
                                    updateImportRow(row.localId, { name: e.target.value })
                                  }
                                  aria-label="Subject name"
                                  className="w-full min-h-[44px] px-2.5 py-1 rounded-lg border border-[#D3D1CE]"
                                />
                              </td>
                              <td className="py-2 px-3 w-20">
                                <input
                                  type="number"
                                  min={0}
                                  value={row.attended}
                                  onChange={(e) =>
                                    updateImportRow(row.localId, { attended: Number(e.target.value) })
                                  }
                                  aria-label="Attended count"
                                  className="w-full min-h-[44px] px-2 py-1 rounded-lg border border-[#D3D1CE] font-mono-tabular"
                                />
                              </td>
                              <td className="py-2 px-3 w-20">
                                <input
                                  type="number"
                                  min={0}
                                  value={row.total}
                                  onChange={(e) =>
                                    updateImportRow(row.localId, { total: Number(e.target.value) })
                                  }
                                  aria-label="Total count"
                                  className="w-full min-h-[44px] px-2 py-1 rounded-lg border border-[#D3D1CE] font-mono-tabular"
                                />
                              </td>
                              <td className="py-2 px-3 font-mono-tabular font-semibold text-[#0A0A0A] whitespace-nowrap">
                                {pct.toFixed(1)}%
                              </td>
                              <td className="py-2 px-3 whitespace-nowrap text-[#2F466F] font-medium">
                                {row.matchedSubjectId ? 'Updates' : 'Creates New'}
                              </td>
                              <td className="py-2 px-2 text-right">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setImportRows((prev) =>
                                      prev.filter((r) => r.localId !== row.localId),
                                    )
                                  }
                                  aria-label={`Remove ${row.code}`}
                                  className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg text-[#536878] hover:text-[#8B2626] cursor-pointer"
                                >
                                  <Trash2 className="w-4 h-4" aria-hidden="true" />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="pt-2 border-t border-[#EDEAE6] flex flex-wrap items-center justify-end gap-2">
                <button
                  type="button"
                  disabled={importSyncing}
                  onClick={() => setImportModalOpen(false)}
                  className="min-h-[44px] px-4 py-2 rounded-lg border border-[#D3D1CE] text-xs font-medium text-[#1C1C1C] hover:border-[#0F223A] cursor-pointer"
                >
                  Cancel
                </button>
                {importRows.length > 0 && (
                  <button
                    type="button"
                    disabled={importSyncing || importParsing}
                    onClick={handleConfirmSyncImports}
                    className="min-h-[44px] px-5 py-2 rounded-lg bg-[#0F223A] text-white text-xs font-medium hover:bg-[#2F466F] disabled:opacity-50 inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>{importSyncing ? 'Syncing...' : 'Confirm & Sync All'}</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Subject Confirmation Dialog */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-[#0A0A0A]/45 backdrop-blur-xs"
            onClick={() => setDeleteTarget(null)}
            aria-hidden="true"
          />
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-dialog-title"
            className="relative w-full max-w-[400px] bg-white border border-[#D3D1CE] rounded-xl p-6"
          >
            <h2 id="delete-dialog-title" className="font-display text-lg font-semibold text-[#0A0A0A]">
              Delete {deleteTarget.code}?
            </h2>
            <p className="mt-2 text-sm text-[#262E36] leading-relaxed">
              This will permanently remove <span className="font-medium text-[#0A0A0A]">{deleteTarget.name}</span> and its logged attendance records from your semester dashboard.
            </p>
            <div className="mt-6 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="min-h-[44px] px-4 py-2 rounded-lg border border-[#D3D1CE] text-xs font-medium text-[#1C1C1C] hover:border-[#0F223A] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteSubject}
                className="min-h-[44px] px-4 py-2 rounded-lg bg-[#8B2626] text-white text-xs font-medium hover:bg-[#701D1D] cursor-pointer"
              >
                Delete Subject
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Log Entry Confirmation Dialog */}
      {deleteLogTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-[#0A0A0A]/45 backdrop-blur-xs"
            onClick={() => setDeleteLogTarget(null)}
            aria-hidden="true"
          />
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-log-dialog-title"
            className="relative w-full max-w-[420px] bg-white border border-[#D3D1CE] rounded-xl p-6"
          >
            <h2 id="delete-log-dialog-title" className="font-display text-lg font-semibold text-[#0A0A0A]">
              Remove {deleteLogTarget.courseCode} Log Entry?
            </h2>
            <p className="mt-2 text-sm text-[#262E36] leading-relaxed">
              Deleting this <span className="font-semibold capitalize text-[#0A0A0A]">{deleteLogTarget.status}</span> log from{' '}
              <span className="font-mono-tabular text-[#0A0A0A]">{deleteLogTarget.dateISO}</span>{' '}
              {deleteLogTarget.status === 'present'
                ? 'will revert A by -1 and T by -1 on the subject.'
                : deleteLogTarget.status === 'absent'
                  ? 'will revert T by -1 on the subject.'
                  : 'will remove the entry without altering course percentages.'}
            </p>
            <div className="mt-6 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteLogTarget(null)}
                className="min-h-[44px] px-4 py-2 rounded-lg border border-[#D3D1CE] text-xs font-medium text-[#1C1C1C] hover:border-[#0F223A] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteLog}
                className="min-h-[44px] px-4 py-2 rounded-lg bg-[#8B2626] text-white text-xs font-medium hover:bg-[#701D1D] cursor-pointer"
              >
                Delete Log Entry
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
