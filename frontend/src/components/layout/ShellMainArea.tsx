"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { CaseInfoPanel } from "@/components/layout/CaseInfoPanel";

export function isTreatmentPlanRoute(pathname: string): boolean {
  return pathname === "/treatment-plan" || pathname.startsWith("/treatment-plan/");
}

/**
 * Hides the right "Case information" rail on treatment-plan so the plan view
 * can use full width (case context is already in the plan header / list).
 */
export function ShellMainArea({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "";
  const hideCaseRail = isTreatmentPlanRoute(pathname);

  return (
    <div className="flex min-h-0 flex-1">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        {children}
      </div>
      {!hideCaseRail ? <CaseInfoPanel /> : null}
    </div>
  );
}
