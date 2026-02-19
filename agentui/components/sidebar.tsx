"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import type { ChatSession } from "@/lib/chat-store";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  PlusIcon,
  Trash2Icon,
  PanelLeftCloseIcon,
  MessageSquareIcon,
  LogOutIcon,
  StarIcon,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface SidebarProps {
  sessions: (ChatSession & { isFavorite?: boolean })[];
  currentSessionId: string | null;
  open: boolean;
  onToggle: () => void;
  onNewChat: () => void;
  onSelectSession: (id: string) => void;
  onDeleteSession: (id: string) => void;
  onToggleFavorite: (id: string, isFavorite: boolean) => void;
  onLogout?: () => void;
}

export function Sidebar({
  sessions,
  currentSessionId,
  open,
  onToggle,
  onNewChat,
  onSelectSession,
  onDeleteSession,
  onToggleFavorite,
  onLogout,
}: SidebarProps) {
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  if (!open) return null;

  const favorites = sessions.filter((s) => s.isFavorite);
  const recent = sessions.filter((s) => !s.isFavorite);

  function renderSession(session: (typeof sessions)[number]) {
    const isFav = !!session.isFavorite;
    return (
      <div
        key={session.id}
        className={cn(
          "group flex min-w-0 items-center gap-2 rounded-md px-2 py-1.5 text-sm cursor-pointer",
          session.id === currentSessionId
            ? "bg-accent text-accent-foreground"
            : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
        )}
        onClick={() => onSelectSession(session.id)}
      >
        <MessageSquareIcon className="h-3.5 w-3.5 shrink-0" />
        <span className="min-w-0 flex-1 truncate">{session.title}</span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite(session.id, !isFav);
          }}
          className={cn(
            "shrink-0 rounded p-0.5",
            isFav
              ? "text-yellow-500"
              : "text-muted-foreground/40 hover:text-yellow-500"
          )}
        >
          <StarIcon
            className="h-3.5 w-3.5"
            fill={isFav ? "currentColor" : "none"}
          />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setDeleteTargetId(session.id);
          }}
          className="shrink-0 rounded p-0.5 text-muted-foreground/40 hover:text-destructive"
        >
          <Trash2Icon className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-full w-64 flex-col border-r bg-muted/30">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-3 py-3">
        <span className="text-sm font-semibold">Agent Austin</span>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={onNewChat} className="h-7 w-7">
            <PlusIcon className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={onToggle} className="h-7 w-7">
            <PanelLeftCloseIcon className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Session list */}
      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-0.5 p-2">
          {favorites.length > 0 && (
            <>
              <span className="px-2 pt-1 pb-0.5 text-xs font-medium text-muted-foreground">
                Favorites
              </span>
              {favorites.map(renderSession)}
              <span className="px-2 pt-2 pb-0.5 text-xs font-medium text-muted-foreground">
                Recent
              </span>
            </>
          )}
          {recent.map(renderSession)}
        </div>
      </ScrollArea>

      {/* Footer with logout */}
      <div className="border-t p-3">
        {onLogout && (
          <Button
            variant="ghost"
            className="w-full justify-start gap-2 text-sm text-muted-foreground hover:text-foreground"
            onClick={onLogout}
          >
            <LogOutIcon className="h-4 w-4" />
            Log Out
          </Button>
        )}
      </div>
      <Dialog open={deleteTargetId !== null} onOpenChange={() => setDeleteTargetId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete chat?</DialogTitle>
            <DialogDescription>
              This will permanently delete this chat session.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button
              variant="destructive"
              onClick={() => {
                if (deleteTargetId) onDeleteSession(deleteTargetId);
                setDeleteTargetId(null);
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
