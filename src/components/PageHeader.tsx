import React from 'react';

interface PageHeaderProps {
  title: string;
  subtitle: string;
  action?: React.ReactNode;
}

export function PageHeader({ title, subtitle, action }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between pb-5 mb-6 border-b border-[#D3D1CE]">
      <div className="min-w-0">
        <h1 className="font-display text-2xl sm:text-[28px] font-semibold tracking-tight text-[#0A0A0A] text-balance">
          {title}
        </h1>
        <p className="mt-1 text-sm text-[#262E36] leading-relaxed">{subtitle}</p>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
