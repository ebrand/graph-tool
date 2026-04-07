export type MetadataType = 'string' | 'number' | 'boolean' | 'date';

export type Cardinality = '1' | '0..1' | '1..*' | '0..*';

export type RelationshipKind = 'regular' | 'inherits-from';

export interface MetadataEntry {
  name: string;
  dataType: MetadataType;
  required: boolean;
}

export interface GraphNode {
  id: string;
  name: string;
  type: string;
  description: string;
  color: string;
  position: { x: number; y: number };
  metadata: MetadataEntry[];
  abstract: boolean;
}

export interface Relationship {
  id: string;
  sourceId: string;
  targetId: string;
  name: string;
  type: string;
  weight: number;
  metadata: MetadataEntry[];
  sourceCardinality: Cardinality;
  targetCardinality: Cardinality;
  kind: RelationshipKind;
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
  abstractColor: string;
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

export interface FieldValue {
  fieldName: string;
  value: string | number | boolean | null;
}

export interface NodeInstance {
  id: string;
  schemaNodeId: string;
  label: string;
  fields: FieldValue[];
  createdAt: string; // ISO 8601
  position: { x: number; y: number };
}

export interface RelationshipInstance {
  id: string;
  schemaRelationshipId: string;
  sourceInstanceId: string;
  targetInstanceId: string;
  fields: FieldValue[];
  createdAt: string;
}
