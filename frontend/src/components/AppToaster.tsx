"use client";

import { Toaster } from "sonner";

export function AppToaster() {
  return (
    <Toaster
      position="top-center"
      closeButton
      duration={5200}
      gap={10}
      toastOptions={{
        classNames: {
          toast:
            "rounded-xl border border-neutral-200/80 bg-white text-neutral-900 shadow-lg",
          title: "text-sm font-semibold text-neutral-900",
          description: "text-sm text-neutral-600",
          closeButton:
            "border-0 bg-transparent text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800",
        },
      }}
    />
  );
}
