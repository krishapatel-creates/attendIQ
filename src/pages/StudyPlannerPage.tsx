import React, { useMemo, useState } from 'react';
import { AlertCircle, Check, Clock, Link2, Minus, Plus, Sparkles, Trash2 } from 'lucide-react';
import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import { PageHeader } from '../components/PageHeader';
import { useAcademic } from '../context/AcademicContext';
import { useToast } from '../context/ToastContext';
import { buildAcademicSnapshot } from '../utils/academicSnapshot';

interface GeneratedScheduleTask {
  title: string;
  courseCode: string;
  dueLabel: string;
  estimatedMinutes: number;
  linkedExamId?: string;
  linkedExamLabel?: string;
  rationale?: string;
}

export function StudyPlannerPage() {
  const {
    student,
    overallStats,
    subjects,
    exams,
    marks,
    studyTasks,
    weeklyTimetable,
    toggleStudyTask,
    addStudyTask,
    deleteStudyTask,
    updateDailyStudyGoal,
  } = useAcademic();
  const { showToast } = useToast();

  const [isGeneratingSchedule, setIsGeneratingSchedule] = useState(false);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  const [filter, setFilter] = useState<'all' | 'pending' | 'completed'>('all');
  const [title, setTitle] = useState('');
  const [courseCode, setCourseCode] = useState(subjects[0]?.code ?? 'MATH-101');
  const [linkedExamId, setLinkedExamId] = useState<string>('');
  const [dueLabel, setDueLabel] = useState('Tomorrow');
  const [estimatedMinutes, setEstimatedMinutes] = useState(45);

  const activeCourseCode = useMemo(() => {
    if (subjects.some((s) => s.code === courseCode)) return courseCode;
    return subjects[0]?.code ?? courseCode;
  }, [subjects, courseCode]);

  const dailyGoalHours = student.dailyStudyGoalHours ?? 3;
  const dailyGoalMinutes = Math.round(dailyGoalHours * 60);

  const stats = useMemo(() => {
    const completedTasks = studyTasks.filter((t) => t.completed);
    const pendingTasks = studyTasks.filter((t) => !t.completed);
    const completedMinutes = completedTasks.reduce((sum, t) => sum + t.estimatedMinutes, 0);
    const pendingMinutes = pendingTasks.reduce((sum, t) => sum + t.estimatedMinutes, 0);
    const totalMinutes = completedMinutes + pendingMinutes;
    const goalProgressPct = Math.min(
      100,
      Math.round((completedMinutes / Math.max(1, dailyGoalMinutes)) * 100),
    );
    return {
      completedCount: completedTasks.length,
      pendingCount: pendingTasks.length,
      completedMinutes,
      pendingMinutes,
      totalMinutes,
      goalProgressPct,
    };
  }, [studyTasks, dailyGoalMinutes]);

  const filteredTasks = useMemo(() => {
    if (filter === 'pending') return studyTasks.filter((t) => !t.completed);
    if (filter === 'completed') return studyTasks.filter((t) => t.completed);
    return studyTasks;
  }, [studyTasks, filter]);

  const handleLinkedExamChange = (examId: string) => {
    setLinkedExamId(examId);
    const matchedExam = exams.find((ex) => ex.id === examId);
    if (matchedExam) {
      setCourseCode(matchedExam.courseCode);
      setDueLabel(matchedExam.displayDate);
    }
  };

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    const matchedExam = exams.find((ex) => ex.id === linkedExamId);

    await addStudyTask({
      title: title.trim(),
      courseCode: activeCourseCode,
      dueLabel: dueLabel.trim() || 'This Week',
      estimatedMinutes: Number(estimatedMinutes) || 45,
      linkedExamId: matchedExam?.id,
      linkedExamLabel: matchedExam ? `${matchedExam.courseCode} · ${matchedExam.examTitle}` : undefined,
    });
    setTitle('');
    setLinkedExamId('');
  };

  const handleGenerateAiSchedule = async () => {
    if (isGeneratingSchedule) return;
    setIsGeneratingSchedule(true);
    setAiError(null);
    try {
      const snapshot = buildAcademicSnapshot({
        student,
        overallStats,
        subjects,
        exams,
        marks,
        studyTasks,
        weeklyTimetable,
      });

      const response = await fetch('/api/ai/study-schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ snapshot }),
      });

      const payload = (await response.json()) as {
        summary?: string;
        tasks?: GeneratedScheduleTask[];
        error?: string;
      };

      if (!response.ok || !Array.isArray(payload.tasks) || payload.tasks.length === 0) {
        throw new Error(payload.error || 'Could not generate AI study schedule.');
      }

      for (const task of payload.tasks) {
        await addStudyTask({
          title: task.title,
          courseCode: task.courseCode,
          dueLabel: task.dueLabel,
          estimatedMinutes: task.estimatedMinutes,
          linkedExamId: task.linkedExamId,
          linkedExamLabel: task.linkedExamLabel,
        });
      }

      setAiSummary(payload.summary ?? 'Added prioritized study blocks to your planner.');
      showToast(`Added ${payload.tasks.length} AI-prioritized study tasks`, 'success');
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'Failed to generate AI study schedule.');
    } finally {
      setIsGeneratingSchedule(false);
    }
  };

  return (
    <MotionConfig reducedMotion="user">
      <div className="space-y-6">
        <PageHeader
          title="Study Planner"
          subtitle={`${stats.completedCount} of ${studyTasks.length} revision blocks completed · Linked to your exam roadmap`}
          action={
            <button
              type="button"
              disabled={isGeneratingSchedule || subjects.length === 0}
              onClick={() => void handleGenerateAiSchedule()}
              className="min-h-[44px] px-4 py-2 rounded-lg bg-[#0F223A] text-white text-xs font-medium hover:bg-[#2F466F] disabled:opacity-50 transition-colors inline-flex items-center gap-2 whitespace-nowrap cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
              <span>
                {isGeneratingSchedule ? 'Generating Schedule...' : 'Generate AI Study Schedule'}
              </span>
            </button>
          }
        />

        {aiError && (
          <div
            role="alert"
            className="luxury-card rounded-xl p-4 bg-[#FDF2F2] border-[#8B2626]/30 flex items-center justify-between gap-3 text-xs text-[#8B2626]"
          >
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>{aiError}</span>
            </div>
            <button
              type="button"
              onClick={() => setAiError(null)}
              className="min-h-[44px] px-2 inline-flex items-center font-semibold underline shrink-0 cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {aiSummary && (
          <div className="luxury-card rounded-xl px-5 py-3.5 flex items-start gap-2.5 text-xs text-[#0F223A]">
            <Sparkles className="w-4 h-4 mt-0.5 text-[#2F466F] shrink-0" aria-hidden="true" />
            <div>
              <span className="font-semibold">AI Schedule Added: </span>
              <span className="text-[#262E36]">{aiSummary}</span>
            </div>
          </div>
        )}

        {/* Daily Study Goal & Progress Card */}
        <section className="luxury-card rounded-xl p-5 sm:p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <p className="text-xs font-medium text-[#536878] uppercase tracking-wider">
                Daily Study Hour Target
              </p>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="font-display text-2xl sm:text-3xl font-semibold text-[#0A0A0A] tabular-nums">
                  {(stats.completedMinutes / 60).toFixed(1)}h
                </span>
                <span className="text-sm text-[#262E36] tabular-nums">
                  completed of {dailyGoalHours.toFixed(1)}h daily goal ({stats.pendingMinutes} min pending)
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs font-medium text-[#262E36] mr-1">Goal:</span>
              <button
                type="button"
                onClick={() => void updateDailyStudyGoal(Math.max(0.5, dailyGoalHours - 0.5))}
                aria-label="Decrease daily study hour goal"
                className="min-h-[44px] min-w-[44px] rounded-lg border border-[#D3D1CE] bg-white flex items-center justify-center text-[#0F223A] hover:border-[#2F466F] cursor-pointer"
              >
                <Minus className="w-4 h-4" aria-hidden="true" />
              </button>
              <span className="min-w-[64px] text-center font-mono-tabular text-sm font-semibold text-[#0F223A]">
                {dailyGoalHours.toFixed(1)} hrs
              </span>
              <button
                type="button"
                onClick={() => void updateDailyStudyGoal(Math.min(12, dailyGoalHours + 0.5))}
                aria-label="Increase daily study hour goal"
                className="min-h-[44px] min-w-[44px] rounded-lg border border-[#D3D1CE] bg-white flex items-center justify-center text-[#0F223A] hover:border-[#2F466F] cursor-pointer"
              >
                <Plus className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
          </div>

          <div className="mt-4 h-2.5 w-full rounded-full bg-[#EDEAE6] overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-[#2F466F]"
              initial={{ width: 0 }}
              animate={{ width: `${stats.goalProgressPct}%` }}
              transition={{ duration: 0.35, ease: 'easeOut' }}
            />
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-[#262E36] tabular-nums">
            <span>{stats.goalProgressPct}% of daily goal achieved</span>
            <span>{stats.totalMinutes} total planned minutes</span>
          </div>
        </section>

        {/* Create Study Task Form */}
        <form
          onSubmit={(e) => void handleAddTask(e)}
          className="luxury-card rounded-xl p-5 sm:p-6 space-y-4"
        >
          <h2 className="font-display text-base font-semibold text-[#1C1C1C]">
            Schedule Study Block
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
            <div className="md:col-span-5">
              <label htmlFor="sp-title" className="block text-xs font-medium text-[#1C1C1C] mb-1.5">
                Task Description
              </label>
              <input
                id="sp-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Solve past paper concurrency deadlock problems"
                className="w-full min-h-[44px] px-3.5 py-2 rounded-lg border border-[#D3D1CE] text-sm text-[#0A0A0A] focus:outline-none focus:border-[#2F466F]"
              />
            </div>

            <div className="md:col-span-2">
              <label htmlFor="sp-course" className="block text-xs font-medium text-[#1C1C1C] mb-1.5">
                Subject
              </label>
              <select
                id="sp-course"
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

            <div className="md:col-span-3">
              <label htmlFor="sp-exam" className="block text-xs font-medium text-[#1C1C1C] mb-1.5">
                Link Exam / Deadline
              </label>
              <select
                id="sp-exam"
                value={linkedExamId}
                onChange={(e) => handleLinkedExamChange(e.target.value)}
                className="w-full min-h-[44px] px-3 rounded-lg border border-[#D3D1CE] bg-white text-sm"
              >
                <option value="">General Revision (Unlinked)</option>
                {exams.map((ex) => (
                  <option key={ex.id} value={ex.id}>
                    {ex.courseCode} · {ex.examTitle} ({ex.displayDate})
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2">
              <label htmlFor="sp-mins" className="block text-xs font-medium text-[#1C1C1C] mb-1.5">
                Duration
              </label>
              <select
                id="sp-mins"
                value={estimatedMinutes}
                onChange={(e) => setEstimatedMinutes(Number(e.target.value))}
                className="w-full min-h-[44px] px-3 rounded-lg border border-[#D3D1CE] bg-white text-sm font-mono-tabular"
              >
                <option value={25}>25 min</option>
                <option value={45}>45 min</option>
                <option value={60}>60 min</option>
                <option value={90}>90 min</option>
                <option value={120}>120 min</option>
              </select>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
            <div className="flex items-center gap-2">
              <label htmlFor="sp-due" className="text-xs font-medium text-[#1C1C1C] whitespace-nowrap">
                Target Due:
              </label>
              <input
                id="sp-due"
                type="text"
                value={dueLabel}
                onChange={(e) => setDueLabel(e.target.value)}
                placeholder="Today, 19:00"
                className="min-h-[44px] px-3 rounded-lg border border-[#D3D1CE] text-xs text-[#0A0A0A] w-full sm:w-[180px]"
              />
            </div>

            <button
              type="submit"
              disabled={!title.trim()}
              className="min-h-[44px] px-5 py-2 rounded-lg bg-[#0F223A] text-white text-sm font-medium hover:bg-[#2F466F] disabled:opacity-50 transition-colors inline-flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer"
            >
              <Plus className="w-4 h-4" aria-hidden="true" />
              <span>Add Study Task</span>
            </button>
          </div>
        </form>

        {/* Filter Bar + Animated Task List */}
        <section className="luxury-card rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-[#EDEAE6] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h2 className="font-display text-base font-semibold text-[#1C1C1C]">
              Revision Checklist
            </h2>

            <div className="w-full sm:w-auto grid grid-cols-3 sm:flex items-center gap-1 p-1 rounded-lg bg-[#EDEAE6]/60 border border-[#D3D1CE]">
              {(
                [
                  { id: 'all', label: `All (${studyTasks.length})` },
                  { id: 'pending', label: `Pending (${stats.pendingCount})` },
                  { id: 'completed', label: `Done (${stats.completedCount})` },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFilter(tab.id)}
                  className={`min-h-[44px] sm:min-h-[36px] px-2 sm:px-3 py-1 rounded-md text-[11px] sm:text-xs font-medium transition-colors whitespace-nowrap truncate cursor-pointer ${
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

          {filteredTasks.length === 0 ? (
            <div className="p-10 text-center text-sm text-[#262E36]">
              {filter === 'pending'
                ? 'All scheduled study blocks are complete.'
                : 'No study tasks in this view.'}
            </div>
          ) : (
            <div className="divide-y divide-[#EDEAE6]">
              <AnimatePresence initial={false}>
                {filteredTasks.map((task) => (
                  <motion.div
                    key={task.id}
                    layout
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="p-4 sm:px-6 flex items-center justify-between gap-4 hover:bg-[#EDEAE6]/30 transition-colors"
                  >
                    <button
                      type="button"
                      onClick={() => void toggleStudyTask(task.id)}
                      className="min-h-[44px] flex items-start sm:items-center gap-3.5 min-w-0 flex-1 text-left cursor-pointer"
                    >
                      <motion.span
                        animate={{
                          backgroundColor: task.completed ? '#2F466F' : '#FFFFFF',
                          borderColor: task.completed ? '#2F466F' : '#536878',
                          scale: task.completed ? [1, 1.12, 1] : 1,
                        }}
                        transition={{ duration: 0.18 }}
                        className="mt-0.5 sm:mt-0 w-5 h-5 rounded border flex items-center justify-center shrink-0 text-white"
                      >
                        {task.completed && <Check className="w-3.5 h-3.5" aria-hidden="true" />}
                      </motion.span>

                      <div className="min-w-0">
                        <p
                          className={`text-sm font-medium transition-all duration-200 ${
                            task.completed ? 'line-through text-[#536878]' : 'text-[#0A0A0A]'
                          }`}
                        >
                          {task.title}
                        </p>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[#262E36] tabular-nums">
                          <span className="font-mono-tabular font-semibold text-[#0F223A]">
                            {task.courseCode}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>Due {task.dueLabel}</span>
                          <span aria-hidden="true">·</span>
                          <span className="inline-flex items-center gap-1">
                            <Clock className="w-3 h-3 text-[#536878]" aria-hidden="true" />
                            {task.estimatedMinutes} min
                          </span>
                          {task.linkedExamLabel && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="inline-flex items-center gap-1 text-[#2F466F]">
                                <Link2 className="w-3 h-3" aria-hidden="true" />
                                {task.linkedExamLabel}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => void deleteStudyTask(task.id)}
                      aria-label={`Delete ${task.title}`}
                      className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-[#536878] hover:text-[#8B2626] hover:bg-[#FDF2F2] shrink-0 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" aria-hidden="true" />
                    </button>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </section>
      </div>
    </MotionConfig>
  );
}
