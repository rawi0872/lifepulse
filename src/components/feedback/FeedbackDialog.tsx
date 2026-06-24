"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { usePathname } from "next/navigation";

const CATEGORIES = [
  { value: "bug", label: "Bug report" },
  { value: "confusing", label: "Confusing" },
  { value: "idea", label: "Feature idea" },
  { value: "praise", label: "Praise" },
  { value: "other", label: "Other" },
] as const;

type FeedbackCategory = (typeof CATEGORIES)[number]["value"];

export function FeedbackDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [category, setCategory] = useState<FeedbackCategory | "">("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const pathname = usePathname();
  const { toast } = useToast();
  const supabase = createClient();

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!message.trim()) {
      toast({ type: "error", title: "Please write a message." });
      return;
    }

    setSending(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({ type: "error", title: "Please sign in to send feedback." });
        setSending(false);
        return;
      }

      const browserInfo = [
        navigator.userAgent,
        `screen: ${window.screen.width}x${window.screen.height}`,
        `viewport: ${window.innerWidth}x${window.innerHeight}`,
      ].join(" | ");

      const { error } = await supabase.from("beta_feedback").insert({
        user_id: user.id,
        page_path: pathname,
        rating: rating > 0 ? rating : null,
        category: category || null,
        message: message.trim(),
        browser_info: browserInfo,
      });

      if (error) {
        console.error("Feedback submit error:", error);
        toast({ type: "error", title: "Could not send feedback. Please try again." });
        setSending(false);
        return;
      }

      toast({ type: "success", title: "Feedback sent. Thank you!" });
      setSending(false);
      onClose();
    } catch (err) {
      console.error("Feedback submit error:", err);
      toast({ type: "error", title: "Could not send feedback. Please try again." });
      setSending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md rounded-t-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-6 shadow-2xl sm:rounded-2xl animate-slide-up">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-[var(--text)]">Send feedback</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface)] transition-colors"
            aria-label="Close"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div>
            <label className="text-sm font-medium text-[var(--text-muted)]">Rating</label>
            <div className="mt-1.5 flex gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  className="p-0.5 transition-transform hover:scale-110"
                  aria-label={`Rate ${star} of 5`}
                >
                  <svg
                    className={`h-6 w-6 ${
                      star <= (hoverRating || rating)
                        ? "text-[var(--accent)]"
                        : "text-[var(--border-strong)]"
                    } transition-colors`}
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                  </svg>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label htmlFor="feedback-category" className="text-sm font-medium text-[var(--text-muted)]">
              Category
            </label>
            <select
              id="feedback-category"
              value={category}
              onChange={(e) => setCategory(e.target.value as FeedbackCategory | "")}
              className="mt-1.5 w-full rounded-lg border border-[var(--border-strong)] bg-[var(--surface-soft)] px-3 py-2.5 text-sm text-[var(--text)] transition-all duration-150 focus:border-[var(--accent)]/50 focus:ring-2 focus:ring-[var(--accent-soft)] focus:outline-none"
            >
              <option value="">Select a category</option>
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="feedback-message" className="text-sm font-medium text-[var(--text-muted)]">
              Message <span className="text-[var(--danger)]">*</span>
            </label>
            <textarea
              id="feedback-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              required
              rows={4}
              placeholder="What felt confusing, broken, useful, or missing?"
              className="mt-1.5 w-full rounded-lg border border-[var(--border-strong)] bg-[var(--surface-soft)] px-3 py-2.5 text-sm text-[var(--text)] placeholder-[var(--text-muted)] transition-all duration-150 focus:border-[var(--accent)]/50 focus:ring-2 focus:ring-[var(--accent-soft)] focus:outline-none resize-none"
            />
          </div>

          <div className="flex items-center gap-2 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm font-medium text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface)] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={sending || !message.trim()}
              className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white transition-all hover:bg-[var(--accent)] disabled:opacity-50"
            >
              {sending ? "Sending..." : "Send feedback"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
