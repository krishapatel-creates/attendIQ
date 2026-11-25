import React from 'react';
import { BrandLogo } from './BrandLogo';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    const raw = error instanceof Error ? error.message : String(error);
    let friendly = 'An unexpected error occurred while syncing academic data.';
    try {
      const parsed = JSON.parse(raw) as { error?: string; operationType?: string; path?: string };
      if (parsed && parsed.error) {
        friendly = `${parsed.error}${parsed.path ? ` (${parsed.operationType} on ${parsed.path})` : ''}`;
      }
    } catch {
      if (raw) friendly = raw;
    }
    return { hasError: true, message: friendly };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#EDEAE6] flex items-center justify-center p-6">
          <div className="w-full max-w-[460px] bg-white border border-[#D3D1CE] rounded-xl p-6 sm:p-8">
            <BrandLogo variant="dark" />
            <h1 className="mt-5 font-display text-xl font-semibold text-[#0A0A0A]">
              Unable to load workspace
            </h1>
            <p className="mt-2 text-sm text-[#262E36] leading-relaxed">{this.state.message}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-6 min-h-[44px] px-5 py-2.5 rounded-lg bg-[#0F223A] text-white text-sm font-medium hover:bg-[#2F466F] transition-colors cursor-pointer"
            >
              Reload AttendIQ
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
