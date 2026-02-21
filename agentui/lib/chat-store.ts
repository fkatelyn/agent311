import type { ChatMessage } from "@/lib/types";
import { uuid } from "@/lib/utils";

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}

const STORAGE_KEY = "agentui-sessions";

function readSessions(): ChatSession[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeSessions(sessions: ChatSession[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
}

export function getSessions(): ChatSession[] {
  return readSessions().sort((a, b) => b.updatedAt - a.updatedAt);
}

export function getSession(id: string): ChatSession | undefined {
  return readSessions().find((s) => s.id === id);
}

export function saveSession(session: ChatSession) {
  const sessions = readSessions();
  const idx = sessions.findIndex((s) => s.id === session.id);
  if (idx >= 0) {
    sessions[idx] = session;
  } else {
    sessions.push(session);
  }
  writeSessions(sessions);
}

export function deleteSession(id: string) {
  writeSessions(readSessions().filter((s) => s.id !== id));
}

export function createSession(): ChatSession {
  return {
    id: uuid(),
    title: "New Chat",
    messages: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

export function titleFromFirstMessage(text: string): string {
  const trimmed = text.trim().slice(0, 60);
  return trimmed.length < text.trim().length ? trimmed + "..." : trimmed;
}
