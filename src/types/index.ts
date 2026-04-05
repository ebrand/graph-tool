export interface GraphNode {
  id: string;
  name: string;
  type: string;
  description: string;
  color: string;
  position: { x: number; y: number };
}

export interface Relationship {
  id: string;
  sourceId: string;
  targetId: string;
  name: string;
  type: string;
  weight: number;
}

export interface DragState {
  sourceNodeId: string;
  startPoint: { x: number; y: number };
  currentPoint: { x: number; y: number };
}

export interface NodeDragState {
  nodeId: string;
  offset: { x: number; y: number };
}

export interface ThemeColors {
  canvasBg: string;
  canvasGridMajor: string;
  canvasGridMinor: string;
  nodeBackground: string;
  nodeForeground: string;
  nodeBorder: string;
  selectionHighlight: string;
  relationshipLine: string;
  relationshipText: string;
}

export interface GridSettings {
  minorGridPx: number;
  majorGridPx: number;
  snapEnabled: boolean;
}

export interface NodeSettings {
  minWidthPx: number;
  edgeGapPx: number;
  jiggleEnabled: boolean;
  shadowsEnabled: boolean;
  palette: string[];
  relTextPosition: number; // 0 = source end, 50 = center, 100 = target end
}
