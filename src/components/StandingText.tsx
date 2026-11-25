import { AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import type { SubjectStanding } from '../types/academic';

interface StandingTextProps {
  standing: SubjectStanding;
  compact?: boolean;
}

export function StandingText({ standing, compact = false }: StandingTextProps) {
  if (standing === 'on_track') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#1F5E3B] whitespace-nowrap shrink-0">
        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
        <span>{compact ? 'Nominal' : 'On Track'}</span>
      </span>
    );
  }

  if (standing === 'watch') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#8C5A12] whitespace-nowrap shrink-0">
        <Info className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
        <span>{compact ? 'Watch' : 'Borderline'}</span>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#8B2626] whitespace-nowrap shrink-0">
      <AlertTriangle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
      <span>At Risk</span>
    </span>
  );
}
