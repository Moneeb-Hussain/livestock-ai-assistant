"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ImagePlus, Mic, Send, X } from "lucide-react";
import { ImageLightbox } from "@/components/ui/ImageLightbox";
import { cn } from "@/lib/utils";

export type PendingChatImage = {
  id: string;
  file: File;
  previewUrl: string;
};

type Props = {
  value: string;
  onChange: (v: string) => void;
  onAppendTranscript: (text: string) => void;
  onSend: () => void;
  disabled?: boolean;
  pendingImages: PendingChatImage[];
  /** Maximum images per message (default 3). */
  maxImages?: number;
  onAddImages: (files: FileList) => void;
  onRemoveImage: (id: string) => void;
  notice?: string | null;
};

function getSpeechRecognitionCtor():
  | (new () => SpeechRecognition)
  | null {
  if (typeof window === "undefined") return null;
  return (
    window.SpeechRecognition ??
    window.webkitSpeechRecognition ??
    null
  );
}

export function ChatComposer({
  value,
  onChange,
  onAppendTranscript,
  onSend,
  disabled,
  pendingImages,
  maxImages = 3,
  onAddImages,
  onRemoveImage,
  notice,
}: Props) {
  const imageInputRef = useRef<HTMLInputElement>(null);
  const recRef = useRef<SpeechRecognition | null>(null);
  const [listening, setListening] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  const voiceSupported = getSpeechRecognitionCtor() !== null;

  const stopRecognition = useCallback(() => {
    try {
      recRef.current?.stop();
    } catch {
      /* ignore */
    }
    recRef.current = null;
    setListening(false);
  }, []);

  useEffect(() => () => stopRecognition(), [stopRecognition]);

  useEffect(() => {
    if (!lightboxSrc) return;
    const stillOpen = pendingImages.some((p) => p.previewUrl === lightboxSrc);
    if (!stillOpen) setLightboxSrc(null);
  }, [pendingImages, lightboxSrc]);

  const toggleVoice = useCallback(() => {
    setVoiceError(null);
    if (disabled) return;
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      setVoiceError("Voice input is not supported in this browser.");
      return;
    }
    if (listening) {
      stopRecognition();
      return;
    }
    const rec = new Ctor();
    rec.lang = "en-US";
    rec.continuous = true;
    rec.interimResults = false;
    rec.onresult = (event: SpeechRecognitionEvent) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const res = event.results[i];
        if (res.isFinal) {
          const t = res[0]?.transcript?.trim();
          if (t) onAppendTranscript(t);
        }
      }
    };
    rec.onerror = () => {
      setVoiceError("Voice input stopped. Try again.");
      stopRecognition();
    };
    rec.onend = () => {
      setListening(false);
      recRef.current = null;
    };
    try {
      rec.start();
      recRef.current = rec;
      setListening(true);
    } catch {
      setVoiceError("Could not start microphone. Check permissions.");
      setListening(false);
    }
  }, [disabled, listening, onAppendTranscript, stopRecognition]);

  return (
    <div className="border-t border-neutral-200 bg-white px-6 py-4">
      <div
        className={cn(
          "mx-auto flex max-w-4xl flex-col gap-2 rounded-2xl border border-neutral-200",
          "bg-neutral-50 px-2 py-2 shadow-sm",
        )}
      >
        {pendingImages.length > 0 ? (
          <div className="flex flex-wrap items-center gap-1.5 px-1 pt-1">
            {pendingImages.map((img) => (
              <div
                key={img.id}
                className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm"
              >
                <button
                  type="button"
                  onClick={() => setLightboxSrc(img.previewUrl)}
                  className="absolute inset-0 block h-full w-full transition hover:opacity-95"
                  aria-label={`View full size: ${img.file.name}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={img.previewUrl}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemoveImage(img.id);
                  }}
                  className={cn(
                    "absolute right-0.5 top-0.5 z-10 flex h-6 w-6 items-center justify-center rounded-full",
                    "bg-neutral-900/75 text-white shadow backdrop-blur-sm",
                    "transition hover:bg-neutral-900",
                    "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-white",
                  )}
                  aria-label={`Remove ${img.file.name}`}
                >
                  <X className="h-3.5 w-3.5" strokeWidth={2.5} />
                </button>
              </div>
            ))}
          </div>
        ) : null}

        <ImageLightbox
          src={lightboxSrc}
          alt=""
          onClose={() => setLightboxSrc(null)}
        />

        {(voiceError || notice) && (
          <p className="px-2 text-xs text-amber-700">{voiceError ?? notice}</p>
        )}

        <div className="flex items-end gap-1 sm:gap-2">
          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              const list = e.target.files;
              if (list?.length) onAddImages(list);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            disabled={disabled || pendingImages.length >= maxImages}
            onClick={() => imageInputRef.current?.click()}
            className={cn(
              "mb-1.5 rounded-xl p-2.5 text-neutral-500 transition",
              "hover:bg-white hover:text-brand",
              "disabled:cursor-not-allowed disabled:opacity-40",
              "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
            )}
            title={`Add images (${pendingImages.length}/${maxImages})`}
            aria-label={`Upload images, ${pendingImages.length} of ${maxImages} added`}
          >
            <ImagePlus className="h-5 w-5" strokeWidth={2} />
          </button>

          <button
            type="button"
            disabled={disabled || !voiceSupported}
            onClick={() => toggleVoice()}
            className={cn(
              "mb-1.5 rounded-xl p-2.5 transition",
              "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
              listening
                ? "bg-red-100 text-red-700 ring-2 ring-red-300 animate-pulse"
                : "text-neutral-500 hover:bg-white hover:text-brand",
              "disabled:cursor-not-allowed disabled:opacity-40",
            )}
            title={
              voiceSupported
                ? listening
                  ? "Stop voice input"
                  : "Voice note — speak to type"
                : "Voice input not supported in this browser"
            }
            aria-label={listening ? "Stop voice input" : "Voice note — speak to type"}
            aria-pressed={listening}
          >
            <Mic className="h-5 w-5" strokeWidth={2} />
          </button>

          <textarea
            rows={1}
            placeholder="Type your message…"
            value={value}
            disabled={disabled}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                const canSend =
                  !disabled && (value.trim() || pendingImages.length > 0);
                if (canSend) onSend();
              }
            }}
            className={cn(
              "max-h-40 min-h-[44px] flex-1 resize-none bg-transparent px-2 py-2.5 text-sm",
              "outline-none placeholder:text-neutral-400",
              disabled && "opacity-60",
            )}
          />

          <button
            type="button"
            disabled={disabled || (!value.trim() && pendingImages.length === 0)}
            onClick={onSend}
            className={cn(
              "mb-1.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
              "bg-brand text-brand-foreground shadow-sm transition",
              "hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-40",
              "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
            )}
            aria-label="Send message"
          >
            <Send className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>
      </div>
    </div>
  );
}
