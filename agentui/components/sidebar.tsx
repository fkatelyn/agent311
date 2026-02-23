"use client";

import { useCallback, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { ChatSession } from "@/lib/chat-store";
import type { ReportFile } from "@/lib/reports-api";
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
  FileTree,
  FileTreeFolder,
} from "@/components/ai-elements/file-tree";
import {
  PlusIcon,
  Trash2Icon,
  PanelLeftCloseIcon,
  MessageSquareIcon,
  LogOutIcon,
  StarIcon,
  FolderOpenIcon,
  FileTextIcon,
  ImageIcon,
  TableIcon,
  UploadIcon,
  MoreHorizontalIcon,
  PencilIcon,
  ExternalLinkIcon,
  DownloadIcon,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { API_URL } from "@/lib/config";
import { authFetch } from "@/lib/auth";

export type SidebarMode = "chats" | "files";

interface SidebarProps {
  sessions: (ChatSession & { isFavorite?: boolean })[];
  currentSessionId: string | null;
  open: boolean;
  onToggle: () => void;
  onNewChat: () => void;
  onSelectSession: (id: string) => void;
  onDeleteSession: (id: string) => void;
  onRenameSession: (id: string, title: string) => void;
  onToggleFavorite: (id: string, isFavorite: boolean) => void;
  onLogout?: () => void;
  mode: SidebarMode;
  onModeChange: (mode: SidebarMode) => void;
  reports: ReportFile[];
  onSelectReport: (report: ReportFile) => void;
  onUploadFile: (file: File) => void;
  onDeleteReport: (report: ReportFile) => void;
  onRenameReport: (report: ReportFile, newName: string) => void;
  width: number;
  onWidthChange: (width: number) => void;
}

function fileIcon(type: string) {
  switch (type) {
    case "html":
      return <FileTextIcon className="size-4 text-orange-400" />;
    case "png":
      return <ImageIcon className="size-4 text-green-400" />;
    case "csv":
      return <TableIcon className="size-4 text-blue-400" />;
    case "pdf":
      return <FileTextIcon className="size-4 text-red-400" />;
    default:
      return undefined;
  }
}

export function Sidebar({
  sessions,
  currentSessionId,
  open,
  onToggle,
  onNewChat,
  onSelectSession,
  onDeleteSession,
  onRenameSession,
  onToggleFavorite,
  onLogout,
  mode,
  onModeChange,
  reports,
  onSelectReport,
  onUploadFile,
  onDeleteReport,
  onRenameReport,
  width,
  onWidthChange,
}: SidebarProps) {
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [renameTarget, setRenameTarget] = useState<{ id: string; title: string } | null>(null);
  const [deleteReportTarget, setDeleteReportTarget] = useState<ReportFile | null>(null);
  const [renameReportTarget, setRenameReportTarget] = useState<{ report: ReportFile; newName: string } | null>(null);
  const dragging = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;
    const onMouseMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      onWidthChange(Math.min(480, Math.max(200, e.clientX)));
    };
    const onMouseUp = () => {
      dragging.current = false;
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  }, [onWidthChange]);

  if (!open) return null;

  const favorites = sessions.filter((s) => s.isFavorite);
  const recent = sessions.filter((s) => !s.isFavorite);

  function renderSession(session: (typeof sessions)[number]) {
    const isFav = !!session.isFavorite;
    return (
      <div
        key={session.id}
        className={cn(
          "group grid w-full items-center gap-1 rounded-md px-2 py-1.5 text-sm cursor-pointer",
          isFav ? "grid-cols-[auto_1fr_auto]" : "grid-cols-[1fr_auto]",
          session.id === currentSessionId
            ? "bg-accent text-accent-foreground"
            : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
        )}
        onClick={() => onSelectSession(session.id)}
      >
        {isFav && (
          <StarIcon className="h-3 w-3 text-yellow-500" fill="currentColor" />
        )}
        <span className="truncate">{session.title}</span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              onClick={(e) => e.stopPropagation()}
              className="rounded p-0.5 opacity-0 group-hover:opacity-100 data-[state=open]:opacity-100 text-muted-foreground hover:text-foreground"
            >
              <MoreHorizontalIcon className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" side="right">
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation();
                setRenameTarget({ id: session.id, title: session.title });
              }}
            >
              <PencilIcon className="h-4 w-4" />
              Rename
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation();
                onToggleFavorite(session.id, !isFav);
              }}
            >
              <StarIcon className="h-4 w-4" fill={isFav ? "currentColor" : "none"} />
              {isFav ? "Unfavorite" : "Favorite"}
            </DropdownMenuItem>
            <DropdownMenuItem
              variant="destructive"
              onClick={(e) => {
                e.stopPropagation();
                setDeleteTargetId(session.id);
              }}
            >
              <Trash2Icon className="h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  }

  return (
    <div className="relative flex h-full min-w-0 flex-col border-r bg-muted/30 overflow-hidden" style={{ width }}>
      {/* Drag handle */}
      <div
        onMouseDown={handleMouseDown}
        className="absolute -right-1 top-0 z-10 flex h-full w-3 cursor-col-resize items-center justify-center hover:bg-primary/10"
      >
        <div className="h-8 w-1 rounded-full bg-muted-foreground/40" />
      </div>
      {/* Header */}
      <div className="flex items-center justify-between border-b px-3 py-3">
        <span className="text-sm font-semibold">Agent Austin</span>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onModeChange(mode === "chats" ? "files" : "chats")}
            className={cn("h-7 w-7", mode === "files" && "bg-accent text-accent-foreground")}
            title={mode === "chats" ? "View reports" : "View chats"}
          >
            <FolderOpenIcon className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={mode === "files" ? () => fileInputRef.current?.click() : onNewChat}
            className="h-7 w-7"
            title={mode === "files" ? "Upload file" : "New chat"}
          >
            {mode === "files" ? <UploadIcon className="h-4 w-4" /> : <PlusIcon className="h-4 w-4" />}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.html"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onUploadFile(file);
              e.target.value = "";
            }}
          />
          <Button variant="ghost" size="icon" onClick={onToggle} className="h-7 w-7">
            <PanelLeftCloseIcon className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Content area */}
      <ScrollArea className="flex-1">
        {mode === "chats" ? (
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
        ) : (
          <div className="p-2">
            <FileTree
              defaultExpanded={new Set(["reports"])}
              className="border-0 bg-transparent"
            >
              <FileTreeFolder path="reports" name="Reports">
                {reports.length === 0 ? (
                  <p className="px-2 py-2 text-xs text-muted-foreground">
                    No reports yet.
                  </p>
                ) : (
                  reports.map((r) => (
                    <div
                      key={r.path}
                      className="group grid w-full grid-cols-[auto_1fr_auto] items-center gap-1 rounded px-2 py-1 text-sm cursor-pointer transition-colors hover:bg-muted/50"
                      onClick={() => onSelectReport(r)}
                    >
                      <span className="shrink-0">{fileIcon(r.type)}</span>
                      <span className="truncate">{r.name}</span>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            onClick={(e) => e.stopPropagation()}
                            className="rounded p-0.5 opacity-0 group-hover:opacity-100 data-[state=open]:opacity-100 text-muted-foreground hover:text-foreground"
                          >
                            <MoreHorizontalIcon className="h-4 w-4" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" side="right">
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectReport(r);
                            }}
                          >
                            <ExternalLinkIcon className="h-4 w-4" />
                            Open
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={async (e) => {
                              e.stopPropagation();
                              try {
                                const res = await authFetch(
                                  `${API_URL}/api/reports/download?path=${encodeURIComponent(r.path)}`
                                );
                                const blob = await res.blob();
                                const url = URL.createObjectURL(blob);
                                const a = document.createElement("a");
                                a.href = url;
                                a.download = r.name;
                                a.click();
                                URL.revokeObjectURL(url);
                              } catch {
                                // ignore download errors
                              }
                            }}
                          >
                            <DownloadIcon className="h-4 w-4" />
                            Download
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              setRenameReportTarget({ report: r, newName: r.name });
                            }}
                          >
                            <PencilIcon className="h-4 w-4" />
                            Rename
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            variant="destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteReportTarget(r);
                            }}
                          >
                            <Trash2Icon className="h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  ))
                )}
              </FileTreeFolder>
            </FileTree>
          </div>
        )}
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
      {/* Delete chat dialog */}
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

      {/* Rename chat dialog */}
      <Dialog open={renameTarget !== null} onOpenChange={() => setRenameTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename chat</DialogTitle>
            <DialogDescription>Enter a new name for this chat.</DialogDescription>
          </DialogHeader>
          <Input
            value={renameTarget?.title ?? ""}
            onChange={(e) =>
              setRenameTarget((prev) => prev ? { ...prev, title: e.target.value } : null)
            }
            onKeyDown={(e) => {
              if (e.key === "Enter" && renameTarget?.title.trim()) {
                onRenameSession(renameTarget.id, renameTarget.title.trim());
                setRenameTarget(null);
              }
            }}
            autoFocus
          />
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button
              onClick={() => {
                if (renameTarget?.title.trim()) {
                  onRenameSession(renameTarget.id, renameTarget.title.trim());
                }
                setRenameTarget(null);
              }}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete report dialog */}
      <Dialog open={deleteReportTarget !== null} onOpenChange={() => setDeleteReportTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete file?</DialogTitle>
            <DialogDescription>
              This will permanently delete <span className="font-medium">{deleteReportTarget?.name}</span>.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button
              variant="destructive"
              onClick={() => {
                if (deleteReportTarget) onDeleteReport(deleteReportTarget);
                setDeleteReportTarget(null);
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename report dialog */}
      <Dialog open={renameReportTarget !== null} onOpenChange={() => setRenameReportTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename file</DialogTitle>
            <DialogDescription>Enter a new name for this file.</DialogDescription>
          </DialogHeader>
          <Input
            value={renameReportTarget?.newName ?? ""}
            onChange={(e) =>
              setRenameReportTarget((prev) => prev ? { ...prev, newName: e.target.value } : null)
            }
            onKeyDown={(e) => {
              if (e.key === "Enter" && renameReportTarget?.newName.trim()) {
                onRenameReport(renameReportTarget.report, renameReportTarget.newName.trim());
                setRenameReportTarget(null);
              }
            }}
            autoFocus
          />
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button
              onClick={() => {
                if (renameReportTarget?.newName.trim()) {
                  onRenameReport(renameReportTarget.report, renameReportTarget.newName.trim());
                }
                setRenameReportTarget(null);
              }}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
