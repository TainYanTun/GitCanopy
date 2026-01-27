import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

export type ToastType = 'info' | 'success' | 'error' | 'warning';

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType, duration?: number) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback((message: string, type: ToastType = 'info', duration = 3000) => {
    const id = Math.random().toString(36).substring(2, 9);
    const newToast: Toast = { id, message, type, duration };

    setToasts((prev) => [...prev, newToast]);

    if (duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }
  }, [removeToast]);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed top-12 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`
              pointer-events-auto
              flex items-start gap-3 px-3 py-2.5 rounded border
              border-zed-border dark:border-zed-dark-border
              bg-zed-surface/95 dark:bg-zed-dark-surface/95
              text-zed-text dark:text-zed-dark-text
              backdrop-blur-md shadow-2xl
              animate-slide-in-right transition-all duration-300
              min-w-[240px] max-w-sm select-text
            `}
          >
            <div className={`
              flex-shrink-0 w-1.5 h-1.5 rounded-full mt-1.5
              ${toast.type === 'success' ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]' : ''}
              ${toast.type === 'error' ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.4)]' : ''}
              ${toast.type === 'warning' ? 'bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.4)]' : ''}
              ${toast.type === 'info' ? 'bg-zed-accent dark:bg-zed-dark-accent shadow-[0_0_8px_rgba(59,130,246,0.4)]' : ''}
            `} />
            <div className="flex-1 flex flex-col gap-2 min-w-0">
              <span className="text-[11px] font-bold uppercase tracking-wider break-words leading-relaxed">{toast.message}</span>
              {toast.type === 'error' && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    window.gitcanopyAPI.copyToClipboard(toast.message);
                    showToast('Error copied to clipboard', 'success', 1500);
                  }}
                  className="w-fit text-[9px] font-black uppercase tracking-[0.1em] text-zed-muted dark:text-zed-dark-muted hover:text-zed-accent dark:hover:text-zed-dark-accent transition-colors flex items-center gap-1 bg-zed-element/50 dark:bg-zed-dark-element/50 px-1.5 py-0.5 rounded"
                >
                  <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                  </svg>
                  Copy Error
                </button>
              )}
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className="ml-1 text-zed-muted dark:text-zed-dark-muted hover:text-zed-text dark:hover:text-white transition-colors pt-0.5"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (context === undefined) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};
