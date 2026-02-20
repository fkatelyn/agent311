"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { ChatMessage } from "@/lib/types";
import { Sidebar, type SidebarMode } from "@/components/sidebar";
import { ChatMessages } from "@/components/chat-messages";
import { ChatInput } from "@/components/chat-input";
import { ArtifactPanel } from "@/components/artifact-panel";
import { API_URL } from "@/lib/config";
import { isLoggedIn, authFetch, logout } from "@/lib/auth";
import {
  type ApiSession,
  fetchSessions,
  fetchSession,
  createSessionApi,
  deleteSessionApi,
  updateSessionTitle,
  toggleFavoriteApi,
  titleFromFirstMessage,
} from "@/lib/session-api";
import {
  type ReportFile,
  fetchReports,
  fetchReportContent,
  downloadReport,
  uploadReport,
  deleteReportApi,
} from "@/lib/reports-api";
import { UploadIcon } from "lucide-react";

const VIEW_CONTENT_TOOL_RE = /\[Using tool:\s*view_content\s+([^\]\n]+)\](?:\\n|\n)?/g;
const SAVE_REPORT_TOOL_RE = /\[Using tool:\s*save_report\s+([^\]\n]+)\](?:\\n|\n)?/g;

interface FetchFileResponse {
  path: string;
  language: string;
  sizeBytes: number;
  content: string;
}

interface LocalSession {
  id: string;
  title: string;
  createdAt: string | null;
  updatedAt: string | null;
  isFavorite: boolean;
}

