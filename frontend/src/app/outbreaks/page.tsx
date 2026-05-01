import { Bell } from "lucide-react";

export default function OutbreaksPage() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
      <Bell className="h-10 w-10 text-brand" strokeWidth={1.5} />
      <h1 className="text-lg font-semibold text-neutral-900">
        Outbreak alerts
      </h1>
      <p className="max-w-md text-sm text-neutral-600">
        Local signals and alerts from aggregated case reports will show here in
        a later milestone.
      </p>
    </div>
  );
}
