"use client";

import { useState, type ReactNode } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Network, List } from "lucide-react";
import { GraphCanvas } from "@/components/graph/GraphCanvas";
import { ProjectListView } from "@/components/graph/ProjectListView";
import { GraphData } from "@/types";

type ProjectView = "graph" | "list";

export default function GraphPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const projectId = params.projectId as string;
  const urlFocusNodeId = searchParams.get("nodeId");

  const [view, setView] = useState<ProjectView>("graph");
  const [focusNodeId, setFocusNodeId] = useState<string | null>(urlFocusNodeId);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["graph", projectId],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/graph`);
      if (!res.ok) throw new Error("Failed to fetch graph");
      return res.json() as Promise<GraphData>;
    },
  });

  if (isLoading) {
    return <div className="text-center text-muted-foreground">Loading graph...</div>;
  }

  if (!data) {
    return <div className="text-center text-muted-foreground">No data available</div>;
  }

  const orgId = data.nodes[0]?.orgId;

  return (
    <div className="flex flex-col h-[calc(100vh-12rem)]">
      {/* 뷰 전환 탭 */}
      <div className="flex items-center gap-1 border-b border-slate-200 bg-white px-3 py-1.5">
        <ViewTab
          active={view === "graph"}
          onClick={() => setView("graph")}
          icon={<Network className="w-4 h-4" />}
          label="그래프"
        />
        <ViewTab
          active={view === "list"}
          onClick={() => setView("list")}
          icon={<List className="w-4 h-4" />}
          label="목록"
        />
      </div>

      <div className="flex-1 overflow-hidden">
        {view === "graph" ? (
          <GraphCanvas
            projectId={projectId}
            orgId={orgId}
            data={data}
            onDataChange={refetch}
            focusNodeId={focusNodeId}
          />
        ) : (
          <ProjectListView
            nodes={data.nodes}
            onSelectNode={(nodeId) => {
              setFocusNodeId(nodeId);
              setView("graph");
            }}
          />
        )}
      </div>
    </div>
  );
}

function ViewTab({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
        active
          ? "bg-slate-900 text-white"
          : "text-slate-500 hover:text-slate-800 hover:bg-slate-100"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
