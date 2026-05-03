import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import type { NormalizedChatResponse } from "@/lib/api/types";
import { cn } from "@/lib/utils";

type Props = {
  data: NormalizedChatResponse;
  time: string;
  caseId: string | null;
  onReportOutbreak: () => void | Promise<void>;
  reporting: boolean;
};

export function AssistantMessageCard({
  data,
  time,
  caseId,
  onReportOutbreak,
  reporting,
}: Props) {
  const isMedical = data.responseType === "medical";
  const isFalseInput = data.responseType === "false_input";
  const urgent =
    isMedical && String(data.severity ?? "").toLowerCase() === "urgent";

  const severityLabel = isMedical
    ? (data.severity ?? "—")
    : isFalseInput
      ? "out of scope"
      : "follow-up";

  const canReportOutbreak =
    isMedical && data.possibleConditions.length > 0 && Boolean(caseId);

  return (
    <div className="flex min-w-0 gap-3">
      {/* eslint-disable-next-line @next/next/no-img-element -- local SVG avatars */}
      <img
        src="/images/cow-avatar.svg"
        alt=""
        width={40}
        height={40}
        className="mt-1 h-10 w-10 shrink-0 rounded-full"
      />
      <div className="min-w-0 max-w-[min(100%,40rem)] flex-1">
        <div className="min-w-0 overflow-hidden rounded-2xl rounded-bl-md border border-neutral-200 bg-white shadow-card">
          <div className="flex min-w-0 flex-wrap items-center gap-2 border-b border-neutral-100 px-4 py-3">
            <p className="min-w-0 flex-1 text-sm font-semibold text-neutral-900">
              MaweshiAI
            </p>
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide",
                urgent
                  ? "bg-urgent-soft text-urgent-foreground"
                  : isMedical
                    ? "bg-neutral-100 text-neutral-600"
                    : "bg-amber-50 text-amber-800",
              )}
            >
              {severityLabel}
            </span>
            <span className="text-[11px] text-neutral-400">{time}</span>
          </div>

          <div className="min-w-0 space-y-3 break-words px-4 py-3 text-sm leading-relaxed text-neutral-700 [overflow-wrap:anywhere]">
            <p className="min-w-0">{data.chatReply}</p>
            {data.responseType === "non_medical" &&
            data.questions &&
            data.questions.length > 0 ? (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                  Questions
                </p>
                <ol className="list-decimal space-y-2 pl-5 marker:font-semibold marker:text-brand [&_li]:min-w-0">
                  {data.questions.map((q, i) => (
                    <li key={i} className="break-words [overflow-wrap:anywhere]">
                      {q}
                    </li>
                  ))}
                </ol>
              </div>
            ) : null}
            {isFalseInput && data.reason ? (
              <p className="min-w-0 break-words text-xs text-neutral-500 [overflow-wrap:anywhere]">
                <span className="font-semibold text-neutral-600">Note: </span>
                {data.reason}
              </p>
            ) : null}
            {data.careSteps.length > 0 ? (
              <ol className="list-decimal space-y-2 pl-5 marker:font-semibold marker:text-brand">
                {data.careSteps.map((step, i) => (
                  <li key={i} className="min-w-0 break-words [overflow-wrap:anywhere]">
                    {step}
                  </li>
                ))}
              </ol>
            ) : null}
          </div>

          <div className="flex items-start gap-2 border-t border-neutral-100 bg-neutral-50/80 px-4 py-3">
            <CheckCircle2
              className="mt-0.5 h-4 w-4 shrink-0 text-brand"
              strokeWidth={2}
            />
            <p className="text-xs leading-relaxed text-neutral-600">
              {data.disclaimer}
            </p>
          </div>

          {isMedical ? (
            <div className="flex flex-wrap gap-2 border-t border-neutral-100 px-4 py-3">
              <Link
                href={
                  caseId
                    ? `/treatment-plan/${encodeURIComponent(caseId)}`
                    : "/treatment-plan"
                }
                className={cn(
                  "inline-flex flex-1 items-center justify-center rounded-xl px-3 py-2",
                  "bg-brand text-center text-sm font-semibold text-brand-foreground",
                  "min-w-[10rem] transition hover:opacity-95",
                )}
              >
                Open treatment plan
              </Link>
              <button
                type="button"
                disabled={reporting || !canReportOutbreak}
                onClick={() => void onReportOutbreak()}
                title="You’ll see a short explanation, then your browser will ask for location—or you can type your area if you block it."
                className={cn(
                  "inline-flex flex-1 items-center justify-center rounded-xl border-2 border-brand",
                  "bg-white px-3 py-2 text-center text-sm font-semibold text-brand",
                  "min-w-[10rem] transition hover:bg-brand-muted disabled:opacity-50",
                )}
              >
                {reporting ? "Reporting…" : "Report to outbreak map"}
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
