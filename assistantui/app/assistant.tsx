"use client";

import { AssistantRuntimeProvider } from "@assistant-ui/react";
import {
  useChatRuntime,
  AssistantChatTransport,
} from "@assistant-ui/react-ai-sdk";
import { Thread } from "@/components/assistant-ui/thread";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export const Assistant = () => {
  const runtime = useChatRuntime({
    transport: new AssistantChatTransport({
      api: `${API_URL}/api/chat`,
    }),
  });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <div className="flex h-dvh w-full">
        <div className="flex-1 overflow-hidden">
          <Thread />
        </div>
      </div>
    </AssistantRuntimeProvider>
  );
};
