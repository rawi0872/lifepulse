"use client";

import { useState, useRef, useEffect } from "react";

interface ProjectItem {
  id: string;
  title: string;
}

interface ProjectPickerProps {
  projects: ProjectItem[];
  value: string;
  onChange: (value: string) => void;
  allowNone?: boolean;
}

export function ProjectPicker({ projects, value, onChange, allowNone = false }: ProjectPickerProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const selected = projects.find((p) => p.id === value);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex w-full items-center gap-2 rounded-lg border border-[var(--border-strong)] bg-[var(--surface-soft)] px-3 py-2 text-sm text-[var(--text)] transition-all duration-150 focus:border-[var(--accent)]/50 focus:ring-2 focus:ring-[var(--accent-soft)] focus:outline-none"
      >
        <span className="flex-1 text-left">
          {selected ? selected.title : <span className="text-[var(--text-muted)]">{allowNone ? "None" : "Select project"}</span>}
        </span>
        <svg
          className={`h-4 w-4 shrink-0 text-[var(--text-muted)] transition-transform ${open ? "rotate-180" : ""}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] shadow-xl" role="listbox">
          {allowNone && (
            <button
              type="button"
              role="option"
              aria-selected={value === ""}
              onClick={() => { onChange(""); setOpen(false); }}
              className={`flex w-full items-center gap-2 px-3 py-2.5 text-sm transition-colors ${
                value === "" ? "bg-[var(--accent-soft)] text-[var(--accent)]" : "text-[var(--text-muted)] hover:bg-[var(--surface-raised)]"
              }`}
            >
              <span className="flex-1 text-left">None</span>
            </button>
          )}
          {projects.length === 0 ? (
            <p className="px-3 py-2.5 text-xs text-[var(--text-muted)]">
              No projects yet. Create one in Projects.
            </p>
          ) : (
            projects.map((p) => (
              <button
                key={p.id}
                type="button"
                role="option"
                aria-selected={value === p.id}
                onClick={() => { onChange(p.id); setOpen(false); }}
                className={`flex w-full items-center gap-2 px-3 py-2.5 text-sm transition-colors ${
                  value === p.id ? "bg-[var(--accent-soft)] text-[var(--accent)]" : "text-[var(--text-secondary)] hover:bg-[var(--surface-raised)]"
                }`}
              >
                <span className="flex-1 text-left">{p.title}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
