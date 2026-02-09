"use client";

import { useEffect, useRef, useCallback } from "react";
import type { ChatMessage } from "@/lib/types";
import {
  Message,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message";
import { Button } from "@/components/ui/button";
import { PlayIcon } from "lucide-react";

interface ChatMessagesProps {
  messages: ChatMessage[];
  isStreaming: boolean;
  onOpenPreview: (code: string) => void;
}

const JSX_CODE_BLOCK_RE = /```(?:jsx|tsx)\n([\s\S]*?)```/g;

function extractJsxBlocks(text: string): string[] {
  const blocks: string[] = [];
  let match;
  const re = new RegExp(JSX_CODE_BLOCK_RE.source, JSX_CODE_BLOCK_RE.flags);
  while ((match = re.exec(text)) !== null) {
    blocks.push(match[1]);
  }
  return blocks;
}

export function ChatMessages({
  messages,
  isStreaming,
  onOpenPreview,
}: ChatMessagesProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleOpenPreview = useCallback(
    (code: string) => {
      onOpenPreview(code);
    },
    [onOpenPreview]
  );

  if (messages.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="text-center">
          <h2 className="mb-2 text-xl font-semibold">Agent 311</h2>
          <p className="text-sm text-muted-foreground">
            Austin 311 Data Science Agent. Ask me about service requests, trends,
            or data analysis.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4">
      <div className="mx-auto max-w-3xl space-y-6">
        {messages.map((message, idx) => {
          const isLast = idx === messages.length - 1;
          const isAssistantStreaming =
            isStreaming && isLast && message.role === "assistant";

          if (message.role === "user") {
            return (
              <Message key={message.id} from="user">
                <MessageContent>{message.content}</MessageContent>
              </Message>
            );
          }

          const jsxBlocks = extractJsxBlocks(message.content);

          return (
            <Message key={message.id} from="assistant">
              <MessageContent>
                <MessageResponse mode={isAssistantStreaming ? "streaming" : "static"}>
                  {message.content}
                </MessageResponse>
                {jsxBlocks.length > 0 && !isAssistantStreaming && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {jsxBlocks.map((code, i) => (
                      <Button
                        key={i}
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenPreview(code)}
                        className="gap-1.5"
                      >
                        <PlayIcon className="h-3.5 w-3.5" />
                        Open Preview{jsxBlocks.length > 1 ? ` ${i + 1}` : ""}
                      </Button>
                    ))}
                  </div>
                )}
              </MessageContent>
            </Message>
          );
        })}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
