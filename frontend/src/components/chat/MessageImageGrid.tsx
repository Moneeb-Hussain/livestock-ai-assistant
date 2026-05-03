"use client";

import { useState } from "react";
import { ImageLightbox } from "@/components/ui/ImageLightbox";
import { cn } from "@/lib/utils";

type Props = {
  images: string[];
  className?: string;
};

/**
 * Responsive grid for message images; tap any image for full-screen view.
 */
export function MessageImageGrid({ images, className }: Props) {
  const [lightbox, setLightbox] = useState<string | null>(null);
  const n = images.length;
  const cols =
    n <= 1 ? "grid-cols-1" : n === 2 ? "grid-cols-2" : "grid-cols-3";

  return (
    <>
      <div className={cn("grid gap-2", cols, className)}>
        {images.map((src, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setLightbox(src)}
            className={cn(
              "relative aspect-square min-h-0 w-full min-w-0 overflow-hidden rounded-lg",
              "border border-white/60 bg-white/40 ring-0 transition hover:ring-2 hover:ring-brand/40",
              "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
            )}
            aria-label={`View image ${i + 1} full size`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt=""
              className="h-full w-full object-cover"
            />
          </button>
        ))}
      </div>
      <ImageLightbox
        src={lightbox}
        onClose={() => setLightbox(null)}
      />
    </>
  );
}
