import { ClipboardList } from "lucide-react";

export default function TreatmentPlanPage() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
      <ClipboardList className="h-10 w-10 text-brand" strokeWidth={1.5} />
      <h1 className="text-lg font-semibold text-neutral-900">
        Treatment plan
      </h1>
      <p className="max-w-md text-sm text-neutral-600">
        Structured care steps from your chat will appear here. Use{" "}
        <span className="font-medium text-brand">Open treatment plan</span> in
        a reply to jump in with context.
      </p>
    </div>
  );
}
