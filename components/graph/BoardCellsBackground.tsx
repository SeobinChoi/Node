"use client";

import { useId } from "react";
import { useStore, type ReactFlowState } from "reactflow";

import {
  GRAPH_GRID_COLUMN_WIDTH,
  GRAPH_GRID_ROW_HEIGHT,
  GRAPH_NODE_HEIGHT,
  GRAPH_NODE_WIDTH,
} from "@/lib/utils/graph-grid";

// 노드 좌표는 셀 배수(k*300, j*170)이고 카드는 그보다 작다(264x132).
// 그래서 셀 경계를 슬랙의 절반만큼 당겨야 카드가 board 사각형 가운데에 온다.
// reactflow의 <Background variant="lines">는 offset prop이 lines에서 무시되고
// 항상 타일 중앙에 선을 그어서 이 조정을 할 수 없다 → 패턴을 직접 그린다.
const CELL_ORIGIN_X = -(GRAPH_GRID_COLUMN_WIDTH - GRAPH_NODE_WIDTH) / 2;
const CELL_ORIGIN_Y = -(GRAPH_GRID_ROW_HEIGHT - GRAPH_NODE_HEIGHT) / 2;

const transformSelector = (state: ReactFlowState) => state.transform;

/** JS의 %는 음수를 그대로 두므로 항상 [0, m) 으로 접는다. */
const wrap = (value: number, modulus: number) => ((value % modulus) + modulus) % modulus;

interface BoardCellsBackgroundProps {
  color?: string;
  lineWidth?: number;
  backgroundColor?: string;
}

export function BoardCellsBackground({
  color = "#cbd5e1",
  lineWidth = 1.5,
  backgroundColor = "#f8fafc",
}: BoardCellsBackgroundProps) {
  const [translateX, translateY, zoom] = useStore(transformSelector);
  // url(#id) 안에 들어가므로 useId의 콜론을 제거한다.
  const patternId = `board-cells-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;

  const cellWidth = GRAPH_GRID_COLUMN_WIDTH * zoom;
  const cellHeight = GRAPH_GRID_ROW_HEIGHT * zoom;

  // 셀 경계가 flow 좌표 (k*COLUMN + CELL_ORIGIN_X)에 오도록 패턴 원점을 맞춘다.
  const patternX = wrap(translateX + CELL_ORIGIN_X * zoom, cellWidth);
  const patternY = wrap(translateY + CELL_ORIGIN_Y * zoom, cellHeight);

  return (
    <svg
      className="react-flow__background"
      data-testid="rf__board-cells"
      style={{
        backgroundColor,
        position: "absolute",
        width: "100%",
        height: "100%",
        top: 0,
        left: 0,
      }}
    >
      <pattern
        id={patternId}
        x={patternX}
        y={patternY}
        width={cellWidth}
        height={cellHeight}
        patternUnits="userSpaceOnUse"
      >
        {/* 타일 좌상단 = 셀 경계 */}
        <path
          d={`M0 0 V${cellHeight} M0 0 H${cellWidth}`}
          stroke={color}
          strokeWidth={lineWidth}
          fill="none"
        />
      </pattern>
      <rect x="0" y="0" width="100%" height="100%" fill={`url(#${patternId})`} />
    </svg>
  );
}
