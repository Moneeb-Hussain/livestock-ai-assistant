import { Suspense } from "react";
import { ChatCaseUrlSync } from "@/components/chat/ChatCaseUrlSync";
import { ChatView } from "@/components/chat/ChatView";

export default function HomePage() {
  return (
    <>
      <Suspense fallback={null}>
        <ChatCaseUrlSync />
      </Suspense>
      <ChatView />
    </>
  );
}
