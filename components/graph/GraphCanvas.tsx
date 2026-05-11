import { useCallback, useMemo, useRef, useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import ReactFlow, {
  Node,
  Edge,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  Connection,
  ConnectionLineType,
  MarkerType,
  NodeDragHandler,
  Position,
  type ReactFlowInstance,
} from "reactflow";
import dagre from "dagre";
import "reactflow/dist/style.css";
import { EdgeDTO, EdgeRelation, GraphData, NodeDTO } from "@/types";
import { CustomNode } from "./CustomNode";
import { ActionCenterBar } from "./ActionCenterBar";
import { Toolbar } from "./Toolbar";
import { CanvasContextMenu, ContextMenuPosition } from "./CanvasContextMenu";
import { AddNodeDialog } from "./AddNodeDialog";
import { NodeDetailSheet } from "./NodeDetailSheet";
import { useDeleteNode } from "@/hooks/use-node-mutations";
import { useSession } from "next-auth/react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface GraphCanvasProps {
  orgId: string;
  projectId: string;
  data: GraphData;
  onDataChange: () => void;
  focusNodeId?: string | null;
}

type SaveStatus = "saved" | "saving" | "error";

interface DeletedGraphSnapshot {
  nodes: NodeDTO[];
  edges: EdgeDTO[];
  childParentRestores: Array<{ nodeId: string; parentNodeId: string }>;
  label: string;
}

interface DragHierarchyFeedback {
  draggingNodeId: string | null;
  dropTargetNodeId: string | null;
  isDetaching: boolean;
}

const nodeTypes = {
  custom: CustomNode,
};

const nodeWidth = 240;
const nodeHeight = 120;
const containerMinWidth = 340;
const containerMinHeight = 190;
const containerPadding = 32;
const containerHeaderHeight = 76;
const hierarchyDropPadding = 28;
const hierarchyDropOverlapRatio = 0.24;
const hierarchyDetachOverlapRatio = 0.45;
const graphEdgeStyle = {
  strokeWidth: 2,
  stroke: "#94a3b8",
};
const graphEdgePathOptions = {
  curvature: 0.45,
};

function getNodeDepth(node: NodeDTO, nodeById: Map<string, NodeDTO>) {
  let depth = 0;
  let parentId = node.parentNodeId;

  while (parentId) {
    const parent = nodeById.get(parentId);
    if (!parent) break;
    depth += 1;
    parentId = parent.parentNodeId;
  }

  return depth;
}

function isDescendantOf(nodeId: string, possibleAncestorId: string, nodeById: Map<string, NodeDTO>) {
  let parentId = nodeById.get(nodeId)?.parentNodeId ?? null;

  while (parentId) {
    if (parentId === possibleAncestorId) return true;
    parentId = nodeById.get(parentId)?.parentNodeId ?? null;
  }

  return false;
}

function numberStyleValue(value: unknown) {
  return typeof value === "number" ? value : undefined;
}

