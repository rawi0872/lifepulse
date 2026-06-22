"use client";

import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from "react";

export type ToastType = "success" | "error" | "info" | "warning";

export interface ToastItem {
  id: string;
  type: ToastType;
  title: string;
  description?: string;
}

interface ToastContextValue {
  toast: (t: Omit<ToastItem, "id">) => void;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

const darkStyles: Record<ToastType, { border: string; bg: string; icon: string; dot: string }> = {
  success: {
    border: "border-[var(--success)]/30",
    bg: "bg-[var(--success-soft)]",
    icon: "text-[var(--success)]",
    dot: "bg-[var(--success)]",
  },
  error: {
    border: "border-[var(--danger)]/30",
    bg: "bg-[var(--danger-soft)]",
    icon: "text-[var(--danger)]",
    dot: "bg-[var(--danger)]",
  },
  info: {
    border: "border-[var(--accent)]/30",
    bg: "bg-[var(--accent-soft)]",
    icon: "text-[var(--accent)]",
    dot: "bg-[var(--accent)]",
  },
  warning: {
    border: "border-[var(--warning)]/30",
    bg: "bg-[var(--warning-soft)]",
    icon: "text-[var(--warning)]",
    dot: "bg-[var(--warning)]",
  },
};

const icons: Record<ToastType, ReactNode> = {
  success: (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  error: (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
    </svg>
  ),
  info: (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
    </svg>
  ),
  warning: (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
    </svg>
  ),
};

function ToastCard({ item, onDismiss }: { item: ToastItem; onDismiss: () => void }) {
  const style = darkStyles[item.type];
  return (
    <div
      className={`flex items-start gap-3 rounded-xl border ${style.border} ${style.bg} px-4 py-3 shadow-lg shadow-black/30 backdrop-blur-sm animate-slide-up w-72 pointer-events-auto`}
      role="alert"
    >
      <span className={`shrink-0 mt-0.5 ${style.icon}`}>{icons[item.type]}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-[var(--text)]">{item.title}</p>
        {item.description && (
          <p className="text-xs text-[var(--text-secondary)] mt-0.5">{item.description}</p>
        )}
      </div>
      <button
        onClick={onDismiss}
        className="shrink-0 text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
        aria-label="Dismiss"
      >
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

let toastCounter = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) { clearTimeout(timer); timers.current.delete(id); }
  }, []);

  const toast = useCallback((t: Omit<ToastItem, "id">) => {
    const id = `t${++toastCounter}`;
    setToasts((prev) => [...prev.slice(-4), { ...t, id }]);
    timers.current.set(id, setTimeout(() => dismiss(id), 4000));
  }, [dismiss]);

  useEffect(() => {
    return () => { timers.current.forEach((t) => clearTimeout(t)); };
  }, []);

  return (
    <ToastContext.Provider value={{ toast, dismiss }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none" aria-live="polite">
        {toasts.map((item) => (
          <ToastCard key={item.id} item={item} onDismiss={() => dismiss(item.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}
