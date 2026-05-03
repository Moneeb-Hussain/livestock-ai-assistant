"use client";

import { Info } from "lucide-react";
import { useCases } from "@/providers/cases-provider";

export function CaseInfoPanel() {
  const { activeCase } = useCases();

  return (
    <aside className="hidden w-80 shrink-0 border-l border-neutral-200 bg-white lg:flex lg:flex-col">
      <div className="flex items-center gap-2 border-b border-neutral-100 px-5 py-4">
        <Info className="h-4 w-4 text-brand" strokeWidth={2} />
        <h2 className="text-sm font-semibold text-neutral-900">
          Case Information
        </h2>
      </div>
      <div className="flex-1 p-5">
        {activeCase ? (
          <div className="space-y-3 text-sm text-neutral-600">
            <p className="text-neutral-500">
              Details about the active case will appear here.
            </p>
            <dl className="space-y-2 rounded-xl border border-neutral-100 bg-neutral-50 p-3 text-xs">
              <div className="flex justify-between gap-2">
                <dt className="text-neutral-500">Case</dt>
                <dd className="max-w-[65%] text-right font-medium text-neutral-800">
                  {activeCase.label}
                </dd>
              </div>
              {activeCase.animalType ? (
                <div className="flex justify-between gap-2">
                  <dt className="text-neutral-500">Animal</dt>
                  <dd className="font-medium capitalize text-neutral-800">
                    {activeCase.animalType}
                  </dd>
                </div>
              ) : null}
            </dl>
          </div>
        ) : (
          <p className="text-sm text-neutral-500">No case selected.</p>
        )}
      </div>
    </aside>
  );
}
