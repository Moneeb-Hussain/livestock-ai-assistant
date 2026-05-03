"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useCases } from "@/providers/cases-provider";

/** When visiting `/?case=<id>`, activate that case if it exists in the workspace. */
export function ChatCaseUrlSync() {
  const searchParams = useSearchParams();
  const { cases, setActiveCaseId } = useCases();

  useEffect(() => {
    const id = searchParams.get("case");
    if (!id) return;
    if (cases.some((c) => c.id === id)) {
      setActiveCaseId(id);
    }
  }, [searchParams, cases, setActiveCaseId]);

  return null;
}
