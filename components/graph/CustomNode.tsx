import { memo, useCallback, useLayoutEffect, useRef, useState } from "react";
import { Handle, Position } from "reactflow";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { NodeDTO, ManualStatus } from "@/types";
import { CreateRequestDialog } from "./CreateRequestDialog";
import { cn } from "@/lib/utils";
import {
  User,
  Clock,
  Calendar,
  Plus,
  Ban,
  PanelRightOpen,
  CheckCircle2,
  PlayCircle,
  MessageSquarePlus,
  Layers,
  CornerUpLeft,
  FolderPlus,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { statusVisual, typeVisual } from "@/lib/ui/node-visuals";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useUpdateNode } from "@/hooks/use-node-mutations";

interface Member {
  userId: string;
  userName: string | null;
  teamId: string | null;
  teamName: string | null;
}

interface CustomNodeProps {
  data: {
    node: NodeDTO;
    projectId: string;
    onDataChange: () => void;
    blockedBy: string[];
    blocking: string[];
    isFaded?: boolean;
    isDragging?: boolean;
    isDropTarget?: boolean;
    isDetachTarget?: boolean;
    onOpenDetail?: () => void;
    onCreateChild?: () => void;
    onDetachFromParent?: () => void;
    onPendingSaveChange?: (delta: number) => void;
  };
  selected?: boolean;
}

