"use client";

import type { ReactNode } from "react";
import { CasesProvider } from "@/providers/cases-provider";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopBar } from "@/components/layout/TopBar";
import { CaseInfoPanel } from "@/components/layout/CaseInfoPanel";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <CasesProvider>
      <div className="flex h-screen min-h-0 w-full overflow-hidden bg-brand-surface">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar />
          <div className="flex min-h-0 flex-1">
            <div className="min-w-0 flex-1 overflow-hidden">{children}</div>
            <CaseInfoPanel />
          </div>
        </div>
      </div>
    </CasesProvider>
  );
}
