"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ApiError, reportOutbreakSignal, sendChatMessage } from "@/lib/api";
import type { OutbreakReportPayload } from "@/lib/api/types";
import {
  isAutoCaseLabel,
  newTurnId,
  threadTitleFromAssistantSummary,
  threadToApiChatHistory,
  threadToUiMessages,
  type ChatUiMessage,
} from "@/lib/thread-format";
import { AssistantMessageCard } from "@/components/chat/AssistantMessageCard";
import {
  OutbreakLocationFallbackDialog,
  type OutbreakLocationDraft,
} from "@/components/chat/OutbreakLocationFallbackDialog";
import { OutbreakLocationPrimerDialog } from "@/components/chat/OutbreakLocationPrimerDialog";
import {
  ChatComposer,
  type PendingChatImage,
} from "@/components/chat/ChatComposer";
import { ChatTypingIndicator } from "@/components/chat/ChatTypingIndicator";
import { UserMessageBubble } from "@/components/chat/UserMessageBubble";
import {
  queryGeolocationPermission,
  requestOutbreakCoordinates,
  reverseGeocodeLabel,
} from "@/lib/outbreak-location";
import { MessageCircle } from "lucide-react";
import { useCases } from "@/providers/cases-provider";

const MAX_IMAGES = 1;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

function timeNow() {
  return new Date().toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error("read failed"));
    r.readAsDataURL(file);
  });
}

function mergePendingImages(
  prev: PendingChatImage[],
  files: FileList,
): { next: PendingChatImage[]; notice: string | null } {
  const next = [...prev];
  let notice: string | null = null;

  for (let i = 0; i < files.length; i++) {
    if (next.length >= MAX_IMAGES) {
      notice =
        MAX_IMAGES === 1
          ? "Only one image per message."
          : `You can attach up to ${MAX_IMAGES} images.`;
      break;
    }
    const file = files[i];
    if (!file.type.startsWith("image/")) {
      notice = "Only image files are allowed.";
      continue;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      notice = "Each image must be under 5 MB.";
      continue;
    }
    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `img-${Date.now()}-${i}`;
    next.push({
      id,
      file,
      previewUrl: URL.createObjectURL(file),
    });
  }

  return { next, notice };
}