function getInitials(name: string | null) {
  if (!name) return "??";
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export const CustomNode = memo(({ data, selected }: CustomNodeProps) => {
  const {
    node,
    projectId,
    onDataChange,
    isFaded,
    isDragging,
    isDropTarget,
    isDetachTarget,
    onOpenDetail,
    onCreateChild,
    onDetachFromParent,
    onPendingSaveChange,
  } = data;
  const [createRequestOpen, setCreateRequestOpen] = useState(false);
  const updateNodeMutation = useUpdateNode();

  // Editing state
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState(node.title);

  // Metadata
  const [members, setMembers] = useState<Member[]>([]);
  const [hasLoadedMetadata, setHasLoadedMetadata] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const collapsedContentRef = useRef<HTMLDivElement | null>(null);
  const [handleTop, setHandleTop] = useState<number | null>(null);

  const fetchMetadata = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/members`);
      if (res.ok) {
        const data = await res.json();
        setMembers(data.members || []);
        setHasLoadedMetadata(true);
      }
    } catch (error) {
      console.error("Failed to fetch node metadata:", error);
    }
  }, [projectId]);

  // Updating Logic
  const updateNode = async (updates: Partial<NodeDTO> & { ownerIds?: string[] }, e?: React.MouseEvent | React.FocusEvent | React.KeyboardEvent) => {
    if (e) e.stopPropagation();
    onPendingSaveChange?.(1);
    updateNodeMutation.mutate({
      nodeId: node.id,
      projectId,
      updates
    }, {
      onSettled: () => onPendingSaveChange?.(-1)
    });
  };

  const handleTitleSave = async () => {
    if (editedTitle === node.title) {
      setIsEditingTitle(false);
      return;
    }
    await updateNode({ title: editedTitle });
    setIsEditingTitle(false);
  };

  const handleStatusClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    // Simple status cycle for now
    const map: Record<string, ManualStatus> = { 'TODO': 'DOING', 'DOING': 'DONE', 'DONE': 'TODO' };
    const next = map[node.manualStatus] || 'TODO';
    updateNode({ manualStatus: next });
  };

  // derived values
  const primaryOwner = node.owners?.[0];
  const hasNoOwner = !primaryOwner;
  const isBlocked = node.computedStatus === "BLOCKED";
  const isDone = node.computedStatus === "DONE";
  const childCount = node.childCount || 0;
  const isContainer = childCount > 0;
  const sv = statusVisual(node.computedStatus);
  const StatusIcon = sv.icon;
  const tv = typeVisual(node.type);
  const TypeIcon = tv.icon;

  useLayoutEffect(() => {
    if (isContainer) return;

    const root = rootRef.current;
    const collapsedContent = collapsedContentRef.current;
    if (!root || !collapsedContent) return;

    const updateHandleTop = () => {
      const rootRect = root.getBoundingClientRect();
      const collapsedRect = collapsedContent.getBoundingClientRect();
      const nextHandleTop = collapsedRect.top - rootRect.top + collapsedRect.height / 2;
      setHandleTop((current) => Math.abs((current ?? 0) - nextHandleTop) > 0.5 ? nextHandleTop : current);
    };

    updateHandleTop();

    const resizeObserver = new ResizeObserver(updateHandleTop);
    resizeObserver.observe(root);
    resizeObserver.observe(collapsedContent);

    return () => resizeObserver.disconnect();
  }, [isContainer, node.title, node.computedStatus, node.dueAt, node.blocksCount, node.owners, node.teams]);

  const handleStyle = isContainer
    ? undefined
    : {
      top: handleTop === null ? "4rem" : `${handleTop}px`,
    };

  return (
    <div
      ref={rootRef}
      className={cn(
        "overflow-hidden rounded-md border bg-white shadow-sm transition-all duration-200 will-change-transform",
        isContainer ? "w-full h-full min-w-[320px] bg-slate-50/90 border-indigo-200" : "w-[264px] border-slate-200",
        // Hover
        !selected && "hover:border-slate-300 hover:shadow-md",
        // Selection state (brand accent)
        selected && "border-brand ring-2 ring-brand/30 z-50",
        // Faded state (filtering)
        isFaded && "opacity-30 grayscale-[0.8] pointer-events-none",
        // Status emphasis — only BLOCKED gets a left accent; DONE is muted
        isBlocked && "border-l-2 border-l-red-400",
        isDone && !selected && "opacity-70",
        // Interaction states (calm, single-accent)
        isDropTarget && "border-brand bg-brand-muted ring-2 ring-brand/40 shadow-lg",
        isDragging && "cursor-grabbing opacity-95 ring-1 ring-brand/40 shadow-lg",
        isDetachTarget && "border-amber-400 bg-amber-50 ring-2 ring-amber-300/60 shadow-lg"
      )}
    >

      {/* Left Handle (Input) */}
      <Handle
        type="target"
        position={Position.Left}
        style={handleStyle}
        className={cn(
          "!w-2 !h-4 !rounded-sm !bg-slate-300 hover:!bg-primary transition-colors border-none",
          isBlocked && "!bg-red-300"
        )}
      />

      <div className={cn("p-3", isContainer && "h-full")}>
        <div ref={collapsedContentRef}>
          {isContainer && (
            <div className="mb-2 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-indigo-600">
              <Layers className="h-3 w-3" />
              <span>{childCount} inside</span>
            </div>
          )}

          {/* 1. Header: 코너 태그(종류) + 상태 pill. 제목은 아래 줄에서 전체 폭을 쓴다. */}
          <div className="flex items-center justify-between gap-2 mb-1.5">
            {!isContainer && (
              <span
                title={tv.label}
                className={cn(
                  "inline-flex shrink-0 items-center gap-1 rounded border px-1.5 py-0 text-[9px] font-medium uppercase tracking-wide",
                  tv.tagClass
                )}
              >
                <TypeIcon className="h-2.5 w-2.5" />
                {tv.label}
              </span>
            )}

            {/* Status pill — one click to cycle */}
            <Badge
              variant="outline"
              title="Click to change status"
              className={cn(
                "ml-auto shrink-0 gap-1 px-1.5 py-0 text-[9px] font-medium uppercase tracking-wide cursor-pointer select-none transition-colors",
                sv.badgeClass,
                node.computedStatus === "DONE" && "line-through"
              )}
              onClick={handleStatusClick}
            >
              <StatusIcon className="h-2.5 w-2.5" />
              {node.computedStatus}
            </Badge>
          </div>

          {/* 2. Title */}
          <div className="mb-2">
            {isEditingTitle ? (
              <Input
                value={editedTitle}
                onChange={(e) => setEditedTitle(e.target.value)}
                onBlur={handleTitleSave}
                onKeyDown={(e) => e.key === "Enter" && handleTitleSave()}
                autoFocus
                className="h-6 text-sm font-semibold px-1 py-0"
              />
            ) : (
              <h3
                className="font-semibold text-sm text-slate-900 leading-snug cursor-text"
                onDoubleClick={(e) => { e.stopPropagation(); setIsEditingTitle(true); }}
              >
                {node.title}
              </h3>
            )}
          </div>

          {/* 2. Owner (Clean, Neutral) */}
          <div className="min-h-[24px] flex items-center mb-2">
            {hasNoOwner ? (
              // Calm Unassigned State
              <div className="flex items-center gap-1.5 text-slate-400">
                <div className="w-5 h-5 rounded-full border border-slate-200 bg-slate-50 flex items-center justify-center">
                  <User className="w-3 h-3 text-slate-300" />
                </div>
                <span className="text-[10px] text-muted-foreground font-medium">미지정</span>
                {/* Tiny Add Button */}
                <DropdownMenu onOpenChange={(open) => { if (open && !hasLoadedMetadata) fetchMetadata(); }}>
                  <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                    <button className="ml-1 hover:bg-slate-100 p-0.5 rounded text-slate-400 opacity-50 hover:opacity-100 transition-opacity">
                      <Plus className="w-3 h-3" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-56" onClick={(e) => e.stopPropagation()}>
                    {members.length === 0 ? (
                      <div className="text-xs text-slate-400 p-2 text-center">Loading...</div>
                    ) : (
                      members.map(m => (
                        <DropdownMenuItem key={m.userId} onClick={() => updateNode({ ownerIds: [m.userId] })}>
                          <span className="text-sm">{m.userName}</span>
                        </DropdownMenuItem>
                      ))
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ) : (
              // Assigned Owner
              <div className="flex items-center gap-2">
                <Avatar className="h-5 w-5 border border-slate-100">
                  <AvatarFallback className="text-[9px] bg-blue-50 text-blue-700">
                    {getInitials(primaryOwner.name)}
                  </AvatarFallback>
                </Avatar>
                <span className="text-[10px] font-medium text-slate-600 truncate max-w-[120px]">
                  {primaryOwner.name}
                </span>
              </div>
            )}
          </div>

          {/* Assigned Teams */}
          {node.teams && node.teams.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2">
              {node.teams.map(team => (
                <span
                  key={team.id}
                  className="text-[9px] px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded"
                >
                  {team.name}
                </span>
              ))}
            </div>
          )}

          {isContainer && (
            <div
              className={cn(
                "mt-3 rounded border border-dashed border-indigo-200 bg-white/60 px-3 py-2 text-[10px] font-medium text-indigo-500 transition-all duration-200",
                isDropTarget && "border-indigo-500 bg-indigo-100 text-indigo-700 shadow-inner"
              )}
            >
              Drop nodes here
            </div>
          )}

          <div className="flex items-center justify-between pt-2 border-t border-slate-50 mt-1">
            <div className="flex items-center gap-2 text-slate-400">
              {node.dueAt && (
                <div className={cn("text-[9px] flex items-center gap-1",
                  new Date(node.dueAt) < new Date() ? "text-red-400" : "text-slate-400"
                )}>
                  <Calendar className="w-2.5 h-2.5" />
                  <span>{new Date(node.dueAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                </div>
              )}
            </div>

            {/* Blocked Count (if blocking others) */}
            {(node.blocksCount || 0) > 0 && (
              <div className="text-[9px] font-medium text-orange-600 bg-orange-50 px-1 rounded flex items-center gap-1">
                <Ban className="w-2.5 h-2.5" />
                {node.blocksCount}
              </div>
            )}
          </div>
        </div>

        {/* EXPANDED VIEW: Extra Controls when Selected */}
        {selected && (
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-start gap-2 animate-in fade-in slide-in-from-top-1 duration-200">
            {/* Contextual Action Button */}
            <div className="flex min-w-0 flex-1 flex-wrap gap-1">
              {node.manualStatus === 'TODO' && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    updateNode({ manualStatus: 'DOING' });
                  }}
                  className="nodrag shrink-0 px-3 py-1 text-[10px] font-semibold rounded bg-brand text-brand-foreground hover:bg-brand/90 transition-colors flex items-center gap-1 whitespace-nowrap"
                >
                  <PlayCircle className="w-3 h-3" />
                  Start
                </button>
              )}
              {node.manualStatus === 'DOING' && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    updateNode({ manualStatus: 'DONE' });
                  }}
                  className="nodrag shrink-0 px-3 py-1 text-[10px] font-semibold rounded bg-emerald-500 text-white hover:bg-emerald-600 transition-colors flex items-center gap-1 whitespace-nowrap"
                >
                  <CheckCircle2 className="w-3 h-3" />
                  Done
                </button>
              )}
              {node.manualStatus === 'DONE' && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    updateNode({ manualStatus: 'TODO' });
                  }}
                  className="nodrag shrink-0 px-3 py-1 text-[10px] font-medium rounded border border-slate-200 text-slate-500 hover:bg-slate-100 transition-colors flex items-center gap-1 whitespace-nowrap"
                >
                  <Clock className="w-3 h-3" />
                  Reopen
                </button>
              )}

              {/* Request Button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setCreateRequestOpen(true);
                }}
                className="nodrag shrink-0 px-2 py-1 text-[10px] font-medium rounded border border-slate-200 text-slate-500 hover:bg-slate-100 transition-colors flex items-center gap-1 whitespace-nowrap"
              >
                <MessageSquarePlus className="w-3 h-3" />
                Request
              </button>

              {/* Add Child Button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onCreateChild?.();
                }}
                className="nodrag shrink-0 px-2 py-1 text-[10px] font-medium rounded border border-indigo-200 text-indigo-600 hover:bg-indigo-50 transition-colors flex items-center gap-1 whitespace-nowrap"
              >
                <FolderPlus className="w-3 h-3" />
                Inside
              </button>

              {node.parentNodeId && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDetachFromParent?.();
                  }}
                  className="nodrag shrink-0 px-2 py-1 text-[10px] font-medium rounded border border-slate-200 text-slate-500 hover:bg-slate-100 transition-colors flex items-center gap-1 whitespace-nowrap"
                >
                  <CornerUpLeft className="w-3 h-3" />
                  Out
                </button>
              )}
            </div>

            {/* Open Sidebar Button */}
            <Button
              variant="ghost"
              size="sm"
              aria-label="Open task details"
              title="Open task details"
              className="h-6 w-6 shrink-0 p-0 hover:bg-slate-100 text-slate-400 hover:text-indigo-600 rounded-full"
              onClick={(e) => {
                e.stopPropagation();
                onOpenDetail?.();
              }}
            >
              <PanelRightOpen className="w-4 h-4 scale-x-[-1]" />
            </Button>
          </div>
        )}

      </div>

      {/* Right Handle (Output) */}
      <Handle
        type="source"
        position={Position.Right}
        style={handleStyle}
        className={cn(
          "!w-2 !h-4 !rounded-sm !bg-slate-300 hover:!bg-primary transition-colors border-none",
          isBlocked && "!bg-red-300"
        )}
      />

      <CreateRequestDialog
        projectId={projectId}
        linkedNodeId={node.id}
        open={createRequestOpen}
        onOpenChange={setCreateRequestOpen}
        onSuccess={() => {
          setCreateRequestOpen(false);
          // Optional: trigger refetch if needed, but requests are separate API from nodes
          onDataChange();
        }}
      />
    </div>
  );
});

CustomNode.displayName = "CustomNode";
