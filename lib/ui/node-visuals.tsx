import {
  CheckCircle2,
  PlayCircle,
  Clock,
  AlertTriangle,
  PauseCircle,
  ListTodo,
  GitBranch,
  Ban,
  HelpCircle,
  type LucideIcon,
} from "lucide-react";
import type { ComputedStatus, ManualStatus, NodeType } from "@/types";

// Single source of truth for node status + type visuals across the app.
// Previously these color/icon maps were duplicated inline (and mismatched)
// in CustomNode, NodeDetailSheet, Toolbar filters, and ProjectListView.

export interface StatusVisual {
  /** Korean label used on board/list surfaces (예정/진행/완료/막힘/대기). */
  label: string;
  /** English label for tooltips / a11y. */
  labelEn: string;
  /** Pill/badge classes (bg + text + border). */
  badgeClass: string;
  /** Solid accent color (card top-strip / left border / dot). */
  accentClass: string;
  /** Small status dot background. */
  dotClass: string;
  /** Foreground text color. */
  textClass: string;
  icon: LucideIcon;
}

export const STATUS_VISUALS: Record<ComputedStatus, StatusVisual> = {
  DONE: {
    label: "완료",
    labelEn: "Done",
    badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200",
    accentClass: "bg-emerald-500",
    dotClass: "bg-emerald-500",
    textClass: "text-emerald-700",
    icon: CheckCircle2,
  },
  DOING: {
    label: "진행",
    labelEn: "Doing",
    badgeClass: "bg-blue-50 text-blue-700 border-blue-200",
    accentClass: "bg-blue-500",
    dotClass: "bg-blue-500",
    textClass: "text-blue-700",
    icon: PlayCircle,
  },
  BLOCKED: {
    label: "막힘",
    labelEn: "Blocked",
    badgeClass: "bg-red-50 text-red-700 border-red-200",
    accentClass: "bg-red-500",
    dotClass: "bg-red-500",
    textClass: "text-red-700",
    icon: AlertTriangle,
  },
  WAITING: {
    label: "대기",
    labelEn: "Waiting",
    badgeClass: "bg-amber-50 text-amber-700 border-amber-200",
    accentClass: "bg-amber-500",
    dotClass: "bg-amber-500",
    textClass: "text-amber-700",
    icon: PauseCircle,
  },
  TODO: {
    label: "예정",
    labelEn: "To do",
    badgeClass: "bg-slate-50 text-slate-600 border-slate-200",
    accentClass: "bg-slate-300",
    dotClass: "bg-slate-400",
    textClass: "text-slate-600",
    icon: Clock,
  },
};

export interface TypeVisual {
  label: string;
  icon: LucideIcon;
  /** Solid accent color. Still used by list/detail surfaces. */
  accentClass: string;
  textClass: string;
  badgeClass: string;
  /**
   * Quiet corner-tag style for the board card (icon + label carry the meaning,
   * so the color only tints — it does not shout). Softer than badgeClass.
   */
  tagClass: string;
}

export const TYPE_VISUALS: Record<NodeType, TypeVisual> = {
  TASK: {
    label: "Task",
    icon: ListTodo,
    accentClass: "bg-blue-500",
    textClass: "text-blue-600",
    badgeClass: "bg-blue-50 text-blue-700 border-blue-200",
    tagClass: "bg-blue-50/70 text-blue-600 border-blue-100",
  },
  DECISION: {
    label: "Decision",
    icon: GitBranch,
    accentClass: "bg-violet-500",
    textClass: "text-violet-600",
    badgeClass: "bg-violet-50 text-violet-700 border-violet-200",
    tagClass: "bg-violet-50/70 text-violet-600 border-violet-100",
  },
  BLOCKER: {
    label: "Blocker",
    icon: Ban,
    accentClass: "bg-red-500",
    textClass: "text-red-600",
    badgeClass: "bg-red-50 text-red-700 border-red-200",
    tagClass: "bg-red-50/70 text-red-600 border-red-100",
  },
  INFOREQ: {
    label: "Info",
    icon: HelpCircle,
    accentClass: "bg-amber-500",
    textClass: "text-amber-600",
    badgeClass: "bg-amber-50 text-amber-700 border-amber-200",
    tagClass: "bg-amber-50/70 text-amber-600 border-amber-100",
  },
};

export function statusVisual(status: ComputedStatus | ManualStatus): StatusVisual {
  return STATUS_VISUALS[status as ComputedStatus] ?? STATUS_VISUALS.TODO;
}

export function typeVisual(type: NodeType | null | undefined): TypeVisual {
  return (type && TYPE_VISUALS[type]) || TYPE_VISUALS.TASK;
}
