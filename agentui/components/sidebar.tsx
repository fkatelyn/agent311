"use client";

import { cn } from "@/lib/utils";
import type { ChatSession } from "@/lib/chat-store";
import { Button } from "@/components/ui/button";
import {
  ModelSelector,
  ModelSelectorTrigger,
  ModelSelectorContent,
  ModelSelectorInput,
  ModelSelectorList,
  ModelSelectorEmpty,
  ModelSelectorGroup,
  ModelSelectorItem,
  ModelSelectorLogo,
  ModelSelectorName,
} from "@/components/ai-elements/model-selector";
import {
  PlusIcon,
  Trash2Icon,
  PanelLeftCloseIcon,
  MessageSquareIcon,
  ChevronDownIcon,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface SidebarProps {
  sessions: ChatSession[];
  currentSessionId: string | null;
  open: boolean;
  onToggle: () => void;
  onNewChat: () => void;
  onSelectSession: (id: string) => void;
  onDeleteSession: (id: string) => void;
}

export function Sidebar({
  sessions,
  currentSessionId,
  open,
  onToggle,
  onNewChat,
  onSelectSession,
  onDeleteSession,
}: SidebarProps) {
  if (!open) return null;

  return (
    <div className="flex h-full w-64 flex-col border-r bg-muted/30">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-3 py-3">
        <span className="text-sm font-semibold">Agent 311</span>
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
          {sessions.map((session) => (
            <div
              key={session.id}
              className={cn(
                "group flex items-center gap-2 rounded-md px-2 py-1.5 text-sm cursor-pointer",
                session.id === currentSessionId
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
              )}
              onClick={() => onSelectSession(session.id)}
            >
              <MessageSquareIcon className="h-3.5 w-3.5 shrink-0" />
              <span className="flex-1 truncate">{session.title}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteSession(session.id);
                }}
                className="hidden shrink-0 rounded p-0.5 text-muted-foreground hover:text-destructive group-hover:block"
              >
                <Trash2Icon className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      </ScrollArea>

      {/* Model selector (placeholder) */}
      <div className="border-t p-3">
        <ModelSelector>
          <ModelSelectorTrigger asChild>
            <Button
              variant="outline"
              className="w-full justify-between text-sm"
            >
              <div className="flex items-center gap-2">
                <ModelSelectorLogo provider="anthropic" />
                <span>Claude (Agent 311)</span>
              </div>
              <ChevronDownIcon className="h-3.5 w-3.5 text-muted-foreground" />
            </Button>
          </ModelSelectorTrigger>
          <ModelSelectorContent>
            <ModelSelectorInput placeholder="Search models..." />
            <ModelSelectorList>
              <ModelSelectorEmpty>No models found.</ModelSelectorEmpty>
              <ModelSelectorGroup heading="Available">
                <ModelSelectorItem value="claude">
                  <ModelSelectorLogo provider="anthropic" />
                  <ModelSelectorName>Claude (Agent 311)</ModelSelectorName>
                </ModelSelectorItem>
              </ModelSelectorGroup>
            </ModelSelectorList>
          </ModelSelectorContent>
        </ModelSelector>
      </div>
    </div>
  );
}
