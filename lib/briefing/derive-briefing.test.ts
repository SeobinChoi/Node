import { describe, it, expect } from "vitest";
import { deriveBriefing } from "./derive-briefing";
import type { GraphData, NodeDTO, EdgeDTO } from "@/types";

// 2026-07-17 00:00 로컬 기준으로 고정
const NOW = new Date(2026, 6, 17).getTime();
const day = (offset: number) => new Date(2026, 6, 17 + offset).toISOString();

let seq = 0;
function node(partial: Partial<NodeDTO> & { id: string; title: string }): NodeDTO {
  seq++;
  return {
    orgId: "org",
    projectId: "proj",
    parentNodeId: null,
    teamId: null,
    teamName: null,
    ownerId: null,
    ownerName: null,
    teams: [],
    owners: [],
    description: null,
    type: "TASK",
    manualStatus: "TODO",
    computedStatus: "TODO",
    priority: 3,
    dueAt: null,
    phase: null,
    createdAt: day(-30),
    updatedAt: day(-1),
    positionX: 0,
    positionY: seq * 170,
    ...partial,
  } as NodeDTO;
}

function edge(fromNodeId: string, toNodeId: string, relation = "DEPENDS_ON"): EdgeDTO {
  return {
    id: `${fromNodeId}->${toNodeId}:${relation}`,
    orgId: "org",
    projectId: "proj",
    fromNodeId,
    toNodeId,
    relation,
    createdAt: day(-10),
  } as EdgeDTO;
}

const graph = (nodes: NodeDTO[], edges: EdgeDTO[] = []): GraphData => ({ nodes, edges });

