import { API_URL } from "@/lib/config";
import { authFetch } from "@/lib/auth";
import type { ChatMessage } from "@/lib/types";

export interface ApiSession {
  id: string;
  title: string;
  createdAt: string | null;
  updatedAt: string | null;
  isFavorite: boolean;
  messages?: ChatMessage[];
}

export async function fetchSessions(): Promise<ApiSession[]> {
  const res = await authFetch(`${API_URL}/api/sessions`);
  if (!res.ok) throw new Error(`Failed to fetch sessions: ${res.status}`);
  return res.json();
}

export async function fetchSession(id: string): Promise<ApiSession> {
  const res = await authFetch(`${API_URL}/api/sessions/${id}`);
  if (!res.ok) throw new Error(`Failed to fetch session: ${res.status}`);
  return res.json();
}

export async function createSessionApi(
  id: string,
  title: string = "New Chat"
): Promise<ApiSession> {
  const res = await authFetch(`${API_URL}/api/sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, title }),
  });
  if (!res.ok) throw new Error(`Failed to create session: ${res.status}`);
  return res.json();
}

export async function updateSessionTitle(
  id: string,
  title: string
): Promise<void> {
  const res = await authFetch(`${API_URL}/api/sessions/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title }),
  });
  if (!res.ok) throw new Error(`Failed to update session: ${res.status}`);
}

export async function toggleFavoriteApi(
  id: string,
  isFavorite: boolean
): Promise<void> {
  const res = await authFetch(`${API_URL}/api/sessions/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ is_favorite: isFavorite }),
  });
  if (!res.ok) throw new Error(`Failed to toggle favorite: ${res.status}`);
}

export async function deleteSessionApi(id: string): Promise<void> {
  const res = await authFetch(`${API_URL}/api/sessions/${id}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error(`Failed to delete session: ${res.status}`);
}

export function titleFromFirstMessage(text: string): string {
  const trimmed = text.trim().slice(0, 60);
  return trimmed.length < text.trim().length ? trimmed + "..." : trimmed;
}
