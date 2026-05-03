"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { CasesProvider } from "@/providers/cases-provider";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopBar } from "@/components/layout/TopBar";
import { isTreatmentPlanRoute, ShellMainArea } from "@/components/layout/ShellMainArea";

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "";
  const hideCaseChrome = isTreatmentPlanRoute(pathname);

  return (
    <CasesProvider>
      <div className="flex h-screen min-h-0 w-full overflow-hidden bg-brand-surface">
        <Sidebar />
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          {!hideCaseChrome ? <TopBar /> : null}
          <ShellMainArea>{children}</ShellMainArea>
        </div>
      </div>
    </CasesProvider>
  );
}