describe("deriveBriefing", () => {
  it("empty graph → isEmpty, null deadline, empty queue", () => {
    const m = deriveBriefing(graph([]), NOW);
    expect(m.isEmpty).toBe(true);
    expect(m.situation.nearestDeadline).toBeNull();
    expect(m.situation.rootCauses).toEqual([]);
    expect(m.queue).toEqual([]);
    expect(m.situation.headlineKo).toBe("등록된 업무가 없습니다.");
  });

  it("no dueAt anywhere → nearestDeadline null, still builds queue", () => {
    const m = deriveBriefing(
      graph([node({ id: "a", title: "A", computedStatus: "DOING", manualStatus: "DOING" })]),
      NOW
    );
    expect(m.situation.nearestDeadline).toBeNull();
    expect(m.queue).toHaveLength(1);
    expect(m.queue[0].category).toBe("DO_NOW");
    expect(m.queue[0].reasonKo).toBe("진행 중");
  });

  it("linear chain A←B←C: root cause is the deepest incomplete prerequisite", () => {
    // C depends on B depends on A(미완료·TODO). B,C = BLOCKED.
    const nodes = [
      node({ id: "a", title: "A", computedStatus: "TODO" }),
      node({ id: "b", title: "B", computedStatus: "BLOCKED" }),
      node({ id: "c", title: "C", computedStatus: "BLOCKED" }),
    ];
    const edges = [edge("b", "a"), edge("c", "b")];
    const m = deriveBriefing(graph(nodes, edges), NOW);
    expect(m.situation.rootCauses).toHaveLength(1);
    expect(m.situation.rootCauses[0].node.id).toBe("a");
    expect(m.situation.rootCauses[0].blockedDownstreamCount).toBe(2);
  });

  it("diamond funnel: two blocked nodes share one root, count 2", () => {
    const nodes = [
      node({ id: "root", title: "Root", computedStatus: "DOING", manualStatus: "DOING" }),
      node({ id: "x", title: "X", computedStatus: "BLOCKED" }),
      node({ id: "y", title: "Y", computedStatus: "BLOCKED" }),
    ];
    const edges = [edge("x", "root"), edge("y", "root")];
    const m = deriveBriefing(graph(nodes, edges), NOW);
    expect(m.situation.rootCauses[0].node.id).toBe("root");
    expect(m.situation.rootCauses[0].blockedDownstreamCount).toBe(2);
  });

  it("cyclic DEPENDS_ON terminates (no infinite loop)", () => {
    const nodes = [
      node({ id: "a", title: "A", computedStatus: "BLOCKED" }),
      node({ id: "b", title: "B", computedStatus: "BLOCKED" }),
    ];
    const edges = [edge("a", "b"), edge("b", "a")];
    const m = deriveBriefing(graph(nodes, edges), NOW);
    // 사이클이면 종단(미완료 선행 없음)이 없어 root cause가 비어도 된다 — 종료가 핵심
    expect(m.queue).toHaveLength(2);
  });

  it("overdue beats blocked: node lands in OVERDUE with 기한 N일 초과", () => {
    const nodes = [
      node({ id: "pre", title: "선행", computedStatus: "TODO" }),
      node({ id: "late", title: "지연업무", computedStatus: "BLOCKED", dueAt: day(-2) }),
    ];
    const m = deriveBriefing(graph(nodes, [edge("late", "pre")]), NOW);
    const item = m.queue.find((q) => q.node.id === "late")!;
    expect(item.category).toBe("OVERDUE");
    expect(item.overdueDays).toBe(2);
    expect(item.reasonKo).toBe("기한 2일 초과");
    expect(m.queue[0].node.id).toBe("late"); // OVERDUE 그룹이 맨 앞
  });

  it("blocked-by-deps: reason names first prerequisite, focus deep-links to it", () => {
    const nodes = [
      node({ id: "pre", title: "선행 자료", computedStatus: "DOING", manualStatus: "DOING" }),
      node({ id: "blk", title: "취합", computedStatus: "BLOCKED" }),
    ];
    const m = deriveBriefing(graph(nodes, [edge("blk", "pre")]), NOW);
    const item = m.queue.find((q) => q.node.id === "blk")!;
    expect(item.reasonKo).toBe("선행 1건 미완료 · 선행 자료");
    expect(item.actionLabel).toBe("선행 업무 보기");
    expect(item.focusNodeId).toBe("pre");
  });

  it("approval-only waiting → 승인 대기", () => {
    const nodes = [
      node({ id: "appr", title: "승인자", computedStatus: "DONE", manualStatus: "DONE" }),
      node({ id: "w", title: "검토", computedStatus: "WAITING", waitingReason: "Waiting for approval" }),
    ];
    const m = deriveBriefing(graph(nodes, [edge("w", "appr", "APPROVAL_BY")]), NOW);
    const item = m.queue.find((q) => q.node.id === "w")!;
    expect(item.category).toBe("WAITING");
    expect(item.reasonKo).toBe("승인 대기");
    expect(item.actionLabel).toBe("승인 확인");
  });

  it("dangling edges (missing endpoint) are ignored", () => {
    const nodes = [node({ id: "solo", title: "홀로", computedStatus: "BLOCKED" })];
    const m = deriveBriefing(graph(nodes, [edge("solo", "ghost")]), NOW);
    const item = m.queue[0];
    // ghost 엣지는 무시 → 선행 없음 → 폴백 사유
    expect(item.focusNodeId).toBe("solo");
    expect(item.category).toBe("BLOCKED");
  });

  it("nearest deadline picks earliest non-DONE due date and computes D-day", () => {
    const nodes = [
      node({ id: "d1", title: "빠른 마감", dueAt: day(3), computedStatus: "TODO" }),
      node({ id: "d2", title: "늦은 마감", dueAt: day(14), computedStatus: "TODO" }),
      node({ id: "d0", title: "완료된 것", dueAt: day(1), computedStatus: "DONE", manualStatus: "DONE" }),
    ];
    const m = deriveBriefing(graph(nodes), NOW);
    expect(m.situation.nearestDeadline?.node.id).toBe("d1");
    expect(m.situation.nearestDeadline?.daysUntil).toBe(3);
    expect(m.situation.nearestDeadline?.overdue).toBe(false);
  });

  it("headline mentions deadline, blocked count and root cause", () => {
    const nodes = [
      node({ id: "pre", title: "학과별 실적 자료 취합", computedStatus: "TODO" }),
      node({ id: "rep", title: "연차보고서 최종 제출", computedStatus: "BLOCKED", dueAt: day(14), blocksCount: 0 }),
    ];
    const m = deriveBriefing(graph(nodes, [edge("rep", "pre")]), NOW);
    expect(m.situation.headlineKo).toContain("D-14");
    expect(m.situation.headlineKo).toContain("1건이 막혀");
    expect(m.situation.headlineKo).toContain("학과별 실적 자료 취합");
  });

  it("counts rollup matches list-view semantics", () => {
    const nodes = [
      node({ id: "1", title: "1", computedStatus: "DONE", manualStatus: "DONE" }),
      node({ id: "2", title: "2", computedStatus: "DOING", manualStatus: "DOING" }),
      node({ id: "3", title: "3", computedStatus: "BLOCKED" }),
      node({ id: "4", title: "4", computedStatus: "WAITING" }),
      node({ id: "5", title: "5", computedStatus: "TODO", dueAt: day(-1) }),
    ];
    const m = deriveBriefing(graph(nodes), NOW);
    expect(m.situation.counts).toMatchObject({ total: 5, done: 1, doing: 1, blocked: 1, waiting: 1, overdue: 1, rate: 20 });
  });
});
