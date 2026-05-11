import { useMutation, useQueryClient } from "@tanstack/react-query";
import { NodeDTO, GraphData } from "@/types";
import { toast } from "sonner";

interface UpdateNodePayload {
    nodeId: string;
    projectId: string;
    updates: Partial<NodeDTO> & { ownerIds?: string[] };
}

interface DeleteNodePayload {
    nodeId: string;
    projectId: string;
}

function removeNodeFromGraphData(graphData: GraphData, nodeId: string): GraphData {
    const deletedNode = graphData.nodes.find((node) => node.id === nodeId);

    return {
        ...graphData,
        nodes: graphData.nodes
            .filter((node) => node.id !== nodeId)
            .map((node) => {
                if (node.parentNodeId === nodeId) {
                    return { ...node, parentNodeId: null };
                }

                if (deletedNode?.parentNodeId && node.id === deletedNode.parentNodeId) {
                    return {
                        ...node,
                        childCount: Math.max(0, (node.childCount || 0) - 1),
                    };
                }

                return node;
            }),
        edges: graphData.edges.filter(
            (edge) => edge.fromNodeId !== nodeId && edge.toNodeId !== nodeId
        ),
    };
}

export const useUpdateNode = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ nodeId, updates }: UpdateNodePayload) => {
            const res = await fetch(`/api/nodes/${nodeId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(updates),
            });

            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.error || "Failed to update node");
            }
            return res.json();
        },
        onMutate: async ({ nodeId, projectId, updates }) => {
            // Cancel any outgoing refetches (so they don't overwrite our optimistic update)
            await queryClient.cancelQueries({ queryKey: ["graph", projectId] });

            // Snapshot the previous value
            const previousGraphData = queryClient.getQueryData<GraphData>(["graph", projectId]);

            // Optimistically update to the new value
            if (previousGraphData) {
                queryClient.setQueryData<GraphData>(["graph", projectId], {
                    ...previousGraphData,
                    nodes: previousGraphData.nodes.map((n) => {
                        if (n.id === nodeId) {
                            const updatedNode = {
                                ...n,
                                ...updates,
                                ...(updates.manualStatus ? { computedStatus: updates.manualStatus } : {}),
                            };

                            return updatedNode;
                        }
                        return n;
                    }),
                });
            }

            return { previousGraphData };
        },
        onError: (err, variables, context) => {
            toast.error(`Update failed: ${err.message}`);
            if (context?.previousGraphData) {
                queryClient.setQueryData(["graph", variables.projectId], context.previousGraphData);
            }
        },
        onSettled: (data, error, variables) => {
            // Invalidate and refetch to ensure we're in sync with the server
            queryClient.invalidateQueries({ queryKey: ["graph", variables.projectId] });
        },
    });
};

export const useDeleteNode = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ nodeId }: DeleteNodePayload) => {
            const res = await fetch(`/api/nodes/${nodeId}`, {
                method: "DELETE",
            });

            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.error || "Failed to delete node");
            }

            return res.json();
        },
        onMutate: async ({ nodeId, projectId }) => {
            await Promise.all([
                queryClient.cancelQueries({ queryKey: ["graph", projectId] }),
                queryClient.cancelQueries({ queryKey: ["node-page", nodeId] }),
                queryClient.cancelQueries({ queryKey: ["node-comments", nodeId] }),
                queryClient.cancelQueries({ queryKey: ["node-attachments", nodeId] }),
            ]);

            const previousGraphData = queryClient.getQueryData<GraphData>(["graph", projectId]);

            if (previousGraphData) {
                queryClient.setQueryData<GraphData>(
                    ["graph", projectId],
                    removeNodeFromGraphData(previousGraphData, nodeId)
                );
            }

            return { previousGraphData };
        },
        onSuccess: (_data, variables) => {
            queryClient.removeQueries({ queryKey: ["node-page", variables.nodeId] });
            queryClient.removeQueries({ queryKey: ["node-comments", variables.nodeId] });
            queryClient.removeQueries({ queryKey: ["node-attachments", variables.nodeId] });
        },
        onError: (err, variables, context) => {
            toast.error(`Delete failed: ${err.message}`);
            if (context?.previousGraphData) {
                queryClient.setQueryData(["graph", variables.projectId], context.previousGraphData);
            }
        },
        onSettled: (_data, _error, variables) => {
            queryClient.invalidateQueries({ queryKey: ["graph", variables.projectId] });
        },
    });
};
