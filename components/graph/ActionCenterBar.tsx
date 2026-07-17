"use client";

import { useCallback, useMemo, useState } from "react";
import { NodeDTO, EdgeDTO } from "@/types";
import { cn } from "@/lib/utils";
import { AlertCircle, CheckCircle2, Clock, Ban, ChevronDown, ChevronRight, Loader2, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";

type SaveStatus = "saved" | "saving" | "error";

interface ActionCenterBarProps {
    nodes: NodeDTO[];
    edges: EdgeDTO[];
    userId: string;
    onNodeClick?: (nodeId: string) => void;
    saveStatus?: SaveStatus;
    lastSavedAt?: Date | null;
}

interface ActionCategory {
    id: string;
    title: string;
    icon: React.ReactNode;
    colorClass: string;
    badgeClass: string;
    items: NodeDTO[];
}

export function ActionCenterBar({
    nodes,
    edges,
    userId,
    onNodeClick,
    saveStatus = "saved",
    lastSavedAt,
}: ActionCenterBarProps) {
    const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

    const isOwner = useCallback((node: NodeDTO) => {
        return node.ownerId === userId || node.owners?.some((owner) => owner.id === userId);
    }, [userId]);

    // Actionable: Nodes ready to proceed (TODO/DOING & !BLOCKED & !WAITING)
    const actionable = useMemo(() => {
        return nodes.filter(n =>
            isOwner(n) &&
            (n.manualStatus === "TODO" || n.manualStatus === "DOING") &&
            n.computedStatus !== "BLOCKED" &&
            n.computedStatus !== "WAITING"
        );
    }, [isOwner, nodes]);

    // Waiting: Nodes I own that are in WAITING or BLOCKED state
    const waiting = useMemo(() => {
        return nodes.filter(n =>
            isOwner(n) &&
            (n.computedStatus === "WAITING" || n.computedStatus === "BLOCKED")
        );
    }, [isOwner, nodes]);

    // Blocking: Nodes I own that are blocking downstream nodes owned by OTHERS
    const blocking = useMemo(() => {
        return nodes.filter(myNode => {
            if (!isOwner(myNode) || myNode.manualStatus === "DONE") return false;

            // Find if any node depending on this one is owned by someone else
            const hasDependentOther = edges.some(edge => {
                if (edge.toNodeId !== myNode.id || edge.relation !== "DEPENDS_ON") return false;
                const blockedNode = nodes.find(n => n.id === edge.fromNodeId);
                // Only count if blocking SOMEONE ELSE (not myself) and they actually have an owner
                const isBlockedNodeOwnedByMe = blockedNode && isOwner(blockedNode);
                const hasOwner = blockedNode && (blockedNode.ownerId || (blockedNode.owners && blockedNode.owners.length > 0));

                return blockedNode && !isBlockedNodeOwnedByMe && hasOwner;
            });

            return hasDependentOther;
        });
    }, [isOwner, nodes, edges]);

    const categories: ActionCategory[] = [
        {
            id: "actionable",
            title: "Do Now",
            icon: <CheckCircle2 className="h-3.5 w-3.5" />,
            colorClass: "text-blue-600",
            badgeClass: "bg-blue-50 text-blue-700",
            items: actionable,
        },
        {
            id: "waiting",
            title: "Waiting",
            icon: <Clock className="h-3.5 w-3.5" />,
            colorClass: "text-amber-600",
            badgeClass: "bg-amber-50 text-amber-700",
            items: waiting,
        },
        {
            id: "blocking",
            title: "Blocking",
            icon: <Ban className="h-3.5 w-3.5" />,
            colorClass: "text-red-600",
            badgeClass: "bg-red-50 text-red-700",
            items: blocking,
        },
    ];

    const totalActions = actionable.length + waiting.length + blocking.length;
    const saveStatusTitle = lastSavedAt
        ? `Last saved ${lastSavedAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`
        : "All graph changes are saved";

    const toggleCategory = (id: string) => {
        setExpandedCategory(expandedCategory === id ? null : id);
    };

    return (
        <div className="bg-background border-b border-border shadow-sm">
            {/* Compact Header Row */}
            <div className="flex flex-wrap items-center gap-2 px-3 py-2 sm:gap-4 sm:px-4 sm:py-3">
                <div
                    data-testid="save-status"
                    className={cn(
                        "flex h-7 min-w-[88px] items-center gap-1.5 rounded-md px-2 text-xs font-medium",
                        saveStatus === "saving" && "bg-blue-50 text-blue-700",
                        saveStatus === "saved" && "text-muted-foreground",
                        saveStatus === "error" && "bg-red-50 text-red-600"
                    )}
                    title={saveStatus === "saved" ? saveStatusTitle : undefined}
                    aria-label={`Save status: ${saveStatus === "saving" ? "Saving" : saveStatus === "error" ? "Save failed" : "Saved"}`}
                    aria-live="polite"
                >
                    {saveStatus === "saving" ? (
                        <>
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            <span>Saving...</span>
                        </>
                    ) : saveStatus === "error" ? (
                        <>
                            <AlertCircle className="h-3.5 w-3.5" />
                            <span>Save failed</span>
                        </>
                    ) : (
                        <>
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            <span>Saved</span>
                        </>
                    )}
                </div>

                <div className="flex min-w-0 items-center gap-2">
                    <Zap className="h-4 w-4 text-brand" />
                    <span className="truncate text-sm font-semibold text-foreground">Action Center</span>
                    {totalActions > 0 && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-brand-muted text-brand">
                            {totalActions}
                        </Badge>
                    )}
                </div>

                {/* Category Buttons */}
                <div className="-mx-1 flex min-w-full gap-1 overflow-x-auto px-1 sm:min-w-0 sm:gap-2 sm:overflow-visible">
                    {categories.map((cat) => (
                        <button
                            key={cat.id}
                            onClick={() => toggleCategory(cat.id)}
                            className={cn(
                                "flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all sm:px-3",
                                expandedCategory === cat.id
                                    ? "bg-accent text-foreground"
                                    : "hover:bg-accent text-muted-foreground"
                            )}
                        >
                            <span className={cat.colorClass}>{cat.icon}</span>
                            <span>{cat.title}</span>
                            {cat.items.length > 0 && (
                                <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-bold", cat.badgeClass)}>
                                    {cat.items.length}
                                </span>
                            )}
                            {expandedCategory === cat.id ? (
                                <ChevronDown className="h-3 w-3 text-muted-foreground" />
                            ) : (
                                <ChevronRight className="h-3 w-3 text-muted-foreground" />
                            )}
                        </button>
                    ))}
                </div>
            </div>

            {/* Expanded Category Content */}
            {expandedCategory && (
                <div className="px-3 pb-3 sm:px-4">
                    <div className="bg-card rounded-lg border border-border shadow-inner max-h-[200px] overflow-y-auto">
                        {categories
                            .find((c) => c.id === expandedCategory)
                            ?.items.map((item) => {
                                // Determine reasons
                                const itemIsOwner = isOwner(item);
                                const isTeam = item.teams && item.teams.length > 0;

                                return (
                                    <div
                                        key={item.id}
                                        onClick={() => onNodeClick?.(item.id)}
                                        className="flex items-center justify-between px-3 py-2 hover:bg-accent cursor-pointer border-b border-border last:border-b-0 transition-colors"
                                    >
                                        <div className="flex items-center gap-2 flex-1 min-w-0">
                                            <div className="flex flex-col min-w-0">
                                                <span className="font-medium text-sm text-foreground truncate">{item.title}</span>
                                                {item.waitingReason && (
                                                    <span className="text-[10px] text-muted-foreground truncate">
                                                        {item.waitingReason}
                                                    </span>
                                                )}
                                                {expandedCategory === "blocking" && (item.blocksCount || 0) > 0 && (
                                                    <span className="text-[10px] text-red-500 font-medium whitespace-nowrap">
                                                        Blocks {item.blocksCount} item{item.blocksCount !== 1 ? 's' : ''}
                                                    </span>
                                                )}
                                            </div>
                                            {/* OWNER/TEAM Badges */}
                                            {itemIsOwner && (
                                                <span className="text-[9px] bg-brand text-brand-foreground px-1.5 py-0.5 rounded font-bold uppercase flex-shrink-0">
                                                    Owner
                                                </span>
                                            )}
                                            {isTeam && !itemIsOwner && item.teams?.map((team) => (
                                                <span key={team.id} className="text-[9px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded font-medium flex-shrink-0">
                                                    {team.name}
                                                </span>
                                            ))}
                                        </div>
                                        <Badge
                                            variant={item.computedStatus === "BLOCKED" ? "destructive" : "outline"}
                                            className="text-[9px] uppercase ml-2 flex-shrink-0"
                                        >
                                            {item.computedStatus}
                                        </Badge>
                                    </div>
                                );
                            }) || (
                                <div className="p-4 text-center text-sm text-muted-foreground">
                                    No items in this category
                                </div>
                            )}
                        {categories.find((c) => c.id === expandedCategory)?.items.length === 0 && (
                            <div className="p-4 text-center text-sm text-muted-foreground">
                                No items in this category
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
