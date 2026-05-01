"use client";

import { Plus } from "lucide-react";
import { useCases } from "@/providers/cases-provider";
import { cn } from "@/lib/utils";

export function TopBar() {
  const { cases, activeCaseId, setActiveCaseId, createCase } = useCases();

  return (
    <header className="flex shrink-0 items-center gap-4 border-b border-neutral-200 bg-white px-6 py-4">
      <label className="min-w-0 flex-1">
        <span className="mb-1 block text-xs font-medium text-neutral-500">
          Active case
        </span>
        <div className="relative">
          <select
            className={cn(
              "w-full appearance-none rounded-xl border border-neutral-200 bg-neutral-50",
              "py-2.5 pl-3 pr-10 text-sm font-medium text-neutral-900",
              "outline-none ring-brand focus:ring-2",
            )}
            value={activeCaseId ?? ""}
            onChange={(e) => setActiveCaseId(e.target.value)}
          >
            {cases.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400">
            ▾
          </span>
        </div>
      </label>

      <button
        type="button"
        onClick={createCase}
        className={cn(
          "inline-flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5",
          "bg-brand text-sm font-semibold text-brand-foreground shadow-sm",
          "transition hover:opacity-95 active:opacity-90",
        )}
      >
        <Plus className="h-4 w-4" strokeWidth={2.5} />
        New case
      </button>
    </header>
  );
}
