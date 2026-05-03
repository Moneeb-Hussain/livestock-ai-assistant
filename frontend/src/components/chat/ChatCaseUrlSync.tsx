"use client";

import { useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { useCases } from "@/providers/cases-provider";

/**
 * When visiting `/?case=<id>`, activate that case if it exists.
 * The `case` query must drive selection only when it changes or when we are still
 * waiting for that case to appear after load — not on every `cases` update (e.g.
 * "New case" would otherwise be overwritten because the URL still shows the old id).
 */
export function ChatCaseUrlSync() {
  const searchParams = useSearchParams();
  const { cases, setActiveCaseId } = useCases();
  const urlCaseRef = useRef<{ param: string | null; applied: boolean }>({
    param: null,
    applied: false,
  });

  useEffect(() => {
    const id = searchParams.get("case");
    if (!id) {
      urlCaseRef.current = { param: null, applied: false };
      return;
    }

    const exists = cases.some((c) => c.id === id);
    const prev = urlCaseRef.current;

    if (prev.param === id) {
      if (prev.applied) return;
      if (!exists) return;
      setActiveCaseId(id);
      urlCaseRef.current = { param: id, applied: true };
      return;
    }

    if (exists) {
      setActiveCaseId(id);
      urlCaseRef.current = { param: id, applied: true };
    } else {
      urlCaseRef.current = { param: id, applied: false };
    }
  }, [searchParams, cases, setActiveCaseId]);

  return null;
}
