"use client";

import { useState, type ReactNode } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Network, List, Sparkles } from "lucide-react";
import { GraphCanvas } from "@/components/graph/GraphCanvas";
import { ProjectListView } from "@/components/graph/ProjectListView";
import { ProjectBriefingView } from "@/components/graph/ProjectBriefingView";
import { GraphData } from "@/types";

type ProjectView = "briefing" | "graph" | "list";

export default function ProjectGraphPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const projectId = params.projectId as string;
  const orgId = params.orgId as string;
  const urlFocusNodeId = searchParams.get("nodeId");

  // ?nodeId= 딥링크는 보드로, 그 외에는 브리핑이 기본 화면
  const [view, setView] = useState<ProjectView>(urlFocusNodeId ? "graph" : "briefing");
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
    return <div className="text-center text-muted-foreground">그래프를 불러오는 중...</div>;
  }

  if (!data) {
    return <div className="text-center text-muted-foreground">데이터가 없습니다</div>;
  }

  return (
    <div className="flex flex-col h-full">
      {/* 뷰 전환 탭 */}
      <div className="flex items-center gap-1 border-b border-border bg-background px-3 py-1.5">
        <ViewTab
          active={view === "briefing"}
          onClick={() => setView("briefing")}
          icon={<Sparkles className="w-4 h-4" />}
          label="브리핑"
        />
        <ViewTab
          active={view === "graph"}
          onClick={() => setView("graph")}
          icon={<Network className="w-4 h-4" />}
          label="보드"
        />
        <ViewTab
          active={view === "list"}
          onClick={() => setView("list")}
          icon={<List className="w-4 h-4" />}
          label="목록"
        />
      </div>

      <div className="flex-1 overflow-hidden">
        {view === "briefing" ? (
          <ProjectBriefingView
            data={data}
            projectId={projectId}
            onDataChange={refetch}
            onSelectNode={(nodeId) => {
              setFocusNodeId(nodeId);
              setView("graph");
            }}
          />
        ) : view === "graph" ? (
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
            projectId={projectId}
            onDataChange={refetch}
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
          ? "bg-brand text-brand-foreground"
          : "text-muted-foreground hover:text-foreground hover:bg-accent"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
