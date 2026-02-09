"use client";

import { useEffect, useRef, useCallback } from "react";
import type { ChatMessage } from "@/lib/types";
import {
  Message,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message";
import {
  Tool,
  ToolHeader,
} from "@/components/ai-elements/tool";
import { Button } from "@/components/ui/button";
import { PlayIcon } from "lucide-react";

interface ChatMessagesProps {
  messages: ChatMessage[];
  isStreaming: boolean;
  onOpenPreview: (code: string) => void;
}

const CODE_BLOCK_RE = /```(?:jsx|tsx|html|js|javascript)\n([\s\S]*?)```/g;
const TOOL_CALL_RE = /\[Using tool: (\w+)\]\\?n?/g;

function extractCodeBlocks(text: string): string[] {
  const blocks: string[] = [];
  let match;
  const re = new RegExp(CODE_BLOCK_RE.source, CODE_BLOCK_RE.flags);
  while ((match = re.exec(text)) !== null) {
    blocks.push(match[1]);
  }
  return blocks;
}

type Segment = { type: "text"; content: string } | { type: "tool"; name: string };

function splitByToolCalls(text: string): Segment[] {
  const segments: Segment[] = [];
  const re = new RegExp(TOOL_CALL_RE.source, TOOL_CALL_RE.flags);
  let lastIndex = 0;
  let match;
  while ((match = re.exec(text)) !== null) {
    const before = text.slice(lastIndex, match.index);
    if (before.trim()) segments.push({ type: "text", content: before });
    segments.push({ type: "tool", name: match[1] });
    lastIndex = match.index + match[0].length;
  }
  const after = text.slice(lastIndex);
  if (after.trim()) segments.push({ type: "text", content: after });
  return segments;
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

          const codeBlocks = extractCodeBlocks(message.content);
          const segments = splitByToolCalls(message.content);
          const hasToolCalls = segments.some((s) => s.type === "tool");

          return (
            <Message key={message.id} from="assistant">
              <MessageContent>
                {hasToolCalls && !isAssistantStreaming ? (
                  segments.map((seg, i) =>
                    seg.type === "tool" ? (
                      <Tool key={i}>
                        <ToolHeader
                          type={"dynamic-tool" as never}
                          state={"output-available" as never}
                          toolName={seg.name}
                          title={seg.name}
                        />
                      </Tool>
                    ) : (
                      <MessageResponse key={i} mode="static">
                        {seg.content}
                      </MessageResponse>
                    )
                  )
                ) : (
                  <MessageResponse mode={isAssistantStreaming ? "streaming" : "static"}>
                    {message.content}
                  </MessageResponse>
                )}
                {codeBlocks.length > 0 && !isAssistantStreaming && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {codeBlocks.map((code, i) => (
                      <Button
                        key={i}
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenPreview(code)}
                        className="gap-1.5"
                      >
                        <PlayIcon className="h-3.5 w-3.5" />
                        Open Preview{codeBlocks.length > 1 ? ` ${i + 1}` : ""}
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
