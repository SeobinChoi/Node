// React Flow 캔버스 요소(SVG/캔버스 렌더러)는 Tailwind 클래스나 CSS 변수를 직접 못 받아서
// 리터럴 색이 필요하다. 흩어져 있던 hex를 여기 한 곳에 모은다.
// 값은 slate 팔레트 기준 — globals.css의 라이트 테마와 맞춘 값.

export const GRAPH_COLORS = {
  /** 엣지 선 (slate-400) */
  edgeStroke: "#94a3b8",
  /** 엣지 화살표 (slate-500) */
  edgeArrow: "#64748b",
  /** 보드 셀 격자선 (slate-300) */
  gridLine: "#cbd5e1",
  /** 캔버스 바탕 (slate-50) */
  canvasBg: "#f8fafc",
  /** 미니맵 노드 테두리 (slate-200) */
  minimapNodeStroke: "#e2e8f0",
  /** 미니맵 노드 채움 (slate-50) */
  minimapNodeFill: "#f8fafc",
} as const;
