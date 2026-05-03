"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { CaseInfoPanel } from "@/components/layout/CaseInfoPanel";

export function isTreatmentPlanRoute(pathname: string): boolean {
  return pathname === "/treatment-plan" || pathname.startsWith("/treatment-plan/");
}

export function isOutbreakAlertsRoute(pathname: string): boolean {
  return pathname === "/outbreaks" || pathname.startsWith("/outbreaks/");
}

export function isNearbyVetsRoute(pathname: string): boolean {
  return pathname === "/nearby-vets";
}

/**
 * Hides the right "Case information" rail when the main view does not need
 * per-case context (treatment plan, outbreak alerts, nearby vets).
 */
export function ShellMainArea({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "";
  const hideCaseRail =
    isTreatmentPlanRoute(pathname) ||
    isOutbreakAlertsRoute(pathname) ||
    isNearbyVetsRoute(pathname);

  return (
    <div className="flex min-h-0 flex-1">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        {children}
      </div>
      {!hideCaseRail ? <CaseInfoPanel /> : null}
    </div>
  );
}
