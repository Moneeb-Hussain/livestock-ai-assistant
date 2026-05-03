"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

/** Migrates old `/treatment-plan?case=id` links to `/treatment-plan/[caseId]`. */
export function TreatmentPlanLegacyRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const id = searchParams.get("case");
    if (!id?.trim()) return;
    router.replace(`/treatment-plan/${encodeURIComponent(id)}`);
  }, [router, searchParams]);

  return null;
}
