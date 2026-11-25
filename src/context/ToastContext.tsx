import React, { createContext, useCallback, useContext, useState } from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';

export type ToastVariant = 'success' | 'error' | 'info';

interface ToastMessage {
  id: string;
  message: string;
  variant: ToastVariant;
}

interface ToastContextValue {
  showToast: (message: string, variant?: ToastVariant) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string, variant: ToastVariant = 'success') => {
      const id = `toast_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      setToasts((prev) => [...prev.slice(-3), { id, message, variant }]);
      window.setTimeout(() => {
        dismiss(id);
      }, 3600);
    },
    [dismiss],
  );

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="fixed bottom-20 lg:bottom-6 right-4 z-50 flex flex-col gap-2 max-w-[calc(100vw-2rem)] sm:max-w-[380px] pointer-events-none"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role="status"
            className="pointer-events-auto bg-white border border-[#D3D1CE] rounded-xl px-4 py-3 flex items-start justify-between gap-3 shadow-sm"
          >
            <div className="flex items-start gap-2.5 min-w-0">
              {toast.variant === 'success' && (
                <CheckCircle2 className="w-4 h-4 text-[#1F5E3B] shrink-0 mt-0.5" aria-hidden="true" />
              )}
              {toast.variant === 'error' && (
                <AlertCircle className="w-4 h-4 text-[#8B2626] shrink-0 mt-0.5" aria-hidden="true" />
              )}
              {toast.variant === 'info' && (
                <Info className="w-4 h-4 text-[#2F466F] shrink-0 mt-0.5" aria-hidden="true" />
              )}
              <p className="text-xs sm:text-[13px] font-medium text-[#0A0A0A] leading-snug">
                {toast.message}
              </p>
            </div>
            <button
              type="button"
              onClick={() => dismiss(toast.id)}
              aria-label="Dismiss notification"
              className="min-h-[44px] min-w-[44px] -mr-2 -my-2 flex items-center justify-center rounded-lg text-[#536878] hover:text-[#0A0A0A] shrink-0 cursor-pointer"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return ctx;
}
