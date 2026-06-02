"use client";

import { useCallback, useMemo, useState } from "react";
import {
  Check,
  Clipboard,
  Clock,
  Info,
  MessageSquare,
  Sparkles,
  Stethoscope,
} from "lucide-react";
import { useCases } from "@/providers/cases-provider";
import {
  getLatestMedicalFromThread,
  parseAssistantPayload,
} from "@/lib/thread-format";
import { cn } from "@/lib/utils";

function formatUpdated(iso: string): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "";
  const d = new Date(t);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function severityStyle(sev: string | undefined): string {
  const s = (sev ?? "").toLowerCase();
  if (s.includes("high") || s.includes("severe") || s.includes("urgent")) {
    return "bg-red-50 text-red-900 ring-1 ring-red-100";
  }
  if (s.includes("moderate") || s.includes("medium")) {
    return "bg-amber-50 text-amber-950 ring-1 ring-amber-100";
  }
  return "bg-neutral-100 text-neutral-800 ring-1 ring-neutral-200/80";
}

export function CaseInfoPanel() {
  const { activeCase, activeThread } = useCases();
  const [copied, setCopied] = useState(false);

  const stats = useMemo(() => {
    let userTurns = 0;
    let assistantTurns = 0;
    let lastUserPreview: string | null = null;
    for (let i = activeThread.length - 1; i >= 0; i -= 1) {
      const m = activeThread[i];
      if (m.role === "user" && lastUserPreview == null) {
        const t = m.content.trim().replace(/\s+/g, " ");
        lastUserPreview = t.length > 0 ? t : null;
      }
    }
    for (const m of activeThread) {
      if (m.role === "user") userTurns += 1;
      else assistantTurns += 1;
    }
    return {
      userTurns,
      assistantTurns,
      total: activeThread.length,
      lastUserPreview,
    };
  }, [activeThread]);

  const latestMedical = useMemo(
    () => getLatestMedicalFromThread(activeThread),
    [activeThread],
  );

  const lastAssistantSnippet = useMemo(() => {
    for (let i = activeThread.length - 1; i >= 0; i -= 1) {
      const m = activeThread[i];
      if (m.role !== "assistant") continue;
      const data = parseAssistantPayload(m.content);
      if (!data) continue;
      const line = data.chatReply?.trim().replace(/\s+/g, " ") ?? "";
      if (!line) continue;
      return line.length > 200 ? `${line.slice(0, 200)}…` : line;
    }
    return null;
  }, [activeThread]);

  const copyId = useCallback(async () => {
    if (!activeCase || typeof navigator === "undefined" || !navigator.clipboard)
      return;
    try {
      await navigator.clipboard.writeText(activeCase.id);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }, [activeCase]);

  const shortId = activeCase
    ? activeCase.id.length > 18
      ? `${activeCase.id.slice(0, 14)}…`
      : activeCase.id
    : "";

  return (
    <aside className="hidden w-[22rem] shrink-0 flex-col border-l border-neutral-200 bg-white lg:flex">
      <div className="flex items-center gap-2 border-b border-neutral-100 px-4 py-3.5">
        <Info className="h-4 w-4 shrink-0 text-brand" strokeWidth={2} />
        <h2 className="text-sm font-semibold text-neutral-900">Case information</h2>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        {!activeCase ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 px-5 py-10 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-neutral-100 text-neutral-500">
              <MessageSquare className="h-6 w-6" strokeWidth={1.5} aria-hidden />
            </div>
            <p className="text-sm font-medium text-neutral-800">No case selected</p>
            <p className="max-w-[14rem] text-xs leading-relaxed text-neutral-500">
              Choose a case from the bar above, or start a new one, to see context
              here while you chat.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-5 p-4">
            <div className="rounded-2xl border border-neutral-200/90 bg-gradient-to-b from-white to-neutral-50/80 p-4 shadow-sm">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
                Active case
              </p>
              <h3 className="mt-1.5 break-words text-base font-semibold leading-snug text-neutral-900">
                {activeCase.label}
              </h3>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-neutral-600">
                <span className="inline-flex items-center gap-1 rounded-full bg-white/90 px-2 py-0.5 font-medium ring-1 ring-neutral-200/80">
                  <Clock className="h-3 w-3 shrink-0 text-neutral-400" aria-hidden />
                  Updated {formatUpdated(activeCase.updatedAt)}
                </span>
                {activeCase.animalType ? (
                  <span className="rounded-full bg-brand-muted/80 px-2 py-0.5 font-medium capitalize text-brand">
                    {activeCase.animalType}
                  </span>
                ) : null}
              </div>
              <div className="mt-4 flex items-center gap-2 border-t border-neutral-100 pt-3">
                <code className="min-w-0 flex-1 truncate rounded-lg bg-neutral-100 px-2 py-1.5 font-mono text-[10px] text-neutral-600">
                  {shortId}
                </code>
                <button
                  type="button"
                  onClick={() => void copyId()}
                  className={cn(
                    "inline-flex shrink-0 items-center gap-1 rounded-lg border border-neutral-200 bg-white px-2 py-1.5 text-[11px] font-medium text-neutral-700",
                    "transition hover:bg-neutral-50",
                  )}
                  title="Copy full case id"
                >
                  {copied ? (
                    <Check className="h-3.5 w-3.5 text-emerald-600" aria-hidden />
                  ) : (
                    <Clipboard className="h-3.5 w-3.5" aria-hidden />
                  )}
                  {copied ? "Copied" : "Copy id"}
                </button>
              </div>
            </div>

            <section className="rounded-2xl border border-neutral-100 bg-neutral-50/50 p-4">
              <h4 className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                This chat
              </h4>
              <dl className="mt-3 grid grid-cols-2 gap-3 text-xs">
                <div className="rounded-xl bg-white px-3 py-2.5 shadow-sm ring-1 ring-neutral-100">
                  <dt className="text-neutral-500">Your messages</dt>
                  <dd className="mt-0.5 text-lg font-semibold tabular-nums text-neutral-900">
                    {stats.userTurns}
                  </dd>
                </div>
                <div className="rounded-xl bg-white px-3 py-2.5 shadow-sm ring-1 ring-neutral-100">
                  <dt className="text-neutral-500">Assistant replies</dt>
                  <dd className="mt-0.5 text-lg font-semibold tabular-nums text-neutral-900">
                    {stats.assistantTurns}
                  </dd>
                </div>
              </dl>
              {stats.total === 0 ? (
                <p className="mt-3 text-xs leading-relaxed text-neutral-500">
                  No messages yet. Describe symptoms in the chat — this panel
                  updates as you go.
                </p>
              ) : null}
            </section>

            {stats.lastUserPreview ? (
              <section>
                <h4 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                  <MessageSquare className="h-3.5 w-3.5" aria-hidden />
                  Last thing you asked
                </h4>
                <blockquote className="mt-2 rounded-xl border border-neutral-200/80 bg-white px-3 py-2.5 text-xs leading-relaxed text-neutral-700 shadow-sm">
                  <span className="line-clamp-6 break-words">{stats.lastUserPreview}</span>
                </blockquote>
              </section>
            ) : null}

            {latestMedical ? (
              <section>
                <h4 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                  <Stethoscope className="h-3.5 w-3.5" aria-hidden />
                  Latest medical read
                </h4>
                <div className="mt-2 space-y-2 rounded-xl border border-emerald-100/80 bg-emerald-50/40 p-3">
                  {latestMedical.severity ? (
                    <span
                      className={cn(
                        "inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold",
                        severityStyle(latestMedical.severity),
                      )}
                    >
                      Severity: {latestMedical.severity}
                    </span>
                  ) : null}
                  {latestMedical.possibleConditions.length > 0 ? (
                    <ul className="flex flex-wrap gap-1.5" aria-label="Possible conditions">
                      {latestMedical.possibleConditions.slice(0, 5).map((c) => (
                        <li key={c}>
                          <span className="inline-block max-w-full break-words rounded-md bg-white/90 px-2 py-0.5 text-[11px] font-medium text-neutral-800 ring-1 ring-emerald-100">
                            {c}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              </section>
            ) : null}

            {lastAssistantSnippet && !latestMedical ? (
              <section>
                <h4 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                  <Sparkles className="h-3.5 w-3.5" aria-hidden />
                  Latest reply (preview)
                </h4>
                <p className="mt-2 rounded-xl border border-neutral-200/80 bg-white px-3 py-2.5 text-xs leading-relaxed text-neutral-600 shadow-sm">
                  {lastAssistantSnippet}
                </p>
              </section>
            ) : null}

            <section className="mt-auto rounded-xl border border-dashed border-neutral-200 bg-neutral-50/60 px-3 py-3">
              <p className="text-[11px] font-semibold text-neutral-700">Reminder</p>
              <p className="mt-1.5 text-[11px] leading-relaxed text-neutral-600">
                LivestockAI gives general guidance only. For diagnosis, prescriptions,
                or urgent animals, contact a qualified veterinarian.
              </p>
            </section>
          </div>
        )}
      </div>
    </aside>
  );
}
