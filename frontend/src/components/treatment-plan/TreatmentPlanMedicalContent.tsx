"use client";

import Link from "next/link";
import { ArrowLeft, FileText, MessageCircle, Stethoscope } from "lucide-react";
import type { NormalizedChatResponse } from "@/lib/api/types";
import { cn } from "@/lib/utils";

function formatSectionTitle(key: string): string {
  const spaced = key.replace(/([A-Z])/g, " $1").trim();
  return spaced.replace(/\b\w/g, (c) => c.toUpperCase());
}

function PlanSections({ data }: { data: NormalizedChatResponse }) {
  const plan = data.treatmentPlan;
  if (!plan || typeof plan !== "object") {
    return (
      <p className="text-sm text-neutral-500">
        No structured treatment plan sections were returned for this reply.
      </p>
    );
  }

  const entries = Object.entries(plan) as [string, string[]][];
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {entries.map(([key, items]) => (
        <div
          key={key}
          className="rounded-xl border border-neutral-200/90 bg-white p-4 shadow-sm"
        >
          <h3 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-brand">
            <FileText className="h-3.5 w-3.5" strokeWidth={2} />
            {formatSectionTitle(key)}
          </h3>
          {items.length > 0 ? (
            <ol className="space-y-2.5 text-sm leading-relaxed text-neutral-800">
              {items.map((line, i) => (
                <li key={i} className="flex gap-2">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-muted text-[11px] font-bold text-brand">
                    {i + 1}
                  </span>
                  <span>{line}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-neutral-400">—</p>
          )}
        </div>
      ))}
    </div>
  );
}

export function MedicalPlanDetail({
  caseLabel,
  caseId,
  data,
}: {
  caseLabel: string;
  caseId: string;
  data: NormalizedChatResponse;
}) {
  const urgent = String(data.severity ?? "").toLowerCase() === "urgent";

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-neutral-50/80">
      <header className="shrink-0 border-b border-neutral-200/90 bg-white px-4 py-5 shadow-sm sm:px-8 sm:py-6">
        <div className="mx-auto max-w-4xl">
          <Link
            href="/treatment-plan"
            aria-label="Back to all treatment plans"
            className={cn(
              "mb-5 inline-flex w-fit items-center gap-2 rounded-xl border border-neutral-200/90 bg-white px-3.5 py-2.5 text-sm font-semibold text-neutral-800 shadow-sm",
              "transition hover:border-neutral-300 hover:bg-neutral-50 hover:text-neutral-950",
              "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
            )}
          >
            <ArrowLeft className="h-4 w-4 shrink-0 text-brand" strokeWidth={2} aria-hidden />
            Treatment plans
          </Link>

          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between sm:gap-8">
            <div className="min-w-0 flex-1 space-y-2.5">
              <p className="flex items-center gap-2 text-xs font-medium text-neutral-500">
                <Stethoscope className="h-4 w-4 shrink-0 text-brand" strokeWidth={2} />
                Latest medical guidance (this device)
              </p>
              <h1 className="text-xl font-semibold leading-snug tracking-tight text-neutral-900 sm:text-2xl sm:leading-snug">
                {caseLabel}
              </h1>
              <p className="font-mono text-[11px] leading-relaxed text-neutral-400 sm:text-xs" title={caseId}>
                Case ID ·{" "}
                {caseId.length > 44 ? `${caseId.slice(0, 20)}…${caseId.slice(-12)}` : caseId}
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-3 sm:flex-col sm:items-end sm:gap-3">
              <span
                className={cn(
                  "rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-wide",
                  urgent
                    ? "bg-urgent-soft text-urgent-foreground"
                    : "bg-neutral-100 text-neutral-700",
                )}
              >
                {data.severity ?? "—"} severity
              </span>
              <Link
                href={`/?case=${encodeURIComponent(caseId)}`}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-brand-foreground shadow-sm transition hover:opacity-95"
              >
                <MessageCircle className="h-4 w-4" strokeWidth={2} />
                Continue in chat
              </Link>
            </div>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-8 sm:py-8">
        <div className="mx-auto max-w-4xl space-y-5 sm:space-y-6">
          {data.possibleConditions.length > 0 ? (
            <section className="rounded-2xl border border-neutral-200/90 bg-white p-5 shadow-sm sm:p-6">
              <h2 className="mb-4 text-xs font-bold uppercase tracking-wide text-neutral-500">
                Possible conditions
              </h2>
              <div className="flex flex-wrap gap-2">
                {data.possibleConditions.map((c) => (
                  <span
                    key={c}
                    className="rounded-lg border border-brand/20 bg-brand-muted/40 px-3 py-2 text-sm font-medium text-neutral-900"
                  >
                    {c}
                  </span>
                ))}
              </div>
            </section>
          ) : null}

          <section className="rounded-2xl border border-neutral-200/90 bg-white p-5 shadow-sm sm:p-6">
            <h2 className="mb-3 text-xs font-bold uppercase tracking-wide text-neutral-500">
              Summary
            </h2>
            <p className="text-[15px] leading-relaxed text-neutral-800">{data.chatReply}</p>
          </section>

          {data.careSteps.length > 0 ? (
            <section className="rounded-2xl border border-neutral-200/90 bg-white p-5 shadow-sm sm:p-6">
              <h2 className="mb-4 text-xs font-bold uppercase tracking-wide text-neutral-500">
                Care steps
              </h2>
              <ol className="space-y-3">
                {data.careSteps.map((s, i) => (
                  <li
                    key={i}
                    className="flex gap-3 rounded-lg border border-neutral-100 bg-neutral-50/80 px-3 py-3 text-sm text-neutral-800"
                  >
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand text-xs font-bold text-brand-foreground">
                      {i + 1}
                    </span>
                    <span className="pt-0.5 leading-relaxed">{s}</span>
                  </li>
                ))}
              </ol>
            </section>
          ) : null}

          <section className="rounded-2xl border border-neutral-200/90 bg-white p-5 shadow-sm sm:p-6">
            <h2 className="mb-4 text-xs font-bold uppercase tracking-wide text-neutral-500">
              Structured treatment plan
            </h2>
            <PlanSections data={data} />
          </section>

          <div className="rounded-2xl border border-amber-100 bg-amber-50/60 p-5 text-sm leading-relaxed text-amber-950/90">
            <p className="font-medium text-amber-900/90">Important</p>
            <p className="mt-1 text-amber-950/85">{data.disclaimer}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
