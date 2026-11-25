import React from 'react';
import { Download } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { useAcademic } from '../context/AcademicContext';

export function ReportsPage() {
  const { monthlyReports, subjects, generateMonthlyReportSnapshot } = useAcademic();

  const handleExportCsv = () => {
    const header = 'Course Code,Subject Name,Attended,Total,Percentage\n';
    const rows = subjects
      .map((s) => {
        const pct = ((s.attendedClasses / Math.max(1, s.totalClasses)) * 100).toFixed(1);
        return `${s.code},"${s.name}",${s.attendedClasses},${s.totalClasses},${pct}%`;
      })
      .join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'attendiq-semester-report.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <PageHeader
        title="Monthly Reports"
        subtitle="Structured monthly attendance transcripts and CSV export"
        action={
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void generateMonthlyReportSnapshot()}
              className="min-h-[44px] px-4 py-2 rounded-lg border border-[#2F466F] bg-white text-[#0F223A] text-xs font-medium hover:bg-[#EDEAE6]/50 transition-colors cursor-pointer"
            >
              Save Snapshot
            </button>
            <button
              type="button"
              onClick={handleExportCsv}
              className="min-h-[44px] px-4 py-2 rounded-lg bg-[#0F223A] text-white text-xs font-medium hover:bg-[#2F466F] transition-colors inline-flex items-center gap-2 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Export CSV</span>
            </button>
          </div>
        }
      />

      <div className="luxury-card rounded-xl divide-y divide-[#EDEAE6]">
        {monthlyReports.length === 0 ? (
          <div className="p-10 text-center text-sm text-[#262E36]">
            No monthly snapshots saved yet. Click Save Snapshot to capture your current standing.
          </div>
        ) : (
          monthlyReports.map((rep) => (
            <div
              key={rep.id}
              className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            >
              <div>
                <p className="text-xs text-[#536878]">{rep.statusLabel}</p>
                <h2 className="mt-0.5 font-display text-base font-semibold text-[#0A0A0A]">
                  {rep.monthLabel}
                </h2>
                <p className="mt-0.5 text-xs text-[#262E36] tabular-nums">
                  {rep.classesAttended} of {rep.classesHeld} sessions · Top course: {rep.topSubject}
                </p>
              </div>
              <span className="font-mono-tabular text-2xl font-semibold text-[#0F223A]">
                {rep.attendanceRate.toFixed(1)}%
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export function AchievementsPage() {
  const { achievements } = useAcademic();

  return (
    <div>
      <PageHeader
        title="Achievements"
        subtitle="Consistency streaks and academic attendance milestones"
      />

      {achievements.length === 0 ? (
        <div className="luxury-card rounded-xl p-10 text-center text-sm text-[#262E36]">
          No achievements recorded yet. Log attendance sessions to unlock semester milestones.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {achievements.map((item) => {
            const pct = Math.min(100, Math.round((item.progressCurrent / item.progressTarget) * 100));
            return (
              <div key={item.id} className="luxury-card rounded-xl p-5 sm:p-6">
                <div className="flex items-center justify-between text-xs text-[#536878]">
                  <span className={item.earned ? 'font-semibold text-[#1F5E3B]' : 'text-[#262E36]'}>
                    {item.earned ? `Earned · ${item.earnedDate ?? 'Completed'}` : 'In Progress'}
                  </span>
                  <span className="font-mono-tabular">
                    {item.progressCurrent} / {item.progressTarget}
                  </span>
                </div>
                <h2 className="mt-1.5 font-display text-base font-semibold text-[#0A0A0A]">
                  {item.title}
                </h2>
                <p className="mt-1 text-xs text-[#262E36]">{item.criteria}</p>
                <div className="mt-4 h-2 rounded-full bg-[#EDEAE6] overflow-hidden">
                  <div className="h-full bg-[#2F466F]" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
