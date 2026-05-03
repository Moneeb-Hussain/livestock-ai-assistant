"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ApiError, reportOutbreakSignal, sendChatMessage } from "@/lib/api";
import type { ChatAttachment, ChatHistoryItem, ChatResponse } from "@/lib/api/types";
import { AssistantMessageCard } from "@/components/chat/AssistantMessageCard";
import {
  ChatComposer,
  type PendingChatImage,
} from "@/components/chat/ChatComposer";
import { UserMessageBubble } from "@/components/chat/UserMessageBubble";
import { useCases } from "@/providers/cases-provider";

const SYSTEM_PROMPT: ChatHistoryItem = {
  role: "system",
  content:
    "You are MaweshiAI, a livestock health assistant. Give safe, cautious guidance and recommend a vet for serious symptoms.",
};

const MAX_IMAGES = 1;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

type UiMessage =
  | {
      id: string;
      role: "user";
      text: string;
      time: string;
      images?: string[];
    }
  | {
      id: string;
      role: "assistant";
      time: string;
      data: ChatResponse;
    };

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

const demoAssistant: ChatResponse = {
  severity: "urgent",
  possibleConditions: [
    "Foot and mouth disease",
    "Mouth infection",
    "PPR possibility",
  ],
  chatReply:
    "یہ علامات سنگین ہو سکتی ہیں۔ بخار، منہ کے چھالے اور بھوک نہ لگنا مل کر کسی متعدی بیماری کی نشاندہی کر سکتے ہیں۔ براہ کرم جانور کو فوری طور پر الگ کریں اور قریبی ویٹرنری سے رابطہ کریں۔",
  careSteps: [
    "Isolate the animal from the herd",
    "Provide clean water and soft feed if the animal can swallow",
    "Gently rinse the mouth with clean water if advised by a vet",
    "Monitor temperature and contact a vet if it rises or the animal stops drinking",
  ],
  disclaimer:
    "This is general guidance, not a veterinary diagnosis. Always consult a qualified veterinarian.",
};

function seedMessages(caseId: string | null): UiMessage[] {
  if (caseId === "case-1") {
    return [
      {
        id: "m1",
        role: "user",
        text: "My goat has fever and blisters in the mouth since this morning. It is not eating.",
        time: "10:24 AM",
      },
      {
        id: "m2",
        role: "assistant",
        time: "10:24 AM",
        data: demoAssistant,
      },
    ];
  }
  return [];
}

export function ChatView() {
  const { activeCaseId } = useCases();
  const [byCase, setByCase] = useState<Record<string, UiMessage[]>>(() => ({
    "case-1": seedMessages("case-1"),
  }));
  const [input, setInput] = useState("");
  const [pendingImages, setPendingImages] = useState<PendingChatImage[]>([]);
  const [composerNotice, setComposerNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reportingId, setReportingId] = useState<string | null>(null);

  const messages = useMemo(() => {
    if (!activeCaseId) return [];
    return byCase[activeCaseId] ?? [];
  }, [activeCaseId, byCase]);

  useEffect(() => {
    if (!activeCaseId) return;
    setByCase((prev) => {
      if (prev[activeCaseId]) return prev;
      return { ...prev, [activeCaseId]: seedMessages(activeCaseId) };
    });
  }, [activeCaseId]);

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

  const buildHistory = useCallback(
    (prior: UiMessage[], nextUserText: string): ChatHistoryItem[] => {
      const tail: ChatHistoryItem[] = prior.flatMap((m): ChatHistoryItem[] => {
        if (m.role === "user") {
          const extra = m.images?.length
            ? `[User attached ${m.images.length} image(s) in the app.]`
            : "";
          return [
            {
              role: "user",
              content: extra ? `${m.text}\n${extra}` : m.text,
            },
          ];
        }
        return [
          {
            role: "assistant",
            content: [
              m.data.chatReply,
              ...m.data.careSteps.map((s) => `• ${s}`),
            ].join("\n"),
          },
        ];
      });
      return [
        SYSTEM_PROMPT,
        ...tail,
        { role: "user", content: nextUserText },
      ];
    },
    [],
  );

  const appendMessages = useCallback(
    (caseId: string, msgs: UiMessage[]) => {
      setByCase((prev) => ({
        ...prev,
        [caseId]: [...(prev[caseId] ?? []), ...msgs],
      }));
    },
    [],
  );

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

    let attachments: ChatAttachment[] = [];
    let imageDataUrls: string[] | undefined;

    if (snapshot.length > 0) {
      const dataUrls = await Promise.all(
        snapshot.map((s) => readFileAsDataUrl(s.file)),
      );
      imageDataUrls = dataUrls;
      attachments = snapshot.map((s, i) => ({
        id: s.id,
        mimeType: s.file.type || "image/jpeg",
        name: s.file.name,
        url: dataUrls[i],
      }));
    }

    const displayText =
      text ||
      (snapshot.length
        ? `[${snapshot.length} image${snapshot.length > 1 ? "s" : ""} attached]`
        : "");

    snapshot.forEach((s) => URL.revokeObjectURL(s.previewUrl));
    setPendingImages([]);
    setInput("");

    const userMsg: UiMessage = {
      id: `u-${Date.now()}`,
      role: "user",
      text: displayText,
      time: timeNow(),
      images: imageDataUrls,
    };

    const existing = byCase[activeCaseId] ?? [];
    const historyText =
      displayText +
      (attachments.length
        ? `\n[${attachments.length} image(s) attached for the assistant.]`
        : "");
    const chatHistory = buildHistory(existing, historyText);

    appendMessages(activeCaseId, [userMsg]);
    setLoading(true);

    try {
      const data = await sendChatMessage({
        message: text || "Please review the attached livestock image(s).",
        attachments,
        chatHistory,
        caseId: activeCaseId,
      });
      const assistantMsg: UiMessage = {
        id: `a-${Date.now()}`,
        role: "assistant",
        time: timeNow(),
        data,
      };
      appendMessages(activeCaseId, [assistantMsg]);
    } catch (e) {
      setInput(text);
      setPendingImages(
        snapshot.map((s) => ({
          id: s.id,
          file: s.file,
          previewUrl: URL.createObjectURL(s.file),
        })),
      );
      if (e instanceof ApiError) {
        setError(e.message);
      } else {
        setError("Something went wrong. Please try again.");
      }
      setByCase((prev) => ({
        ...prev,
        [activeCaseId]: (prev[activeCaseId] ?? []).filter(
          (m) => m.id !== userMsg.id,
        ),
      }));
    } finally {
      setLoading(false);
    }
  }, [
    activeCaseId,
    appendMessages,
    buildHistory,
    byCase,
    input,
    loading,
    pendingImages,
  ]);

  const handleReport = useCallback(
    async (msg: Extract<UiMessage, { role: "assistant" }>) => {
      if (!activeCaseId) return;
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
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-6">
        <div className="mx-auto flex max-w-4xl flex-col gap-6">
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
