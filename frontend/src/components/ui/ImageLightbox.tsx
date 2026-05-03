"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

type Props = {
  src: string | null;
  alt?: string;
  onClose: () => void;
};

export function ImageLightbox({ src, alt = "", onClose }: Props) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!src) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [src, onClose]);

  if (!mounted || !src) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="Full image"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/85 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Close image"
      />
      <button
        type="button"
        onClick={onClose}
        className="absolute right-3 top-3 z-10 rounded-full bg-white/15 p-2.5 text-white transition hover:bg-white/25 sm:right-6 sm:top-6"
        aria-label="Close"
      >
        <X className="h-6 w-6" strokeWidth={2} />
      </button>
      {/* eslint-disable-next-line @next/next/no-img-element -- lightbox full-size */}
      <img
        src={src}
        alt={alt}
        className="relative z-[1] max-h-[min(90vh,900px)] max-w-[min(96vw,1200px)] rounded-lg object-contain shadow-2xl"
      />
    </div>,
    document.body,
  );
}