function normalizeToolPath(rawPath: string): string {
  return rawPath.trim().replace(/^['"]|['"]$/g, "");
}

function extractViewContentPaths(text: string): string[] {
  const matches: string[] = [];
  const seen = new Set<string>();
  const re = new RegExp(VIEW_CONTENT_TOOL_RE.source, VIEW_CONTENT_TOOL_RE.flags);
  let match: RegExpExecArray | null;

  while ((match = re.exec(text)) !== null) {
    const normalized = normalizeToolPath(match[1] ?? "");
    if (normalized && !seen.has(normalized)) {
      seen.add(normalized);
      matches.push(normalized);
    }
  }

  return matches;
}

function hasSaveReportTool(text: string): boolean {
  return SAVE_REPORT_TOOL_RE.test(text);
}

function buildArtifactCodeFence(file: FetchFileResponse): string {
  return `\n\n\`\`\`${file.language}\n${file.content}\n\`\`\`\n`;
}

export function Chat() {
  const router = useRouter();
  const [sessions, setSessions] = useState<LocalSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [currentTitle, setCurrentTitle] = useState("New Chat");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [artifactCode, setArtifactCode] = useState<string | null>(null);
  const [activeReport, setActiveReport] = useState<ReportFile | null>(null);
  const [sidebarMode, setSidebarMode] = useState<SidebarMode>("chats");
  const [sidebarWidth, setSidebarWidth] = useState(256);
  const [reports, setReports] = useState<ReportFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const dragCounter = useRef(0);

  // Auth check + load sessions on mount
  useEffect(() => {
    if (!isLoggedIn()) {
      router.replace("/login");
      return;
    }
    loadSessions();
    refreshReports();
  }, [router]);

  async function refreshReports() {
    try {
      const loaded = await fetchReports();
      setReports(loaded);
    } catch {
      // ignore
    }
  }

  async function loadSessions() {
    try {
      const loaded = await fetchSessions();
      setSessions(loaded);
      if (loaded.length > 0) {
        setCurrentSessionId(loaded[0].id);
        setCurrentTitle(loaded[0].title);
        // Load messages for first session
        const full = await fetchSession(loaded[0].id);
        setMessages(full.messages ?? []);
      } else {
        // Create a new session
        const id = crypto.randomUUID();
        await createSessionApi(id, "New Chat");
        const refreshed = await fetchSessions();
        setSessions(refreshed);
        setCurrentSessionId(id);
        setCurrentTitle("New Chat");
        setMessages([]);
      }
    } catch {
      // If fetch fails (e.g. token expired), redirect to login
      router.replace("/login");
    }
  }

  async function refreshSessionList() {
    try {
      const loaded = await fetchSessions();
      setSessions(loaded);
    } catch {
      // ignore
    }
  }

  const handleNewChat = useCallback(async () => {
    const id = crypto.randomUUID();
    try {
      await createSessionApi(id, "New Chat");
      setCurrentSessionId(id);
      setCurrentTitle("New Chat");
      setMessages([]);
      setArtifactCode(null);
      setActiveReport(null);
      setSidebarMode("chats");
      await refreshSessionList();
    } catch {
      // ignore
    }
  }, []);

  const handleSelectSession = useCallback(async (id: string) => {
    try {
      const full = await fetchSession(id);
      setCurrentSessionId(id);
      setCurrentTitle(full.title);
      setMessages(full.messages ?? []);
      setArtifactCode(null);
      setActiveReport(null);
    } catch {
      // ignore
    }
  }, []);

  const handleDeleteSession = useCallback(
    async (id: string) => {
      try {
        await deleteSessionApi(id);
        const remaining = await fetchSessions();
        setSessions(remaining);
        if (currentSessionId === id) {
          if (remaining.length > 0) {
            const full = await fetchSession(remaining[0].id);
            setCurrentSessionId(remaining[0].id);
            setCurrentTitle(remaining[0].title);
            setMessages(full.messages ?? []);
          } else {
            await handleNewChat();
          }
        }
      } catch {
        // ignore
      }
    },
    [currentSessionId, handleNewChat]
  );

  const handleRenameSession = useCallback(
    async (id: string, title: string) => {
      try {
        await updateSessionTitle(id, title);
        if (id === currentSessionId) setCurrentTitle(title);
        await refreshSessionList();
      } catch {
        // ignore
      }
    },
    [currentSessionId]
  );

  const handleToggleFavorite = useCallback(
    async (id: string, isFavorite: boolean) => {
      try {
        await toggleFavoriteApi(id, isFavorite);
        await refreshSessionList();
      } catch {
        // ignore
      }
    },
    []
  );

  const handleLogout = useCallback(() => {
    logout();
    router.replace("/login");
  }, [router]);

  const handleStop = useCallback(() => {
    abortRef.current?.abort();
    setIsStreaming(false);
  }, []);

  const handleSelectReport = useCallback(async (report: ReportFile) => {
    if (report.type === "pdf") {
      try {
        await downloadReport(report.path, report.name);
      } catch {
        // ignore download errors
      }
      return;
    }
    try {
      const data = await fetchReportContent(report.path);
      if (data.encoding === "base64" && report.type === "png") {
        setArtifactCode(`data:image/png;base64,${data.content}`);
      } else {
        setArtifactCode(data.content);
      }
      setActiveReport(report);
    } catch {
      // ignore
    }
  }, []);

  const handleUploadFile = useCallback(async (file: File) => {
    try {
      await uploadReport(file);
      await refreshReports();
      setSidebarMode("files");
      setSidebarOpen(true);
    } catch {
      // ignore
    }
  }, []);

  const handleDeleteReport = useCallback(async (report: ReportFile) => {
    try {
      await deleteReportApi(report.name);
      await refreshReports();
      // If the deleted report is currently displayed, close the artifact panel
      if (activeReport?.path === report.path) {
        setArtifactCode(null);
        setActiveReport(null);
      }
    } catch {
      // ignore
    }
  }, [activeReport]);

  const handleSubmit = useCallback(
    async (text: string) => {
      if (!text.trim() || !currentSessionId) return;

      const userMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content: text,
      };

      const updatedMessages = [...messages, userMessage];
      setMessages(updatedMessages);
      setInput("");

      // Update title from first message
      const isFirstMessage = messages.length === 0;
      if (isFirstMessage) {
        const newTitle = titleFromFirstMessage(text);
        setCurrentTitle(newTitle);
        updateSessionTitle(currentSessionId, newTitle).catch(() => {});
      }

      // Create assistant message placeholder
      const assistantId = crypto.randomUUID();
      const assistantMessage: ChatMessage = {
        id: assistantId,
        role: "assistant",
        content: "",
      };

      const allMessages = [...updatedMessages, assistantMessage];
      setMessages(allMessages);
      setIsStreaming(true);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const res = await authFetch(`${API_URL}/api/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: updatedMessages.map((m) => ({
              role: m.role,
              content: m.content,
            })),
            session_id: currentSessionId,
            user_msg_id: userMessage.id,
            assistant_msg_id: assistantId,
          }),
          signal: controller.signal,
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const reader = res.body?.getReader();
        if (!reader) throw new Error("No response body");

        const decoder = new TextDecoder();
        let buffer = "";
        let fullText = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const payload = line.slice(6);
            if (payload === "[DONE]") continue;

            try {
              const event = JSON.parse(payload);
              if (event.type === "text-delta" && event.delta) {
                fullText += event.delta;
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId
                      ? { ...m, content: fullText }
                      : m
                  )
                );
              }
            } catch {
              // skip unparseable lines
            }
          }
        }

        const viewContentPaths = extractViewContentPaths(fullText);
        let finalText = fullText;

        for (const path of viewContentPaths) {
          try {
            const fetchRes = await fetch(
              `${API_URL}/api/fetch_file?path=${encodeURIComponent(path)}`
            );
            if (!fetchRes.ok) {
              finalText += `\n\nFailed to fetch preview content for ${path} (HTTP ${fetchRes.status}).`;
              continue;
            }

            const file = (await fetchRes.json()) as FetchFileResponse;
            if (typeof file.content === "string" && file.content.length > 0) {
              finalText += buildArtifactCodeFence(file);
            }
          } catch {
            finalText += `\n\nFailed to fetch preview content for ${path}.`;
          }
        }

        // Update local state with final text
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, content: finalText } : m
          )
        );

        // If code blocks were appended, persist the updated content to DB
        if (finalText !== fullText) {
          authFetch(`${API_URL}/api/messages/${assistantId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ content: finalText }),
          }).catch(() => {});
        }

        // If save_report was used, refresh reports and switch sidebar to files
        if (hasSaveReportTool(fullText)) {
          await refreshReports();
          setSidebarMode("files");
        }

        // Refresh session list to pick up updated timestamps
        await refreshSessionList();
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          const errorText = `Error: ${(err as Error).message}`;
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? { ...m, content: errorText }
                : m
            )
          );
        }
      } finally {
        setIsStreaming(false);
        abortRef.current = null;
      }
    },
    [currentSessionId, messages]
  );

  // Build session objects compatible with sidebar
  const sidebarSessions = sessions.map((s) => ({
    id: s.id,
    title: s.id === currentSessionId ? currentTitle : s.title,
    messages: [] as ChatMessage[],
    createdAt: s.createdAt ? new Date(s.createdAt).getTime() : Date.now(),
    updatedAt: s.updatedAt ? new Date(s.updatedAt).getTime() : Date.now(),
    isFavorite: s.isFavorite,
  }));

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    if (dragCounter.current === 1) setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current === 0) setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounter.current = 0;
      setIsDragging(false);

      const files = Array.from(e.dataTransfer.files);
      const allowed = files.filter((f) => {
        const ext = f.name.toLowerCase().match(/\.[^.]+$/)?.[0];
        return ext === ".pdf" || ext === ".html";
      });
      for (const file of allowed) {
        handleUploadFile(file);
      }
    },
    [handleUploadFile]
  );

  return (
    <div
      className="flex h-dvh overflow-hidden bg-background relative"
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {isDragging && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3 rounded-xl border-2 border-dashed border-primary/50 bg-muted/50 px-12 py-10">
            <UploadIcon className="h-10 w-10 text-primary/70" />
            <p className="text-sm font-medium text-muted-foreground">
              Drop PDF or HTML files to upload
            </p>
          </div>
        </div>
      )}
      <Sidebar
        sessions={sidebarSessions}
        currentSessionId={currentSessionId}
        open={sidebarOpen}
        onToggle={() => setSidebarOpen((o) => !o)}
        onNewChat={handleNewChat}
        onSelectSession={handleSelectSession}
        onDeleteSession={handleDeleteSession}
        onRenameSession={handleRenameSession}
        onToggleFavorite={handleToggleFavorite}
        onLogout={handleLogout}
        mode={sidebarMode}
        onModeChange={setSidebarMode}
        reports={reports}
        onSelectReport={handleSelectReport}
        onUploadFile={handleUploadFile}
        onDeleteReport={handleDeleteReport}
        width={sidebarWidth}
        onWidthChange={setSidebarWidth}
      />

      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header bar for mobile toggle */}
        {!sidebarOpen && (
          <div className="flex items-center border-b px-4 py-2">
            <button
              onClick={() => setSidebarOpen(true)}
              className="rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
            <span className="ml-3 text-sm font-medium">
              {currentTitle ?? "Agent Austin"}
            </span>
          </div>
        )}

        <div className="flex flex-1 overflow-hidden">
          {/* Chat area */}
          <div className="flex flex-1 flex-col overflow-hidden">
            <ChatMessages
              messages={messages}
              isStreaming={isStreaming}
              onOpenPreview={(code) => {
                setArtifactCode(code);
                setActiveReport(null);
              }}
            />
            <ChatInput
              input={input}
              setInput={setInput}
              isStreaming={isStreaming}
              onSubmit={handleSubmit}
              onStop={handleStop}
            />
          </div>

          {/* Artifact panel */}
          {artifactCode && (
            <ArtifactPanel
              code={artifactCode}
              onClose={() => {
                setArtifactCode(null);
                setActiveReport(null);
              }}
              reportName={activeReport?.name}
              reportPath={activeReport?.path}
            />
          )}
        </div>
      </div>
    </div>
  );
}
