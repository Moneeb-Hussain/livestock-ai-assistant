import { Suspense } from "react";
import { TreatmentPlanLegacyRedirect } from "@/components/treatment-plan/TreatmentPlanLegacyRedirect";
import { TreatmentPlansIndex } from "@/components/treatment-plan/TreatmentPlansIndex";

export default function TreatmentPlanPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-0 flex-1 items-center justify-center p-8 text-sm text-neutral-500">
          Loading treatment plans…
        </div>
      }
    >
      <TreatmentPlanLegacyRedirect />
      <TreatmentPlansIndex />
    </Suspense>
  );
}
