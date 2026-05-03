import { MapPin } from "lucide-react";

export default function NearbyVetsPage() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
      <MapPin className="h-10 w-10 text-brand" strokeWidth={1.5} />
      <h1 className="text-lg font-semibold text-neutral-900">Nearby vets</h1>
      <p className="max-w-md text-sm text-neutral-600">
        Veterinary clinics near you will be listed here using OpenStreetMap data
        via the backend API.
      </p>
    </div>
  );
}
