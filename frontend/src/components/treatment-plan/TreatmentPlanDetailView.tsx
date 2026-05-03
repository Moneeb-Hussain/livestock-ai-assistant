"use client";

import Link from "next/link";
import { useMemo } from "react";
import { ArrowLeft, MessageCircle } from "lucide-react";
import { getLatestMedicalFromThread } from "@/lib/thread-format";
import { useCases } from "@/providers/cases-provider";
import { MedicalPlanDetail } from "@/components/treatment-plan/TreatmentPlanMedicalContent";

export function TreatmentPlanDetailView({ caseId }: { caseId: string }) {
  const { cases, threads } = useCases();

  const selectedCase = useMemo(
    () => cases.find((c) => c.id === caseId) ?? null,
    [cases, caseId],
  );

  const selectedMedical = useMemo(() => {
    const thread = threads[caseId] ?? [];
    return getLatestMedicalFromThread(thread);
  }, [threads, caseId]);

  if (!selectedCase) {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 bg-neutral-50/80 p-8 text-center">
        <p className="text-sm text-neutral-600">This case was not found on this device.</p>
        <Link
          href="/treatment-plan"
          className="inline-flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-sm font-semibold text-neutral-800 shadow-sm transition hover:bg-neutral-50"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={2} />
          Back to treatment plans
        </Link>
      </div>
    );
  }

  if (!selectedMedical) {
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-gradient-to-b from-brand-surface to-neutral-50/90">
        <div className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-4 py-10">
          <div className="rounded-2xl border border-neutral-200 bg-white p-8 text-center shadow-sm">
            <p className="text-sm leading-relaxed text-neutral-600">
              <span className="font-semibold text-neutral-900">{selectedCase.label}</span>{" "}
              does not have a medical treatment plan yet. Continue in chat until you receive a{" "}
              <strong>medical</strong> response with care steps.
            </p>
            <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
              <Link
                href="/treatment-plan"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-neutral-200 px-4 py-2.5 text-sm font-semibold text-neutral-800 transition hover:bg-neutral-50"
              >
                <ArrowLeft className="h-4 w-4" strokeWidth={2} />
                All plans
              </Link>
              <Link
                href={`/?case=${encodeURIComponent(selectedCase.id)}`}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-brand-foreground transition hover:opacity-95"
              >
                <MessageCircle className="h-4 w-4" strokeWidth={2} />
                Go to chat
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <MedicalPlanDetail
      caseLabel={selectedCase.label}
      caseId={selectedCase.id}
      data={selectedMedical}
    />
  );
}
