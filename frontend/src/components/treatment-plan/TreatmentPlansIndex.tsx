"use client";

import Link from "next/link";
import { useMemo } from "react";
import { ArrowRight, Calendar, ClipboardList, Sparkles } from "lucide-react";
import { threadHasMedicalPlan } from "@/lib/thread-format";
import { useCases } from "@/providers/cases-provider";
import { cn } from "@/lib/utils";

function formatWhenShort(iso: string) {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

function casePlanHref(caseId: string) {
  return `/treatment-plan/${encodeURIComponent(caseId)}`;
}

export function TreatmentPlansIndex() {
  const { cases, threads } = useCases();

  const rows = useMemo(() => {
    const list = cases.map((c) => ({
      case: c,
      hasPlan: threadHasMedicalPlan(threads[c.id] ?? []),
    }));
    list.sort(
      (a, b) =>
        new Date(b.case.updatedAt).getTime() - new Date(a.case.updatedAt).getTime(),
    );
    return list;
  }, [cases, threads]);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-gradient-to-b from-brand-surface via-white to-neutral-50/90">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
        <header className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-muted text-brand shadow-sm">
              <ClipboardList className="h-6 w-6" strokeWidth={2} />
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-tight text-neutral-900 sm:text-2xl">
                Treatment plans
              </h1>
              <p className="mt-1 max-w-xl text-sm leading-relaxed text-neutral-600">
                Each card is a saved case on this device. Open a plan to see the latest medical
                guidance from chat, or start from{" "}
                <span className="font-medium text-brand">Open treatment plan</span> on a medical
                reply.
              </p>
            </div>
          </div>
        </header>

        {rows.length === 0 ? (
          <div className="rounded-3xl border-2 border-dashed border-neutral-200 bg-white/70 px-6 py-14 text-center shadow-sm">
            <Sparkles className="mx-auto h-10 w-10 text-neutral-300" strokeWidth={1.5} />
            <p className="mt-4 text-base font-medium text-neutral-800">No cases yet</p>
            <p className="mt-2 text-sm text-neutral-500">
              Use <strong className="text-neutral-700">Chat</strong> first; when you get a medical
              response, you can open its plan from there or return here.
            </p>
          </div>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2">
            {rows.map(({ case: c, hasPlan }) => (
              <li key={c.id}>
                <article
                  className={cn(
                    "flex h-full flex-col rounded-2xl border border-neutral-200/90 bg-white p-5 shadow-sm transition",
                    "hover:border-neutral-300 hover:shadow-md",
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-3 text-base font-semibold leading-snug text-neutral-900">
                      {c.label}
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-neutral-500">
                      <span className="inline-flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5 shrink-0 opacity-70" />
                        {formatWhenShort(c.updatedAt)}
                      </span>
                      <span
                        className={cn(
                          "rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                          hasPlan
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-neutral-100 text-neutral-500",
                        )}
                      >
                        {hasPlan ? "Plan saved" : "No plan yet"}
                      </span>
                    </div>
                    <p className="mt-3 truncate font-mono text-[10px] text-neutral-400" title={c.id}>
                      {c.id}
                    </p>
                  </div>
                  <div className="mt-5 border-t border-neutral-100 pt-4">
                    <Link
                      href={casePlanHref(c.id)}
                      className={cn(
                        "inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition",
                        hasPlan
                          ? "bg-brand text-brand-foreground shadow-sm hover:opacity-95"
                          : "border border-neutral-200 bg-neutral-50 text-neutral-800 hover:bg-neutral-100",
                      )}
                    >
                      {hasPlan ? "Open treatment plan" : "View case"}
                      <ArrowRight className="h-4 w-4 shrink-0" strokeWidth={2} />
                    </Link>
                  </div>
                </article>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
