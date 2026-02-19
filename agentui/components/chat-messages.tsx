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
import { CodeXmlIcon, EyeIcon } from "lucide-react";

interface ChatMessagesProps {
  messages: ChatMessage[];
  isStreaming: boolean;
  onOpenPreview: (code: string) => void;
}

const TOOL_CALL_RE = /\[Using tool:\s*([^\]\n]+)\](?:\\n|\n)?/g;

// Match the full code block including fences for stripping
const CODE_BLOCK_FULL_RE = /```(?:jsx|tsx|html|js|javascript)\n[\s\S]*?```/g;

interface CodeBlockInfo {
  code: string;
  language: string;
  title: string;
}

function extractCodeBlockInfos(text: string): CodeBlockInfo[] {
  const blocks: CodeBlockInfo[] = [];
  const re = /```(jsx|tsx|html|js|javascript)\n([\s\S]*?)```/g;
  let match;
  while ((match = re.exec(text)) !== null) {
    const lang = match[1];
    const code = match[2];
    // Try to extract title from HTML <title> tag
    const titleMatch = code.match(/<title>([^<]+)<\/title>/i);
    const title = titleMatch ? titleMatch[1] : "Index";
    const langLabel = lang === "js" || lang === "javascript" ? "JavaScript"
      : lang === "html" ? "HTML"
      : lang.toUpperCase();
    blocks.push({ code, language: langLabel, title });
  }
  return blocks;
}

function stripCodeBlocks(text: string): string {
  return text.replace(CODE_BLOCK_FULL_RE, "").trim();
}

const TOOL_LABELS: Record<string, string> = {
  Write: "Created a file",
  Read: "Read a file",
  Edit: "Edited a file",
  Bash: "Ran a command",
  Search: "Searched",
  Grep: "Searched files",
  Glob: "Found files",
  WebFetch: "Fetched a page",
  WebSearch: "Searched the web",
  view_content: "Viewed content",
};

interface ToolCallInfo {
  raw: string;
  name: string;
  args: string;
}

function parseToolCall(raw: string): ToolCallInfo {
  const trimmed = raw.trim();
  const firstSpace = trimmed.indexOf(" ");
  if (firstSpace < 0) {
    return { raw: trimmed, name: trimmed, args: "" };
  }

  return {
    raw: trimmed,
    name: trimmed.slice(0, firstSpace),
    args: trimmed.slice(firstSpace + 1).trim(),
  };
}

function extractToolCalls(text: string): ToolCallInfo[] {
  const calls: ToolCallInfo[] = [];
  const re = new RegExp(TOOL_CALL_RE.source, TOOL_CALL_RE.flags);
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    calls.push(parseToolCall(match[1]));
  }
  return calls;
}

function stripToolCalls(text: string): string {
  return text.replace(TOOL_CALL_RE, "\n").trim();
}

function ToolCallGroup({ toolCalls }: { toolCalls: ToolCallInfo[] }) {
  // Deduplicate: show each unique call once
  const unique = Array.from(
    new Map(toolCalls.map((call) => [call.raw, call])).values()
  );
  const title = unique
    .map((call) => {
      const label = TOOL_LABELS[call.name] || call.name;
      return call.args ? `${label} ${call.args}` : label;
    })
    .join(", ");

  return (
    <Tool defaultOpen={false} className="mb-2">
      <ToolHeader
        type={"dynamic-tool" as never}
        state={"output-available" as never}
        toolName={unique.map((call) => call.raw).join(", ")}
        title={title}
      />
    </Tool>
  );
}

function ArtifactCard({
  info,
  onOpen,
}: {
  info: CodeBlockInfo;
  onOpen: () => void;
}) {
  return (
    <button
      onClick={onOpen}
      className="my-2 flex w-full items-center gap-4 rounded-lg border border-border/60 bg-card p-3 text-left transition-colors hover:bg-accent/50"
    >
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-muted">
        <CodeXmlIcon className="h-5 w-5 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">{info.title}</div>
        <div className="text-xs text-muted-foreground">
          Code · {info.language}
        </div>
      </div>
      <div className="flex items-center gap-1.5 rounded-md border border-border/60 bg-background px-3 py-1.5 text-xs font-medium">
        <EyeIcon className="h-3.5 w-3.5" />
        Open Preview
      </div>
    </button>
  );
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
          <h2 className="mb-2 text-xl font-semibold">Agent Austin</h2>
          <p className="text-sm text-muted-foreground">
            City of Austin Data Science Agent. Ask me about Austin 311 service requests, trends,
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

          // During streaming, render raw content
          if (isAssistantStreaming) {
            return (
              <Message key={message.id} from="assistant">
                <MessageContent>
                  <MessageResponse mode="streaming">
                    {message.content}
                  </MessageResponse>
                </MessageContent>
              </Message>
            );
          }

          // For completed messages, parse tool calls and code blocks
          const toolCalls = extractToolCalls(message.content);
          const codeBlockInfos = extractCodeBlockInfos(message.content);
          const cleanText = stripCodeBlocks(stripToolCalls(message.content));

          return (
            <Message key={message.id} from="assistant">
              <MessageContent>
                {toolCalls.length > 0 && (
                  <ToolCallGroup toolCalls={toolCalls} />
                )}
                {cleanText && (
                  <MessageResponse mode="static">
                    {cleanText}
                  </MessageResponse>
                )}
                {codeBlockInfos.map((info, i) => (
                  <ArtifactCard
                    key={i}
                    info={info}
                    onOpen={() => handleOpenPreview(info.code)}
                  />
                ))}
              </MessageContent>
            </Message>
          );
        })}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