export function ChatView() {
  const {
    activeCaseId,
    activeCase,
    activeThread,
    appendToThread,
    setThreadForCase,
  } = useCases();

  const [input, setInput] = useState("");
  const [pendingImages, setPendingImages] = useState<PendingChatImage[]>([]);
  const [composerNotice, setComposerNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reportingId, setReportingId] = useState<string | null>(null);
  const [outbreakLocationDraft, setOutbreakLocationDraft] =
    useState<OutbreakLocationDraft | null>(null);
  const [outbreakPrimerDraft, setOutbreakPrimerDraft] =
    useState<OutbreakLocationDraft | null>(null);
  const [outbreakPrimerBusy, setOutbreakPrimerBusy] = useState(false);
  /** Chrome already blocked this origin — show reset instructions instead of expecting a prompt. */
  const [outbreakPrimerChromeBlockedHelp, setOutbreakPrimerChromeBlockedHelp] =
    useState(false);
  const outbreakPrimerContinueRef = useRef<() => Promise<void>>(async () => {});
  /** Data URLs for user turns in this session only (not persisted — avoids localStorage quota). */
  const [liveUserImages, setLiveUserImages] = useState<Record<string, string[]>>({});
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const scrollEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setError(null);
    setLiveUserImages({});
  }, [activeCaseId]);

  const messages = useMemo(() => {
    if (!activeCaseId) return [];
    const base = threadToUiMessages(activeThread);
    return base.map((m) => {
      if (m.role !== "user") return m;
      const extra = liveUserImages[m.id];
      if (!extra?.length) return m;
      return { ...m, images: extra };
    });
  }, [activeCaseId, activeThread, liveUserImages]);

  useLayoutEffect(() => {
    const root = scrollAreaRef.current;
    const end = scrollEndRef.current;
    if (!end) return;
    const nearBottom =
      !root ||
      root.scrollHeight - root.scrollTop - root.clientHeight < 120;
    if (nearBottom || loading) {
      end.scrollIntoView({ block: "end", behavior: "auto" });
    }
  }, [activeCaseId, messages, loading, input]);

  const appendTranscript = useCallback((text: string) => {
    setInput((v) => (v ? `${v.trimEnd()} ` : "") + text);
  }, []);

  const handleAddImages = useCallback((files: FileList) => {
    setComposerNotice(null);
    setPendingImages((prev) => {
      const { next, notice } = mergePendingImages(prev, files);
      if (notice) {
        queueMicrotask(() => setComposerNotice(notice));
      }
      return next;
    });
  }, []);

  const handleRemoveImage = useCallback((id: string) => {
    setPendingImages((prev) => {
      const found = prev.find((p) => p.id === id);
      if (found) URL.revokeObjectURL(found.previewUrl);
      return prev.filter((p) => p.id !== id);
    });
    setComposerNotice(null);
  }, []);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    const snapshot = pendingImages.map((p) => ({
      id: p.id,
      file: p.file,
      previewUrl: p.previewUrl,
    }));

    if ((!text && snapshot.length === 0) || !activeCaseId || loading) {
      return;
    }

    setError(null);
    setComposerNotice(null);

    let imageDataUrls: string[] | undefined;

    if (snapshot.length > 0) {
      const dataUrls = await Promise.all(
        snapshot.map((s) => readFileAsDataUrl(s.file)),
      );
      imageDataUrls = dataUrls;
    }

    const displayText =
      text ||
      (snapshot.length
        ? `[${snapshot.length} image${snapshot.length > 1 ? "s" : ""} attached]`
        : "");

    snapshot.forEach((s) => URL.revokeObjectURL(s.previewUrl));
    setPendingImages([]);
    setInput("");

    const prior = activeThread;
    const chatHistory = threadToApiChatHistory(prior);

    const imageFile = snapshot[0]?.file ?? null;
    const message =
      text.trim() ||
      (snapshot.length
        ? "Please review the attached livestock image(s)."
        : "");

    const userTurn = {
      id: newTurnId("u"),
      role: "user" as const,
      content: displayText,
      time: timeNow(),
      ...(snapshot.length > 0 ? { imageCount: snapshot.length } : {}),
    };

    if (imageDataUrls?.length) {
      setLiveUserImages((prev) => ({ ...prev, [userTurn.id]: imageDataUrls }));
    }

    appendToThread(activeCaseId, [userTurn]);
    setLoading(true);

    try {
      const data = await sendChatMessage({
        message,
        chatHistory,
        imageFile,
      });
      const assistantTurn = {
        id: newTurnId("a"),
        role: "assistant" as const,
        time: timeNow(),
        content: JSON.stringify(data),
      };
      const titleFromSummary =
        activeCase && isAutoCaseLabel(activeCase.label)
          ? threadTitleFromAssistantSummary(data)
          : undefined;
      appendToThread(
        activeCaseId,
        [assistantTurn],
        titleFromSummary ? { newLabel: titleFromSummary } : undefined,
      );
    } catch (e) {
      setInput(text);
      if (snapshot.length) {
        setPendingImages(
          snapshot.map((s) => ({
            id: s.id,
            file: s.file,
            previewUrl: URL.createObjectURL(s.file),
          })),
        );
      }
      if (e instanceof ApiError) {
        setError(e.message);
      } else {
        setError("Something went wrong. Please try again.");
      }
      setThreadForCase(activeCaseId, prior);
    } finally {
      setLoading(false);
    }
  }, [
    activeCase,
    activeCaseId,
    activeThread,
    appendToThread,
    input,
    loading,
    pendingImages,
    setThreadForCase,
  ]);

  const submitOutbreakReport = useCallback(async (payload: OutbreakReportPayload) => {
    await reportOutbreakSignal(payload);
  }, []);

  const handleReport = useCallback(
    (msg: Extract<ChatUiMessage, { role: "assistant" }>) => {
      if (!activeCaseId || msg.data.responseType !== "medical") return;
      setError(null);
      const lastUser = [...activeThread].reverse().find((t) => t.role === "user");
      const userSnippet =
        lastUser?.role === "user"
          ? lastUser.content.replace(/\s+/g, " ").replace(/,/g, ";").trim().slice(0, 240)
          : "";
      const conditionParts = (msg.data.possibleConditions ?? [])
        .map((s) => s.trim())
        .filter(Boolean);
      const symptomParts = [...conditionParts];
      if (userSnippet) symptomParts.push(`user_note:${userSnippet}`);
      const symptomSummary = symptomParts.length ? symptomParts.join(",") : "unspecified";

      const base: OutbreakReportPayload = {
        caseId: activeCaseId,
        caseLabel: activeCase?.label,
        animalType: activeCase?.animalType,
        symptomSummary,
        possibleConditions: msg.data.possibleConditions,
        severity: msg.data.severity,
      };

      setReportingId(msg.id);
      setOutbreakPrimerChromeBlockedHelp(false);
      setOutbreakPrimerDraft({
        assistantMessageId: msg.id,
        payload: base,
      });
    },
    [activeCase?.animalType, activeCase?.label, activeCaseId, activeThread],
  );

  const handleOutbreakPrimerCancel = useCallback(() => {
    setOutbreakPrimerDraft(null);
    setOutbreakPrimerBusy(false);
    setOutbreakPrimerChromeBlockedHelp(false);
    setReportingId(null);
  }, []);

  const handleOutbreakPrimerContinue = useCallback(async () => {
    if (!outbreakPrimerDraft) return;
    setOutbreakPrimerBusy(true);
    setError(null);
    const { payload, assistantMessageId } = outbreakPrimerDraft;
    try {
      const perm = await queryGeolocationPermission();
      if (perm === "denied") {
        setOutbreakPrimerChromeBlockedHelp(true);
        return;
      }

      const result = await requestOutbreakCoordinates({ timeoutMs: 15_000 });
      if (result.ok) {
        const { latitude, longitude } = result.coords;
        let locationName =
          (await reverseGeocodeLabel(latitude, longitude)) ?? undefined;
        if (!locationName?.trim()) {
          locationName = `${latitude.toFixed(4)},${longitude.toFixed(4)}`;
        }
        await submitOutbreakReport({
          ...payload,
          latitude,
          longitude,
          locationName,
        });
        setOutbreakPrimerDraft(null);
        setOutbreakPrimerChromeBlockedHelp(false);
        setReportingId(null);
        return;
      }

      if (result.reason === "permission_denied") {
        setOutbreakPrimerChromeBlockedHelp(true);
        return;
      }

      setOutbreakPrimerDraft(null);
      setOutbreakPrimerChromeBlockedHelp(false);
      setReportingId(null);
      setOutbreakLocationDraft({ assistantMessageId, payload });
    } catch (e) {
      if (e instanceof ApiError) {
        setError(e.message);
      } else {
        setError("Could not submit outbreak report.");
      }
      setOutbreakPrimerDraft(null);
      setOutbreakPrimerChromeBlockedHelp(false);
      setReportingId(null);
    } finally {
      setOutbreakPrimerBusy(false);
    }
  }, [outbreakPrimerDraft, submitOutbreakReport]);

  useEffect(() => {
    outbreakPrimerContinueRef.current = handleOutbreakPrimerContinue;
  }, [handleOutbreakPrimerContinue]);

  const handleOutbreakPrimerTryAgainAfterUnblock = useCallback(async () => {
    setOutbreakPrimerChromeBlockedHelp(false);
    await outbreakPrimerContinueRef.current();
  }, []);

  const handleOutbreakPrimerEnterAreaManually = useCallback(() => {
    if (!outbreakPrimerDraft) return;
    const { payload, assistantMessageId } = outbreakPrimerDraft;
    setOutbreakPrimerDraft(null);
    setOutbreakPrimerChromeBlockedHelp(false);
    setOutbreakPrimerBusy(false);
    setReportingId(null);
    setOutbreakLocationDraft({ assistantMessageId, payload });
  }, [outbreakPrimerDraft]);

  const handleOutbreakLocationDialogClose = useCallback(() => {
    setOutbreakLocationDraft(null);
    setReportingId(null);
  }, []);

  const handleOutbreakManualLocation = useCallback(
    async (locationName: string): Promise<boolean> => {
      if (!outbreakLocationDraft) return false;
      try {
        await submitOutbreakReport({
          ...outbreakLocationDraft.payload,
          locationName: locationName.trim(),
        });
        setOutbreakLocationDraft(null);
        setReportingId(null);
        return true;
      } catch (e) {
        if (e instanceof ApiError) {
          setError(e.message);
        } else {
          setError("Could not submit outbreak report.");
        }
        return false;
      }
    },
    [outbreakLocationDraft, submitOutbreakReport],
  );

  const handleOutbreakRetryGeo = useCallback(async (): Promise<boolean> => {
    if (!outbreakLocationDraft) return false;
    const result = await requestOutbreakCoordinates({ timeoutMs: 15_000 });
    if (!result.ok) return false;
    const { latitude, longitude } = result.coords;
    let locationName =
      (await reverseGeocodeLabel(latitude, longitude)) ?? undefined;
    if (!locationName?.trim()) {
      locationName = `${latitude.toFixed(4)},${longitude.toFixed(4)}`;
    }
    try {
      await submitOutbreakReport({
        ...outbreakLocationDraft.payload,
        latitude,
        longitude,
        locationName,
      });
      setOutbreakLocationDraft(null);
      setReportingId(null);
      return true;
    } catch (e) {
      if (e instanceof ApiError) {
        setError(e.message);
      } else {
        setError("Could not submit outbreak report.");
      }
      return false;
    }
  }, [outbreakLocationDraft, submitOutbreakReport]);

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <OutbreakLocationPrimerDialog
        open={outbreakPrimerDraft !== null}
        busy={outbreakPrimerBusy}
        showChromeBlockedHelp={outbreakPrimerChromeBlockedHelp}
        onCancel={handleOutbreakPrimerCancel}
        onContinue={handleOutbreakPrimerContinue}
        onTryAgainAfterUnblock={handleOutbreakPrimerTryAgainAfterUnblock}
        onEnterAreaManually={handleOutbreakPrimerEnterAreaManually}
      />
      <OutbreakLocationFallbackDialog
        draft={outbreakLocationDraft}
        onClose={handleOutbreakLocationDialogClose}
        onSubmitManual={handleOutbreakManualLocation}
        onRetryGeo={handleOutbreakRetryGeo}
      />
      <div
        ref={scrollAreaRef}
        className="min-w-0 flex-1 overflow-y-auto overflow-x-hidden px-4 py-6 sm:px-6"
      >
        <div className="mx-auto flex min-w-0 max-w-4xl flex-col gap-6">
          {messages.length === 0 && !loading ? (
            <div className="flex min-h-[min(480px,50dvh)] w-full flex-col items-center justify-center px-2 py-8 sm:min-h-[min(520px,45dvh)] sm:py-12">
              <div className="w-full max-w-md rounded-2xl border border-neutral-200/90 bg-white px-6 py-9 text-center shadow-card sm:px-8 sm:py-10">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-muted text-brand">
                  <MessageCircle className="h-7 w-7" strokeWidth={1.75} aria-hidden />
                </div>
                <h2 className="mt-6 text-lg font-semibold tracking-tight text-neutral-900 sm:text-xl">
                  Describe your animal&apos;s symptoms
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-neutral-600">
                  Type what you see in plain language. You&apos;ll get cautious,
                  practical guidance — not a diagnosis.
                </p>
                <div className="mt-6 border-t border-neutral-100 pt-6">
                  <p className="text-xs leading-relaxed text-neutral-500">
                    <span className="font-semibold text-neutral-600">
                      Not a substitute for a vet.
                    </span>{" "}
                    For exams, diagnosis, and treatment, contact a qualified
                    veterinarian — urgently if the animal is very unwell.
                  </p>
                </div>
              </div>
            </div>
          ) : null}
          {messages.map((m) =>
            m.role === "user" ? (
              <UserMessageBubble
                key={m.id}
                text={m.text}
                time={m.time}
                images={m.images}
              />
            ) : (
              <AssistantMessageCard
                key={m.id}
                data={m.data}
                time={m.time}
                caseId={activeCaseId}
                reporting={
                  reportingId === m.id ||
                  (outbreakPrimerDraft?.assistantMessageId === m.id && outbreakPrimerBusy)
                }
                onReportOutbreak={() => handleReport(m)}
              />
            ),
          )}
          {loading ? <ChatTypingIndicator /> : null}
          <div ref={scrollEndRef} className="h-px w-full shrink-0" aria-hidden />
        </div>
      </div>

      {error ? (
        <div className="border-t border-red-100 bg-red-50 px-6 py-2 text-center text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <ChatComposer
        value={input}
        onChange={setInput}
        onAppendTranscript={appendTranscript}
        onSend={() => void handleSend()}
        disabled={loading || !activeCaseId}
        maxImages={MAX_IMAGES}
        pendingImages={pendingImages}
        onAddImages={handleAddImages}
        onRemoveImage={handleRemoveImage}
        notice={composerNotice}
      />
    </div>
  );
}
