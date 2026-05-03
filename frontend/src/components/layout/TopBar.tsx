"use client";

import { Plus } from "lucide-react";
import { useCases } from "@/providers/cases-provider";
import { cn } from "@/lib/utils";

const controlHeight = "min-h-[44px]";

export function TopBar() {
  const { cases, activeCaseId, setActiveCaseId, createCase } = useCases();

  return (
    <header className="flex shrink-0 flex-col gap-2 border-b border-neutral-200 bg-white px-6 py-4">
      <p className="text-xs font-medium text-neutral-500">Active case</p>

      <div className="flex items-center gap-3 sm:gap-4">
        <div className="relative min-w-0 flex-1">
          <select
            className={cn(
              "w-full appearance-none rounded-xl border border-neutral-200 bg-neutral-50",
              "px-3 py-2.5 pr-10 text-sm font-medium text-neutral-900",
              controlHeight,
              "outline-none ring-brand focus:ring-2",
            )}
            value={activeCaseId ?? ""}
            onChange={(e) => setActiveCaseId(e.target.value)}
            disabled={cases.length === 0}
          >
            {cases.length === 0 ? (
              <option value="">No saved cases yet</option>
            ) : (
              cases.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))
            )}
          </select>
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400">
            ▾
          </span>
        </div>

        <button
          type="button"
          onClick={createCase}
          className={cn(
            "inline-flex shrink-0 items-center justify-center gap-2 rounded-xl px-4",
            controlHeight,
            "bg-brand text-sm font-semibold text-brand-foreground shadow-sm",
            "transition hover:opacity-95 active:opacity-90",
          )}
        >
          <Plus className="h-4 w-4 shrink-0" strokeWidth={2.5} />
          New case
        </button>
      </div>
    </header>
  );
}
