export interface GraphPosition {
  x: number;
  y: number;
}

export const GRAPH_NODE_WIDTH = 264;
export const GRAPH_NODE_HEIGHT = 132;
// Board cell = one node "slot". Kept slightly larger than the card so each
// node sits inside its own board rectangle (Azure DevOps Boards style).
export const GRAPH_GRID_COLUMN_WIDTH = 300;
export const GRAPH_GRID_ROW_HEIGHT = 170;
export const GRAPH_CHILD_GRID_MIN_X = 32;
export const GRAPH_CHILD_GRID_MIN_Y = 76;

export function snapGraphNodePosition(
  position: GraphPosition,
  options: { isChild?: boolean } = {}
): GraphPosition {
  const minX = options.isChild ? GRAPH_CHILD_GRID_MIN_X : 0;
  const minY = options.isChild ? GRAPH_CHILD_GRID_MIN_Y : 0;

  return {
    x: Math.max(
      minX,
      minX + Math.round((position.x - minX) / GRAPH_GRID_COLUMN_WIDTH) * GRAPH_GRID_COLUMN_WIDTH
    ),
    y: Math.max(
      minY,
      minY + Math.round((position.y - minY) / GRAPH_GRID_ROW_HEIGHT) * GRAPH_GRID_ROW_HEIGHT
    ),
  };
}
