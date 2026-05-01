"use client";

import { Paperclip, Send } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  disabled?: boolean;
};

export function ChatComposer({ value, onChange, onSend, disabled }: Props) {
  return (
    <div className="border-t border-neutral-200 bg-white px-6 py-4">
      <div
        className={cn(
          "mx-auto flex max-w-4xl items-end gap-2 rounded-2xl border border-neutral-200",
          "bg-neutral-50 px-2 py-2 shadow-sm",
        )}
      >
        <button
          type="button"
          className="mb-1.5 rounded-lg p-2 text-neutral-500 transition hover:bg-white hover:text-neutral-800"
          aria-label="Attach file"
        >
          <Paperclip className="h-5 w-5" strokeWidth={2} />
        </button>
        <textarea
          rows={1}
          placeholder="Type your message…"
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              if (!disabled && value.trim()) onSend();
            }
          }}
          className={cn(
            "max-h-40 min-h-[44px] flex-1 resize-none bg-transparent px-2 py-2.5 text-sm",
            "outline-none placeholder:text-neutral-400",
            disabled && "opacity-60",
          )}
        />
        <button
          type="button"
          disabled={disabled || !value.trim()}
          onClick={onSend}
          className={cn(
            "mb-1.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
            "bg-brand text-brand-foreground shadow-sm transition",
            "hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-40",
          )}
          aria-label="Send message"
        >
          <Send className="h-4 w-4" strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}
