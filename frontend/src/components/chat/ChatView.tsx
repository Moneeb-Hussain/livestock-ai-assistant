"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ApiError, reportOutbreakSignal, sendChatMessage } from "@/lib/api";
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
  ChatComposer,
  type PendingChatImage,
} from "@/components/chat/ChatComposer";
import { ChatTypingIndicator } from "@/components/chat/ChatTypingIndicator";
import { UserMessageBubble } from "@/components/chat/UserMessageBubble";
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

  const handleReport = useCallback(
    async (msg: Extract<ChatUiMessage, { role: "assistant" }>) => {
      if (!activeCaseId || msg.data.responseType !== "medical") return;
      setReportingId(msg.id);
      setError(null);
      try {
        await reportOutbreakSignal({
          caseId: activeCaseId,
          possibleConditions: msg.data.possibleConditions,
          severity: msg.data.severity,
        });
      } catch (e) {
        if (e instanceof ApiError) {
          setError(e.message);
        } else {
          setError("Could not submit outbreak report.");
        }
      } finally {
        setReportingId(null);
      }
    },
    [activeCaseId],
  );

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div
        ref={scrollAreaRef}
        className="min-w-0 flex-1 overflow-y-auto overflow-x-hidden px-4 py-6 sm:px-6"
      >
        <div className="mx-auto flex min-w-0 max-w-4xl flex-col gap-6">
          {messages.length === 0 && !loading ? (
            <p className="text-center text-sm text-neutral-500">
              Describe your animal&apos;s symptoms to get guidance. This is not a
              substitute for a veterinarian.
            </p>
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
                reporting={reportingId === m.id}
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
