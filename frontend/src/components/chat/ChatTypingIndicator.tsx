"use client";

export function ChatTypingIndicator() {
  return (
    <div
      className="flex justify-start"
      role="status"
      aria-live="polite"
      aria-label="Assistant is replying"
    >
      <div className="inline-flex items-center gap-1.5 rounded-2xl border border-neutral-200/90 bg-white px-4 py-3 shadow-sm">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="inline-block h-2 w-2 rounded-full bg-brand/70 animate-chat-dot"
            style={{ animationDelay: `${i * 160}ms` }}
          />
        ))}
      </div>
    </div>
  );
}