function makeTempId(prefix: string) {
  return `${prefix}-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
}

function getFlowNodeDimensions(flowNode: Node) {
  return {
    width: flowNode.width ?? numberStyleValue(flowNode.style?.width) ?? nodeWidth,
    height: flowNode.height ?? numberStyleValue(flowNode.style?.height) ?? nodeHeight,
  };
}

function getAbsoluteNodePosition(flowNode: Node, allNodes: Node[]) {
  let x = flowNode.position.x;
  let y = flowNode.position.y;
  let parentId = flowNode.parentNode;

  while (parentId) {
    const parent = allNodes.find((candidate) => candidate.id === parentId);
    if (!parent) break;
    x += parent.position.x;
    y += parent.position.y;
    parentId = parent.parentNode;
  }

  return { x, y };
}

function getFlowNodeRect(flowNode: Node, allNodes: Node[]) {
  const position = getAbsoluteNodePosition(flowNode, allNodes);
  const dimensions = getFlowNodeDimensions(flowNode);

  return {
    x: position.x,
    y: position.y,
    width: dimensions.width,
    height: dimensions.height,
  };
}

function getRectIntersectionArea(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number }
) {
  const width = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x));
  const height = Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
  return width * height;
}

function isPointInsideRect(
  point: { x: number; y: number },
  rect: { x: number; y: number; width: number; height: number },
  padding = 0
) {
  return (
    point.x >= rect.x - padding &&
    point.x <= rect.x + rect.width + padding &&
    point.y >= rect.y - padding &&
    point.y <= rect.y + rect.height + padding
  );
}

function getNodeCenter(rect: { x: number; y: number; width: number; height: number }) {
  return {
    x: rect.x + rect.width / 2,
    y: rect.y + rect.height / 2,
  };
}

function findHierarchyDropTarget(draggedNode: Node, allNodes: Node[], nodeById: Map<string, NodeDTO>) {
  const draggedDto = nodeById.get(draggedNode.id);
  if (!draggedDto) return null;

  const draggedRect = getFlowNodeRect(draggedNode, allNodes);
  const draggedArea = Math.max(1, draggedRect.width * draggedRect.height);
  const draggedCenter = getNodeCenter(draggedRect);

  return allNodes
    .filter((candidate) => {
      if (candidate.id === draggedNode.id) return false;
      if (isDescendantOf(candidate.id, draggedNode.id, nodeById)) return false;
      return nodeById.has(candidate.id);
    })
    .map((candidate) => {
      const candidateDto = nodeById.get(candidate.id);
      if (!candidateDto) return null;

      const candidateRect = getFlowNodeRect(candidate, allNodes);
      const candidateArea = Math.max(1, candidateRect.width * candidateRect.height);
      const intersectionArea = getRectIntersectionArea(draggedRect, candidateRect);
      const overlapRatio = intersectionArea / Math.min(draggedArea, candidateArea);
      const centerInside = isPointInsideRect(draggedCenter, candidateRect, hierarchyDropPadding);

      if (!centerInside && overlapRatio < hierarchyDropOverlapRatio) return null;

      return {
        node: candidate,
        score:
          getNodeDepth(candidateDto, nodeById) * 100000 +
          overlapRatio * 1000 +
          (centerInside ? 100 : 0),
      };
    })
    .filter((candidate): candidate is { node: Node; score: number } => Boolean(candidate))
    .sort((a, b) => b.score - a.score)[0]?.node ?? null;
}

function isDraggedNodeOutsideParent(draggedNode: Node, allNodes: Node[]) {
  if (!draggedNode.parentNode) return false;

  const parentNode = allNodes.find((candidate) => candidate.id === draggedNode.parentNode);
  if (!parentNode) return false;

  const draggedRect = getFlowNodeRect(draggedNode, allNodes);
  const parentRect = getFlowNodeRect(parentNode, allNodes);
  const draggedArea = Math.max(1, draggedRect.width * draggedRect.height);
  const draggedCenter = getNodeCenter(draggedRect);
  const overlapRatio = getRectIntersectionArea(draggedRect, parentRect) / draggedArea;

  return !isPointInsideRect(draggedCenter, parentRect) && overlapRatio < hierarchyDetachOverlapRatio;
}

function updateNodeFrameInGraphData(
  graphData: GraphData,
  nodeId: string,
  parentNodeId: string | null,
  position: { x: number; y: number }
) {
  const previousParentId = graphData.nodes.find((node) => node.id === nodeId)?.parentNodeId ?? null;
  const parentChanged = previousParentId !== parentNodeId;

  return {
    ...graphData,
    nodes: graphData.nodes.map((node) => {
      if (node.id === nodeId) {
        return {
          ...node,
          parentNodeId,
          positionX: Math.round(position.x),
          positionY: Math.round(position.y),
        };
      }

      if (parentChanged && previousParentId && node.id === previousParentId) {
        return { ...node, childCount: Math.max(0, (node.childCount || 0) - 1) };
      }

      if (parentChanged && parentNodeId && node.id === parentNodeId) {
        return { ...node, childCount: (node.childCount || 0) + 1 };
      }

      return node;
    }),
  };
}

function shouldIgnoreGraphDeleteKey(target: EventTarget | null) {
  if (!(target instanceof Element)) return false;
  return Boolean(
    target.closest(
      'input, textarea, select, button, [contenteditable="true"], [role="textbox"], [role="dialog"]'
    )
  );
}

function restoreGraphData(graphData: GraphData, snapshot: DeletedGraphSnapshot): GraphData {
  const nodeById = new Map(graphData.nodes.map((node) => [node.id, node]));
  const edgeById = new Map(graphData.edges.map((edge) => [edge.id, edge]));

  snapshot.nodes.forEach((node) => {
    nodeById.set(node.id, node);
  });

  snapshot.childParentRestores.forEach(({ nodeId, parentNodeId }) => {
    const node = nodeById.get(nodeId);
    if (node) nodeById.set(nodeId, { ...node, parentNodeId });
  });

  snapshot.edges.forEach((edge) => {
    edgeById.set(edge.id, edge);
  });

  return {
    ...graphData,
    nodes: Array.from(nodeById.values()),
    edges: Array.from(edgeById.values()),
  };
}

async function persistNodeFrame(nodeId: string, parentNodeId: string | null, x: number, y: number) {
  const res = await fetch(`/api/nodes/${nodeId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      parentNodeId,
      positionX: Math.round(x),
      positionY: Math.round(y),
    }),
  });

  if (!res.ok) {
    if (res.status === 404) return;
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to save node (${res.status})`);
  }
}

const getLayoutedElements = (nodes: Node[], edges: Edge[], direction = "LR") => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));

  const isHorizontal = direction === "LR";

  // Optimized layout settings for edge crossing minimization and visual clarity
  dagreGraph.setGraph({
    rankdir: direction,
    ranksep: 100,     // Space between layers (horizontal in LR, vertical in TB)
    nodesep: 60,      // Space between nodes in the same layer
    edgesep: 25,      // Minimum edge separation
    marginx: 30,      // Horizontal margin
    marginy: 30,      // Vertical margin
    acyclicer: "greedy",  // Algorithm for making graphs acyclic
    ranker: "network-simplex",  // Ranking algorithm (best for minimizing edge crossings)
  });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  nodes.forEach((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    node.targetPosition = isHorizontal ? Position.Left : Position.Top;
    node.sourcePosition = isHorizontal ? Position.Right : Position.Bottom;

    node.position = {
      x: nodeWithPosition.x - nodeWidth / 2,
      y: nodeWithPosition.y - nodeHeight / 2,
    };

    return node;
  });

  return { nodes, edges };
};

export function GraphCanvas({ projectId, orgId, data, onDataChange, focusNodeId }: GraphCanvasProps) {
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [editingEdge, setEditingEdge] = useState<Edge | null>(null);
  const [relation, setRelation] = useState<string>("DEPENDS_ON");
  const [isSyncing, setIsSyncing] = useState(false);
  const [contextMenu, setContextMenu] = useState<ContextMenuPosition | null>(null);
  const [addNodeOpen, setAddNodeOpen] = useState(false);
  const [addNodeParent, setAddNodeParent] = useState<{ id: string; title: string } | null>(null);
  const [addNodePosition, setAddNodePosition] = useState<{ x: number; y: number } | null>(null);
  const [pendingDetachNodeId, setPendingDetachNodeId] = useState<string | null>(null);
  const [pendingSaveCount, setPendingSaveCount] = useState(0);
  const [hasSaveError, setHasSaveError] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [layoutDirection] = useState<"LR" | "TB">("LR");
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [dragHierarchyFeedback, setDragHierarchyFeedback] = useState<DragHierarchyFeedback>({
    draggingNodeId: null,
    dropTargetNodeId: null,
    isDetaching: false,
  });
  const selectedNodeIdRef = useRef<string | null>(null);
  const deletedGraphSnapshotRef = useRef<DeletedGraphSnapshot | null>(null);
  const reactFlowInstanceRef = useRef<ReactFlowInstance | null>(null);
  const queryClient = useQueryClient();
  const deleteNodeMutation = useDeleteNode();
  const { data: session } = useSession();
  const saveStatus: SaveStatus = pendingSaveCount > 0 ? "saving" : hasSaveError ? "error" : "saved";

  const beginSaving = useCallback(() => {
    setHasSaveError(false);
    setPendingSaveCount((count) => count + 1);
  }, []);

  const finishSaving = useCallback((succeeded: boolean) => {
    if (succeeded) {
      setLastSavedAt(new Date());
    } else {
      setHasSaveError(true);
    }
    setPendingSaveCount((count) => Math.max(0, count - 1));
  }, []);

  const changePendingSaveCount = useCallback((delta: number) => {
    if (delta > 0) {
      setHasSaveError(false);
      setPendingSaveCount((count) => count + delta);
      return;
    }

    if (delta < 0) {
      setLastSavedAt(new Date());
      setPendingSaveCount((count) => Math.max(0, count + delta));
    }
  }, []);

  const { layoutedNodes, layoutedEdges } = useMemo(() => {
    const nodeById = new Map(data.nodes.map((node) => [node.id, node]));
    const childrenByParentId = data.nodes.reduce((map, node) => {
      if (!node.parentNodeId) return map;
      const children = map.get(node.parentNodeId) || [];
      children.push(node);
      map.set(node.parentNodeId, children);
      return map;
    }, new Map<string, NodeDTO[]>());

    const nodeDimensions = new Map<string, { width: number; height: number }>();
    data.nodes.forEach((node) => {
      const children = childrenByParentId.get(node.id) || [];
      if (children.length === 0) {
        nodeDimensions.set(node.id, { width: nodeWidth, height: nodeHeight });
        return;
      }

      const maxChildX = Math.max(0, ...children.map((child) => child.positionX ?? containerPadding));
      const maxChildY = Math.max(0, ...children.map((child) => child.positionY ?? containerHeaderHeight));
      nodeDimensions.set(node.id, {
        width: Math.max(containerMinWidth, maxChildX + nodeWidth + containerPadding),
        height: Math.max(containerMinHeight, maxChildY + nodeHeight + containerPadding),
      });
    });

    const initialNodes: Node[] = data.nodes.map((node) => {
      const x = typeof node.positionX === 'number' && !Number.isNaN(node.positionX)
        ? node.positionX
        : node.parentNodeId ? containerPadding : 0;
      const y = typeof node.positionY === 'number' && !Number.isNaN(node.positionY)
        ? node.positionY
        : node.parentNodeId ? containerHeaderHeight : 0;
      const dimensions = nodeDimensions.get(node.id);
      const childCount = childrenByParentId.get(node.id)?.length || 0;

      // Calculate if this node matches the current filters
      let isFaded = false;
      if (filterStatus !== "ALL" && node.computedStatus !== filterStatus) isFaded = true;
      if (searchQuery && !node.title.toLowerCase().includes(searchQuery.toLowerCase())) isFaded = true;

      if (selectedTeamIds.length > 0) {
        const nodeTeamIds = node.teams.map((t) => t.id);
        const hasMatch = selectedTeamIds.some((id) => nodeTeamIds.includes(id));
        if (!hasMatch) isFaded = true;
      }

      if (selectedUserIds.length > 0) {
        const nodeOwnerIds = node.owners.map((o) => o.id);
        const hasMatch = selectedUserIds.some((id) => nodeOwnerIds.includes(id));
        if (!hasMatch) isFaded = true;
      }

      return {
        id: node.id,
        type: "custom",
        position: { x, y },
        parentNode: node.parentNodeId || undefined,
        draggable: true,
        zIndex: node.parentNodeId ? 20 + getNodeDepth(node, nodeById) : 0,
        style: childCount > 0 && dimensions
          ? { width: dimensions.width, height: dimensions.height }
          : undefined,
        data: {
          node,
          isFaded // Pass faded state to the node component
        },
      };
    });

    const visibleNodeIds = new Set(initialNodes.map((n) => n.id));
    const initialEdges: Edge[] = data.edges
      .filter((edge) => visibleNodeIds.has(edge.fromNodeId) && visibleNodeIds.has(edge.toNodeId))
      .map((edge) => {
        const isForward = edge.relation === "HANDOFF_TO";
        return {
          id: edge.id,
          source: isForward ? edge.fromNodeId : edge.toNodeId,
          target: isForward ? edge.toNodeId : edge.fromNodeId,
          type: "default",
          label: edge.relation.replace(/_/g, " "),
          pathOptions: graphEdgePathOptions,
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: "#64748b",
          },
          style: graphEdgeStyle,
          data: { originalEdge: edge },
        };
      });

    // Apply positions: use saved positions or auto-layout
    const { nodes, edges } = (() => {
      const nodesWithSavedPos: Node[] = [];
      const nodesNeedingLayout: Node[] = [];

      initialNodes.forEach((node) => {
        const nodeData = data.nodes.find((n) => n.id === node.id);
        if (nodeData?.parentNodeId) {
          nodesWithSavedPos.push({
            ...node,
            position: {
              x: typeof nodeData.positionX === 'number' && !Number.isNaN(nodeData.positionX) ? nodeData.positionX : containerPadding,
              y: typeof nodeData.positionY === 'number' && !Number.isNaN(nodeData.positionY) ? nodeData.positionY : containerHeaderHeight,
            },
            sourcePosition: Position.Right,
            targetPosition: Position.Left,
          });
          return;
        }

        const hasValidPos =
          nodeData &&
          typeof nodeData.positionX === 'number' && !Number.isNaN(nodeData.positionX) &&
          typeof nodeData.positionY === 'number' && !Number.isNaN(nodeData.positionY);

        if (hasValidPos) {
          // Use saved position and set handle positions
          nodesWithSavedPos.push({
            ...node,
            position: { x: nodeData!.positionX!, y: nodeData!.positionY! },
            sourcePosition: Position.Right,
            targetPosition: Position.Left,
          });
        } else {
          nodesNeedingLayout.push(node);
        }
      });

      // Auto-layout nodes without saved positions
      if (nodesNeedingLayout.length > 0) {
        const layoutNodeIds = new Set(nodesNeedingLayout.map((node) => node.id));
        const layoutEdges = initialEdges.filter((edge) => layoutNodeIds.has(edge.source) && layoutNodeIds.has(edge.target));
        const { nodes: layoutedNodes } = getLayoutedElements(nodesNeedingLayout, layoutEdges, layoutDirection);
        return { nodes: [...nodesWithSavedPos, ...layoutedNodes], edges: initialEdges };
      }

      return { nodes: nodesWithSavedPos, edges: initialEdges };
    })();

    const nodesWithExtraData = nodes.map((node) => {
      const blockedByTitles = data.edges
        .filter((e) => {
          if (e.relation === "HANDOFF_TO") return e.toNodeId === node.id;
          return e.fromNodeId === node.id;
        })
        .map((e) => {
          const precursorId = e.relation === "HANDOFF_TO" ? e.fromNodeId : e.toNodeId;
          return data.nodes.find((n) => n.id === precursorId);
        })
        .filter((n): n is NodeDTO => !!n && n.computedStatus !== "DONE")
        .map((n) => n.title);

      const blockingTitles = data.edges
        .filter((e) => {
          if (e.relation === "HANDOFF_TO") return e.fromNodeId === node.id;
          return e.toNodeId === node.id;
        })
        .map((e) => {
          const successorId = e.relation === "HANDOFF_TO" ? e.toNodeId : e.fromNodeId;
          return data.nodes.find((n) => n.id === successorId);
        })
        .filter((n): n is NodeDTO => !!n)
        .map((n) => n.title);

      return {
        ...node,
        data: {
          ...node.data,
          node: data.nodes.find((n) => n.id === node.id),
          projectId,
          orgId,
          onDataChange,
          blockedBy: blockedByTitles,
          blocking: blockingTitles,
          onOpenDetail: () => {
            selectedNodeIdRef.current = node.id;
            setSelectedNodeId(node.id);
            setIsSheetOpen(true);
          },
          onCreateChild: () => {
            const sourceNode = data.nodes.find((n) => n.id === node.id);
            setAddNodeParent({ id: node.id, title: sourceNode?.title || "selected node" });
            setAddNodePosition(null);
            setAddNodeOpen(true);
          },
          onDetachFromParent: () => {
            setPendingDetachNodeId(node.id);
          },
          onPendingSaveChange: changePendingSaveCount,
        },
      };
    });

    return {
      layoutedNodes: nodesWithExtraData.sort((a, b) => {
        const aNode = nodeById.get(a.id);
        const bNode = nodeById.get(b.id);
        if (!aNode || !bNode) return 0;
        return getNodeDepth(aNode, nodeById) - getNodeDepth(bNode, nodeById);
      }),
      layoutedEdges: edges,
    };
  }, [changePendingSaveCount, data.nodes, data.edges, filterStatus, searchQuery, selectedTeamIds, selectedUserIds, projectId, orgId, onDataChange, layoutDirection]);

  const [nodes, setNodes, onNodesChange] = useNodesState(layoutedNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(layoutedEdges);
  const visibleNodes = useMemo(
    () =>
      nodes.map((node) => {
        const isDragging = dragHierarchyFeedback.draggingNodeId === node.id;
        const isDropTarget = dragHierarchyFeedback.dropTargetNodeId === node.id;

        return {
          ...node,
          zIndex: isDragging ? 1000 : isDropTarget ? 900 : node.zIndex,
          data: {
            ...node.data,
            isDragging,
            isDropTarget,
            isDetachTarget: isDragging && dragHierarchyFeedback.isDetaching,
          },
        };
      }),
    [dragHierarchyFeedback, nodes]
  );

  const selectOnlyNode = useCallback(
    (nodeId: string) => {
      selectedNodeIdRef.current = nodeId;
      setSelectedNodeId(nodeId);
      setIsSheetOpen(false);
      setNodes((currentNodes) =>
        currentNodes.map((node) => ({
          ...node,
          selected: node.id === nodeId,
        }))
      );
      setEdges((currentEdges) =>
        currentEdges.map((edge) => ({
          ...edge,
          selected: false,
        }))
      );
    },
    [setEdges, setNodes]
  );

  const clearSelection = useCallback(() => {
    selectedNodeIdRef.current = null;
    setSelectedNodeId(null);
    setIsSheetOpen(false);
    setNodes((currentNodes) =>
      currentNodes.map((node) => ({
        ...node,
        selected: false,
      }))
    );
    setEdges((currentEdges) =>
      currentEdges.map((edge) => ({
        ...edge,
        selected: false,
      }))
    );
  }, [setEdges, setNodes]);

  useEffect(() => {
    if (pendingSaveCount === 0) return;

    const message = "You have unsaved graph changes. Leave anyway?";
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = message;
      return message;
    };
    const onDocumentClick = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (!(target instanceof HTMLAnchorElement)) return;
      if (target.target === "_blank" || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const href = target.href;
      if (!href || href === window.location.href) return;
      if (window.confirm(message)) return;

      event.preventDefault();
      event.stopImmediatePropagation();
    };

    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onDocumentClick, true);

    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onDocumentClick, true);
    };
  }, [pendingSaveCount]);

  useEffect(() => {
    if (!pendingDetachNodeId) return;
    const flowNode = nodes.find((node) => node.id === pendingDetachNodeId);
    setPendingDetachNodeId(null);
    if (!flowNode?.parentNode) return;

    const parent = nodes.find((node) => node.id === flowNode.parentNode);
    const absolute = getAbsoluteNodePosition(flowNode, nodes);
    const parentAbsolute = parent ? getAbsoluteNodePosition(parent, nodes) : absolute;
    const parentSize = parent ? getFlowNodeDimensions(parent) : { width: nodeWidth, height: nodeHeight };
    const nextX = parentAbsolute.x + parentSize.width + 48;
    const nextY = absolute.y;

    queryClient.setQueryData<GraphData>(["graph", projectId], (old: GraphData | undefined) => {
      if (!old) return old;
      return updateNodeFrameInGraphData(old, flowNode.id, null, { x: nextX, y: nextY });
    });
    setNodes((currentNodes) =>
      currentNodes.map((node) =>
        node.id === flowNode.id
          ? {
            ...node,
            parentNode: undefined,
            position: { x: nextX, y: nextY },
          }
          : node
      )
    );

    beginSaving();
    void persistNodeFrame(flowNode.id, null, nextX, nextY)
      .then(() => {
        toast.success("Node moved out");
        onDataChange();
        finishSaving(true);
      })
      .catch((error) => {
        toast.error(error instanceof Error ? error.message : "Failed to move node");
        onDataChange();
        finishSaving(false);
      });
  }, [beginSaving, finishSaving, nodes, onDataChange, pendingDetachNodeId, projectId, queryClient, setNodes]);

  // Focus on specific node when focusNodeId is provided
  useEffect(() => {
    if (focusNodeId) {
      setNodes((nds) =>
        nds.map((node) => ({
          ...node,
          selected: node.id === focusNodeId,
        }))
      );
    }
  }, [focusNodeId, setNodes]);

  useEffect(() => {
    setNodes((nds) =>
      layoutedNodes.map((newNode) => {
        const existingNode = nds.find((n) => n.id === newNode.id);
        if (existingNode) {
          return {
            ...newNode,
            selected: existingNode.selected,
          };
        }
        return newNode;
      })
    );
    setEdges(layoutedEdges);
  }, [layoutedNodes, layoutedEdges, setNodes, setEdges]);

  const onConnect = useCallback(async (params: Connection) => {
    if (!params.source || !params.target) return;

    const tempId = makeTempId("temp-edge");
    const fromNodeId = params.target;
    const toNodeId = params.source;
    const relation = EdgeRelation.DEPENDS_ON;
    const optimisticEdge: EdgeDTO = {
      id: tempId,
      orgId: orgId,
      projectId,
      fromNodeId,
      toNodeId,
      relation,
      createdAt: new Date().toISOString(),
    };

    let succeeded = false;
    beginSaving();
    queryClient.setQueryData<GraphData>(["graph", projectId], (old) => {
      if (!old) return old;
      return {
        ...old,
        edges: [...old.edges, optimisticEdge],
      };
    });
    toast.info("Connection added. Saving...");

    try {
      const res = await fetch(`/api/projects/${projectId}/edges`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fromNodeId, toNodeId, relation }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create connection");
      }

      const savedEdge = await res.json() as Partial<EdgeDTO>;
      queryClient.setQueryData<GraphData>(["graph", projectId], (old) => {
        if (!old) return old;
        return {
          ...old,
          edges: old.edges.map((edge) =>
            edge.id === tempId
              ? { ...optimisticEdge, ...savedEdge, id: savedEdge.id || tempId }
              : edge
          ),
        };
      });
      toast.success("Connection saved");
      onDataChange();
      succeeded = true;
    } catch (error) {
      queryClient.setQueryData<GraphData>(["graph", projectId], (old) => {
        if (!old) return old;
        return {
          ...old,
          edges: old.edges.filter((edge) => edge.id !== tempId),
        };
      });
      toast.error(error instanceof Error ? error.message : "Error creating connection");
      onDataChange();
    } finally {
      finishSaving(succeeded);
    }
  }, [beginSaving, finishSaving, onDataChange, orgId, projectId, queryClient]);

  const handleUpdateEdge = async () => {
    if (!editingEdge) return;
    setIsSyncing(true);
    let succeeded = false;
    beginSaving();
    try {
      const res = await fetch(`/api/edges/${editingEdge.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ relation }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to update connection");
      }

      toast.success("Connection updated");
      onDataChange();
      setEditingEdge(null);
      succeeded = true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error updating connection");
    } finally {
      setIsSyncing(false);
      finishSaving(succeeded);
    }
  };

  const onEdgeClick = useCallback((event: React.MouseEvent, edge: Edge) => {
    selectedNodeIdRef.current = null;
    setSelectedNodeId(null);
    setIsSheetOpen(false);
    setEditingEdge(edge);
    setRelation(edge.data?.originalEdge?.relation || "DEPENDS_ON");
  }, []);

  const onNodeDragStart: NodeDragHandler = useCallback((_event, node) => {
    setDragHierarchyFeedback({
      draggingNodeId: node.id,
      dropTargetNodeId: null,
      isDetaching: false,
    });
  }, []);

  const onNodeDrag: NodeDragHandler = useCallback(
    (_event, node) => {
      const currentNodes = nodes.map((candidate) =>
        candidate.id === node.id
          ? {
            ...candidate,
            position: node.position,
            parentNode: node.parentNode ?? candidate.parentNode,
          }
          : candidate
      );
      const draggedNode = currentNodes.find((candidate) => candidate.id === node.id) || node;
      const dtoById = new Map(data.nodes.map((candidate) => [candidate.id, candidate]));
      const draggedDto = dtoById.get(node.id);
      const outsideParent = isDraggedNodeOutsideParent(draggedNode, currentNodes);
      const rawDropTarget = findHierarchyDropTarget(draggedNode, currentNodes, dtoById);
      const dropTarget =
        outsideParent && rawDropTarget?.id === draggedDto?.parentNodeId ? null : rawDropTarget;
      const isDetaching = Boolean(
        draggedDto?.parentNodeId &&
        !dropTarget &&
        outsideParent
      );

      setDragHierarchyFeedback((current) => {
        const next = {
          draggingNodeId: node.id,
          dropTargetNodeId: dropTarget?.id || null,
          isDetaching,
        };

        if (
          current.draggingNodeId === next.draggingNodeId &&
          current.dropTargetNodeId === next.dropTargetNodeId &&
          current.isDetaching === next.isDetaching
        ) {
          return current;
        }

        return next;
      });
    },
    [data.nodes, nodes]
  );

  const onNodeDragStop: NodeDragHandler = useCallback(
    async (_event, node) => {
      const currentNodes = nodes.map((candidate) =>
        candidate.id === node.id
          ? {
            ...candidate,
            position: node.position,
            parentNode: node.parentNode ?? candidate.parentNode,
          }
          : candidate
      );
      const dtoById = new Map(data.nodes.map((candidate) => [candidate.id, candidate]));
      const draggedDto = dtoById.get(node.id);
      const draggedNode = currentNodes.find((candidate) => candidate.id === node.id) || node;
      if (!draggedDto) {
        setDragHierarchyFeedback({ draggingNodeId: null, dropTargetNodeId: null, isDetaching: false });
        return;
      }

      const draggedAbsolute = getAbsoluteNodePosition(draggedNode, currentNodes);
      const outsideParent = isDraggedNodeOutsideParent(draggedNode, currentNodes);
      const rawDropTarget = findHierarchyDropTarget(draggedNode, currentNodes, dtoById);
      const dropTarget =
        outsideParent && rawDropTarget?.id === draggedDto.parentNodeId ? null : rawDropTarget;
      const shouldDetach = Boolean(
        draggedDto.parentNodeId &&
        !dropTarget &&
        outsideParent
      );

      const nextParentId = dropTarget?.id || (shouldDetach ? null : draggedDto.parentNodeId);
      const parentChanged = (draggedDto?.parentNodeId || null) !== nextParentId;
      const nextPosition = (() => {
        if (dropTarget && parentChanged) {
          const targetAbsolute = getAbsoluteNodePosition(dropTarget, currentNodes);
          return {
            x: Math.max(containerPadding, draggedAbsolute.x - targetAbsolute.x),
            y: Math.max(containerHeaderHeight, draggedAbsolute.y - targetAbsolute.y),
          };
        }

        if (shouldDetach) {
          return draggedAbsolute;
        }

        if (!parentChanged && draggedDto.parentNodeId) {
          return {
            x: Math.max(containerPadding, node.position.x),
            y: Math.max(containerHeaderHeight, node.position.y),
          };
        }

        if (!parentChanged) {
          return node.position;
        }

        return draggedAbsolute;
      })();
      const previousGraphData = queryClient.getQueryData<GraphData>(["graph", projectId]);

      setDragHierarchyFeedback({ draggingNodeId: null, dropTargetNodeId: null, isDetaching: false });
      queryClient.setQueryData<GraphData>(["graph", projectId], (old: GraphData | undefined) => {
        if (!old) return old;
        return updateNodeFrameInGraphData(old, node.id, nextParentId, nextPosition);
      });
      setNodes((currentFlowNodes) =>
        currentFlowNodes.map((flowNode) =>
          flowNode.id === node.id
            ? {
              ...flowNode,
              parentNode: nextParentId || undefined,
              position: nextPosition,
            }
            : flowNode
        )
      );

      // Persist node position to database
      let succeeded = false;
      beginSaving();
      try {
        await persistNodeFrame(node.id, nextParentId, nextPosition.x, nextPosition.y);
        if (parentChanged && dropTarget) {
          toast.success(`Moved inside ${data.nodes.find((n) => n.id === dropTarget.id)?.title || "node"}`);
          onDataChange();
        } else if (parentChanged && shouldDetach) {
          toast.success("Node moved out");
          onDataChange();
        }
        succeeded = true;
      } catch (error) {
        console.error("Failed to save node position:", error);
        toast.error(error instanceof Error ? error.message : "Failed to save position");
        if (previousGraphData) {
          queryClient.setQueryData(["graph", projectId], previousGraphData);
        }
        onDataChange();
      } finally {
        finishSaving(succeeded);
      }
    },
    [beginSaving, data.nodes, finishSaving, nodes, projectId, queryClient, onDataChange, setNodes]
  );

  const createDeletionSnapshot = useCallback(
    (nodeIds: string[], standaloneEdgeIds: string[]): DeletedGraphSnapshot => {
      const selectedNodeIdSet = new Set(nodeIds);
      const standaloneEdgeIdSet = new Set(standaloneEdgeIds);
      const snapshotNodes = data.nodes.filter((node) => selectedNodeIdSet.has(node.id));
      const snapshotEdges = data.edges.filter(
        (edge) =>
          standaloneEdgeIdSet.has(edge.id) ||
          selectedNodeIdSet.has(edge.fromNodeId) ||
          selectedNodeIdSet.has(edge.toNodeId)
      );
      const childParentRestores = data.nodes
        .filter(
          (node) =>
            node.parentNodeId &&
            selectedNodeIdSet.has(node.parentNodeId) &&
            !selectedNodeIdSet.has(node.id)
        )
        .map((node) => ({ nodeId: node.id, parentNodeId: node.parentNodeId! }));
      const itemCount = nodeIds.length + standaloneEdgeIds.length;

      return {
        nodes: snapshotNodes,
        edges: snapshotEdges,
        childParentRestores,
        label: `${itemCount} selected ${itemCount === 1 ? "item" : "items"}`,
      };
    },
    [data.edges, data.nodes]
  );

  const rememberDeletedGraphSnapshot = useCallback((snapshot: DeletedGraphSnapshot) => {
    deletedGraphSnapshotRef.current = snapshot;
  }, []);

  const handleNodeDeleted = useCallback(
    (nodeId: string) => {
      if (selectedNodeIdRef.current === nodeId) {
        selectedNodeIdRef.current = null;
      }
      setSelectedNodeId((currentNodeId) => (currentNodeId === nodeId ? null : currentNodeId));
      setIsSheetOpen(false);
      setNodes((currentNodes) =>
        currentNodes
          .filter((node) => node.id !== nodeId)
          .map((node) =>
            node.parentNode === nodeId
              ? { ...node, parentNode: undefined, extent: undefined }
              : node
          )
      );
      setEdges((currentEdges) =>
        currentEdges.filter((edge) => edge.source !== nodeId && edge.target !== nodeId)
      );
    },
    [setEdges, setNodes]
  );

  const restoreDeletedGraphItems = useCallback(async () => {
    const snapshot = deletedGraphSnapshotRef.current;
    if (!snapshot) return;

    deletedGraphSnapshotRef.current = null;
    let succeeded = false;
    beginSaving();

    queryClient.setQueryData<GraphData>(["graph", projectId], (old) => {
      if (!old) return old;
      return restoreGraphData(old, snapshot);
    });

    try {
      const res = await fetch(`/api/projects/${projectId}/graph/restore`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nodes: snapshot.nodes,
          edges: snapshot.edges,
          childParentRestores: snapshot.childParentRestores,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to undo deletion");
      }

      toast.success("Deleted item restored");
      onDataChange();
      succeeded = true;
    } catch (error) {
      deletedGraphSnapshotRef.current = snapshot;
      toast.error(error instanceof Error ? error.message : "Failed to undo deletion");
      onDataChange();
    } finally {
      finishSaving(succeeded);
    }
  }, [beginSaving, finishSaving, onDataChange, projectId, queryClient]);

  const deleteSelectedGraphItems = useCallback(async () => {
    const selectedNodeIdsFromFlow = nodes.filter((node) => node.selected).map((node) => node.id);
    const selectedEdgeIds = edges.filter((edge) => edge.selected).map((edge) => edge.id);
    const fallbackNodeId = selectedNodeIdRef.current;
    const shouldUseSelectedNodeFallback =
      selectedNodeIdsFromFlow.length === 0 &&
      selectedEdgeIds.length === 0 &&
      !isSheetOpen &&
      typeof fallbackNodeId === "string" &&
      nodes.some((node) => node.id === fallbackNodeId);
    const selectedNodeIds = shouldUseSelectedNodeFallback ? [fallbackNodeId] : selectedNodeIdsFromFlow;

    if (selectedNodeIds.length === 0 && selectedEdgeIds.length === 0) return;

    const selectedNodeIdSet = new Set(selectedNodeIds);
    const standaloneEdgeIds = selectedEdgeIds.filter((edgeId) => {
      const edge = edges.find((candidate) => candidate.id === edgeId);
      return edge && !selectedNodeIdSet.has(edge.source) && !selectedNodeIdSet.has(edge.target);
    });
    const snapshot = createDeletionSnapshot(selectedNodeIds, standaloneEdgeIds);
    rememberDeletedGraphSnapshot(snapshot);

    let succeeded = false;
    beginSaving();

    try {
      selectedNodeIds.forEach((nodeId) => handleNodeDeleted(nodeId));

      if (standaloneEdgeIds.length > 0) {
        const standaloneEdgeIdSet = new Set(standaloneEdgeIds);
        setEdges((currentEdges) => currentEdges.filter((edge) => !standaloneEdgeIdSet.has(edge.id)));
        queryClient.setQueryData<GraphData>(["graph", projectId], (old) => {
          if (!old) return old;
          return {
            ...old,
            edges: old.edges.filter((edge) => !standaloneEdgeIdSet.has(edge.id)),
          };
        });
      }

      for (const nodeId of selectedNodeIds) {
        await deleteNodeMutation.mutateAsync({ nodeId, projectId });
      }

      await Promise.all(
        standaloneEdgeIds.map(async (edgeId) => {
          const res = await fetch(`/api/edges/${edgeId}`, { method: "DELETE" });
          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(data.error || "Failed to delete connection");
          }
        })
      );

      toast.success(`${snapshot.label} deleted`);
      onDataChange();
      succeeded = true;
    } catch (error) {
      deletedGraphSnapshotRef.current = null;
      toast.error(error instanceof Error ? error.message : "Failed to delete selected item");
      onDataChange();
    } finally {
      finishSaving(succeeded);
    }
  }, [
    beginSaving,
    createDeletionSnapshot,
    deleteNodeMutation,
    edges,
    finishSaving,
    handleNodeDeleted,
    isSheetOpen,
    nodes,
    onDataChange,
    projectId,
    queryClient,
    rememberDeletedGraphSnapshot,
    setEdges,
  ]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") {
        if (event.shiftKey || shouldIgnoreGraphDeleteKey(event.target)) return;
        if (!deletedGraphSnapshotRef.current) return;
        event.preventDefault();
        void restoreDeletedGraphItems();
        return;
      }

      if (event.key !== "Delete" && event.key !== "Backspace") return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (isSheetOpen || addNodeOpen || editingEdge) return;
      if (shouldIgnoreGraphDeleteKey(event.target)) return;

      const fallbackNodeId = selectedNodeIdRef.current;
      const hasSelection =
        nodes.some((node) => node.selected) ||
        edges.some((edge) => edge.selected) ||
        Boolean(fallbackNodeId && nodes.some((node) => node.id === fallbackNodeId));
      if (!hasSelection) return;

      event.preventDefault();
      void deleteSelectedGraphItems();
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [addNodeOpen, deleteSelectedGraphItems, edges, editingEdge, isSheetOpen, nodes, restoreDeletedGraphItems]);

  const handleOrganizeApply = useCallback(
    (positions: Array<{ nodeId: string; x: number; y: number }>) => {
      // Update local state immediately
      setNodes((nds) =>
        nds.map((node) => {
          const newPos = positions.find((p) => p.nodeId === node.id);
          if (newPos) {
            return {
              ...node,
              position: { x: newPos.x, y: newPos.y },
            };
          }
          return node;
        })
      );

      // Refetch data to sync with server
      onDataChange();
    },
    [setNodes, onDataChange]
  );

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-white shadow-inner md:rounded-lg md:border">
      {/* Action Center Bar at Top */}
      <ActionCenterBar
        nodes={data.nodes}
        edges={data.edges}
        userId={session?.user?.id || ""}
        saveStatus={saveStatus}
        lastSavedAt={lastSavedAt}
        onNodeClick={selectOnlyNode}
      />

      {/* Canvas (full remaining height) */}
      <div className="flex-1 relative" onClick={() => setContextMenu(null)}>
        <Toolbar
          orgId={orgId}
          projectId={projectId}
          filterStatus={filterStatus}
          onFilterChange={setFilterStatus}
          selectedTeamIds={selectedTeamIds}
          onTeamFilterChange={setSelectedTeamIds}
          selectedUserIds={selectedUserIds}
          onUserFilterChange={setSelectedUserIds}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onDataChange={onDataChange}
          nodes={nodes}
          edges={edges}
          onOrganizeApply={handleOrganizeApply}
          onPendingSaveChange={changePendingSaveCount}
        />
        <ReactFlow
          nodes={visibleNodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onEdgeClick={onEdgeClick}
          onNodeClick={(_event, node) => {
            selectOnlyNode(node.id);
          }}
          onNodeDragStart={onNodeDragStart}
          onNodeDrag={onNodeDrag}
          onNodeDragStop={onNodeDragStop}
          onInit={(instance) => {
            reactFlowInstanceRef.current = instance;
          }}
          nodeTypes={nodeTypes}
          deleteKeyCode={null}
          connectionLineType={ConnectionLineType.Bezier}
          connectionLineStyle={graphEdgeStyle}
          fitView
          snapToGrid
          snapGrid={[15, 15]}
          onPaneContextMenu={(event) => {
            event.preventDefault();
            const flowPosition = reactFlowInstanceRef.current?.screenToFlowPosition({
              x: event.clientX,
              y: event.clientY,
            }) ?? { x: event.clientX, y: event.clientY };

            setContextMenu({
              x: event.clientX,
              y: event.clientY,
              canvasX: flowPosition.x,
              canvasY: flowPosition.y,
            });
          }}
          onPaneClick={() => {
            setContextMenu(null);
            clearSelection();
          }}
        >
          <Background color="#f1f5f9" gap={15} />
          <Controls />
          <MiniMap className="hidden sm:block" nodeStrokeColor="#e2e8f0" nodeColor="#f8fafc" />
        </ReactFlow>

        {/* Empty State */}
        {data.nodes.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl border border-slate-200 p-8 text-center max-w-md pointer-events-auto">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center">
                <svg className="w-8 h-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-slate-800 mb-2">No nodes yet</h3>
              <p className="text-slate-500 text-sm mb-6">
                Right-click anywhere on the canvas to add your first node,
                or click the button below to get started.
              </p>
              <Button
                onClick={() => {
                  setAddNodeParent(null);
                  setAddNodePosition(null);
                  setAddNodeOpen(true);
                }}
                className="bg-blue-600 hover:bg-blue-700 text-white shadow-md"
              >
                <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add First Node
              </Button>
            </div>
          </div>
        )}

        {/* Context Menu */}
        {contextMenu && (
          <CanvasContextMenu
            position={contextMenu}
            onClose={() => setContextMenu(null)}
            onAddNode={(x, y) => {
              setAddNodeParent(null);
              setAddNodePosition({ x, y });
              setAddNodeOpen(true);
            }}
          />
        )}
      </div>

      {/* Add Node Dialog */}
      <AddNodeDialog
        projectId={projectId}
        orgId={orgId}
        parentNodeId={addNodeParent?.id || null}
        parentNodeTitle={addNodeParent?.title || null}
        initialPosition={addNodePosition}
        open={addNodeOpen}
        onOpenChange={(open) => {
          setAddNodeOpen(open);
          if (!open) {
            setAddNodeParent(null);
            setAddNodePosition(null);
          }
        }}
        onSuccess={() => {
          onDataChange();
          setAddNodeParent(null);
          setAddNodePosition(null);
          setAddNodeOpen(false);
        }}
        onPendingSaveChange={changePendingSaveCount}
      />

      {/* Edge Edit Dialog */}
      <Dialog open={!!editingEdge} onOpenChange={() => setEditingEdge(null)}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Edit Relationship</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <Label>Update the relation type</Label>
              <Select value={relation} onValueChange={setRelation}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DEPENDS_ON">Depends On</SelectItem>
                  <SelectItem value="HANDOFF_TO">Handoff To</SelectItem>
                  <SelectItem value="NEEDS_INFO_FROM">Needs Info From</SelectItem>
                  <SelectItem value="APPROVAL_BY">Approval By</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="flex justify-between sm:justify-between items-center w-full">
            <Button
              variant="destructive"
              size="sm"
              onClick={async () => {
                if (!editingEdge) return;
                setIsSyncing(true);
                let succeeded = false;
                beginSaving();
                try {
                  const res = await fetch(`/api/edges/${editingEdge.id}`, { method: "DELETE" });
                  if (!res.ok) throw new Error("Delete failed");
                  toast.success("Connection removed");
                  onDataChange();
                  setEditingEdge(null);
                  succeeded = true;
                } catch {
                  toast.error("Failed to delete connection");
                } finally {
                  setIsSyncing(false);
                  finishSaving(succeeded);
                }
              }}
            >
              Remove
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setEditingEdge(null)}>Cancel</Button>
              <Button size="sm" onClick={handleUpdateEdge} disabled={isSyncing}>
                {isSyncing ? "Saving..." : "Update"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Node Detail Sheet */}
      <NodeDetailSheet
        node={data.nodes.find(n => n.id === selectedNodeId) || null}
        open={!!selectedNodeId && isSheetOpen}
        onOpenChange={(open: boolean) => setIsSheetOpen(open)}
        projectId={projectId}
        orgId={orgId}
        onDataChange={onDataChange}
        onDeleted={(nodeId) => {
          rememberDeletedGraphSnapshot(createDeletionSnapshot([nodeId], []));
          handleNodeDeleted(nodeId);
        }}
        onPendingSaveChange={changePendingSaveCount}
      />
    </div>
  );
}
