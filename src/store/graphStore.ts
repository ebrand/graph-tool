import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { GraphNode, Relationship, DragState, NodeDragState, ThemeColors, GridSettings, NodeSettings, MetadataEntry, Cardinality, RelationshipKind } from '@/types';
import { snapToGrid } from '@/utils/geometry';
import { forceDirectedLayout } from '@/utils/forceLayout';

function migrateMetadata(raw: unknown): MetadataEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((m: unknown): MetadataEntry => {
    if (typeof m === 'string') return { name: m, dataType: 'string', required: false };
    if (m && typeof m === 'object') {
      const obj = m as Record<string, unknown>;
      const required = typeof obj.required === 'boolean' ? obj.required : false;
      if ('name' in obj && 'dataType' in obj) return { ...obj as unknown as MetadataEntry, required };
      if ('key' in obj) return { name: String(obj.key ?? ''), dataType: 'string', required };
    }
    return { name: '', dataType: 'string', required: false };
  });
}

function migrateNode(raw: Record<string, unknown>): GraphNode {
  return {
    id: String(raw.id ?? ''),
    name: String(raw.name ?? ''),
    type: String(raw.type ?? 'default'),
    description: String(raw.description ?? ''),
    color: String(raw.color ?? '#4f46e5'),
    position: (raw.position as { x: number; y: number }) ?? { x: 0, y: 0 },
    metadata: migrateMetadata(raw.metadata),
    abstract: typeof raw.abstract === 'boolean' ? raw.abstract : false,
  };
}

function migrateRelationship(raw: Record<string, unknown>): Relationship {
  return {
    id: String(raw.id ?? ''),
    sourceId: String(raw.sourceId ?? ''),
    targetId: String(raw.targetId ?? ''),
    name: String(raw.name ?? ''),
    type: String(raw.type ?? 'default'),
    weight: typeof raw.weight === 'number' ? raw.weight : 1,
    metadata: migrateMetadata(raw.metadata),
    sourceCardinality: (raw.sourceCardinality as Cardinality) ?? '1',
    targetCardinality: (raw.targetCardinality as Cardinality) ?? '0..*',
    kind: (raw.kind as RelationshipKind) ?? 'regular',
  };
}

export const DEFAULT_THEME: ThemeColors = {
  canvasBg: '#111827',
  canvasGridMajor: '#374151',
  canvasGridMinor: '#1f2937',
  nodeBackground: '#4f46e5',
  nodeForeground: '#ffffff',
  nodeBorder: '#6366f1',
  selectionHighlight: '#3b82f6',
  relationshipLine: '#94a3b8',
  relationshipText: '#9ca3af',
  abstractColor: '#a78bfa',
};

export const DEFAULT_GRID: GridSettings = {
  minorGridPx: 10,
  majorGridPx: 50,
  snapEnabled: true,
};

export const DEFAULT_NODE_SETTINGS: NodeSettings = {
  minWidthPx: 80,
  edgeGapPx: 5,
  jiggleEnabled: true,
  shadowsEnabled: true,
  palette: [
    '#4f46e5', '#2563eb', '#0891b2', '#059669',
    '#d97706', '#dc2626', '#7c3aed', '#db2777',
  ],
  relTextPosition: 35,
};

export interface MarqueeState {
  start: { x: number; y: number };
  current: { x: number; y: number };
}

interface GraphState {
  nodes: GraphNode[];
  relationships: Relationship[];
  selectedNodeIds: string[];
  selectedRelationshipIds: string[];
  dragState: DragState | null;
  nodeDragState: NodeDragState | null;
  instanceDragState: { sourceInstanceId: string; sourcePosition: { x: number; y: number }; currentPoint: { x: number; y: number } } | null;
  marqueeState: MarqueeState | null;
  contextMenu: { worldX: number; worldY: number; screenX: number; screenY: number; target?: { kind: 'node'; id: string } | { kind: 'relationship'; id: string } } | null;
  cameraState: { x: number; y: number; zoom: number } | null;
  theme: ThemeColors;
  defaultTheme: ThemeColors;
  grid: GridSettings;
  defaultGrid: GridSettings;
  nodeSettings: NodeSettings;
  defaultNodeSettings: NodeSettings;
  isDirty: boolean;
  nextNodeNumber: number;

  addNode: (position?: { x: number; y: number }) => void;
  addNodeWithRelationship: (sourceId: string, position: { x: number; y: number }) => void;
  updateNode: (id: string, updates: Partial<GraphNode>) => void;
  deleteNode: (id: string) => void;
  addRelationship: (sourceId: string, targetId: string) => void;
  updateRelationship: (id: string, updates: Partial<Relationship>) => void;
  deleteRelationship: (id: string) => void;
  selectNode: (id: string | null) => void;
  selectRelationship: (id: string | null) => void;
  toggleNodeSelection: (id: string) => void;
  selectMultiple: (nodeIds: string[], relIds: string[]) => void;
  deleteSelected: () => void;
  setDragState: (state: DragState | null) => void;
  setNodeDragState: (state: NodeDragState | null) => void;
  setInstanceDragState: (state: { sourceInstanceId: string; sourcePosition: { x: number; y: number }; currentPoint: { x: number; y: number } } | null) => void;
  setMarqueeState: (state: MarqueeState | null) => void;
  setContextMenu: (menu: { worldX: number; worldY: number; screenX: number; screenY: number; target?: { kind: 'node'; id: string } | { kind: 'relationship'; id: string } } | null) => void;
  setCameraState: (state: { x: number; y: number; zoom: number }) => void;
  updateTheme: (updates: Partial<ThemeColors>) => void;
  setDefaultTheme: () => void;
  updateGrid: (updates: Partial<GridSettings>) => void;
  updateNodeSettings: (updates: Partial<NodeSettings>) => void;
  applyThemeToAll: () => void;
  resetTheme: () => void;
  clearSelection: () => void;
  markClean: () => void;
  newGraph: () => void;
  autoLayout: () => void;
  exportGraph: () => string;
  importGraph: (json: string) => void;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
}

// Undo/redo history (kept outside store to avoid persistence/re-render issues)
interface Snapshot {
  nodes: GraphNode[];
  relationships: Relationship[];
  nextNodeNumber: number;
}

const MAX_HISTORY = 50;
const undoStack: Snapshot[] = [];
const redoStack: Snapshot[] = [];

function takeSnapshot(state: GraphState): Snapshot {
  return {
    nodes: JSON.parse(JSON.stringify(state.nodes)),
    relationships: JSON.parse(JSON.stringify(state.relationships)),
    nextNodeNumber: state.nextNodeNumber,
  };
}

let lastUndoPush = 0;

function pushUndo(state: GraphState) {
  undoStack.push(takeSnapshot(state));
  if (undoStack.length > MAX_HISTORY) undoStack.shift();
  redoStack.length = 0;
  lastUndoPush = Date.now();
}

/** Push undo only if enough time has passed (for high-frequency updates like typing) */
function pushUndoDebounced(state: GraphState, ms = 1000) {
  if (Date.now() - lastUndoPush > ms) {
    pushUndo(state);
  }
}

let idCounter = 0;
const generateId = () => `${Date.now()}-${++idCounter}`;

export const useGraphStore = create<GraphState>()(
  persist(
    (set, get) => ({
      nodes: [],
      relationships: [],
      selectedNodeIds: [],
      selectedRelationshipIds: [],
      dragState: null,
      nodeDragState: null,
      instanceDragState: null,
      marqueeState: null,
      contextMenu: null,
      cameraState: null,
      theme: { ...DEFAULT_THEME },
      defaultTheme: { ...DEFAULT_THEME },
      grid: { ...DEFAULT_GRID },
      defaultGrid: { ...DEFAULT_GRID },
      nodeSettings: { ...DEFAULT_NODE_SETTINGS },
      defaultNodeSettings: { ...DEFAULT_NODE_SETTINGS },
      isDirty: false,
      nextNodeNumber: 1,

      addNode: (position) => {
        pushUndo(get());
        const { grid } = get();
        const num = get().nextNodeNumber;
        const rawPos = position ?? { x: (Math.random() - 0.5) * 4, y: (Math.random() - 0.5) * 4 };
        const node: GraphNode = {
          id: generateId(),
          name: `Node ${num}`,
          type: 'default',
          description: '',
          color: get().theme.nodeBackground,
          position: grid.snapEnabled ? snapToGrid(rawPos, grid.minorGridPx) : rawPos,
          metadata: [],
          abstract: false,
        };
        set((s) => ({
          nodes: [...s.nodes, node],
          nextNodeNumber: s.nextNodeNumber + 1,
          selectedNodeIds: [node.id],
          selectedRelationshipIds: [],
          isDirty: true,
        }));
      },

      addNodeWithRelationship: (sourceId, position) => {
        pushUndo(get());
        const sourceNode = get().nodes.find((n) => n.id === sourceId);
        const fromAbstract = sourceNode?.abstract ?? false;
        const num = get().nextNodeNumber;
        const node: GraphNode = {
          id: generateId(),
          name: `Node ${num}`,
          type: 'default',
          description: '',
          color: get().theme.nodeBackground,
          position,
          metadata: [],
          abstract: false,
        };
        // Dragging from an abstract node → the new node is a concrete subtype.
        // Direction: new node (child) --inherits-from--> abstract node (parent).
        const rel: Relationship = fromAbstract
          ? {
              id: generateId(),
              sourceId: node.id,
              targetId: sourceId,
              name: 'is',
              type: 'default',
              weight: 1,
              metadata: [],
              sourceCardinality: '0..*',
              targetCardinality: '1',
              kind: 'inherits-from',
            }
          : {
              id: generateId(),
              sourceId,
              targetId: node.id,
              name: 'relates to',
              type: 'default',
              weight: 1,
              metadata: [],
              sourceCardinality: '1',
              targetCardinality: '0..*',
              kind: 'regular',
            };
        set((s) => ({
          nodes: [...s.nodes, node],
          relationships: [...s.relationships, rel],
          nextNodeNumber: s.nextNodeNumber + 1,
          selectedNodeIds: [node.id],
          selectedRelationshipIds: [],
          isDirty: true,
        }));
      },

      updateNode: (id, updates) => {
        pushUndoDebounced(get());
        set((s) => ({
          nodes: s.nodes.map((n) => (n.id === id ? { ...n, ...updates } : n)),
          isDirty: true,
        }));
      },

      deleteNode: (id) => {
        pushUndo(get());
        set((s) => ({
          nodes: s.nodes.filter((n) => n.id !== id),
          relationships: s.relationships.filter(
            (r) => r.sourceId !== id && r.targetId !== id
          ),
          selectedNodeIds: s.selectedNodeIds.filter((nid) => nid !== id),
          isDirty: true,
        }));
      },

      addRelationship: (sourceId, targetId) => {
        if (sourceId === targetId) return;
        pushUndo(get());
        const sourceNode = get().nodes.find((n) => n.id === sourceId);
        const fromAbstract = sourceNode?.abstract ?? false;
        // When dragging from an abstract node, reverse direction so the dropped-on
        // node becomes the child and the abstract node becomes the parent.
        const relSourceId = fromAbstract ? targetId : sourceId;
        const relTargetId = fromAbstract ? sourceId : targetId;
        const existing = get().relationships.find(
          (r) => r.sourceId === relSourceId && r.targetId === relTargetId
        );
        if (existing) return;

        const rel: Relationship = fromAbstract
          ? {
              id: generateId(),
              sourceId: relSourceId,
              targetId: relTargetId,
              name: 'is',
              type: 'default',
              weight: 1,
              metadata: [],
              sourceCardinality: '0..*',
              targetCardinality: '1',
              kind: 'inherits-from',
            }
          : {
              id: generateId(),
              sourceId,
              targetId,
              name: 'relates to',
              type: 'default',
              weight: 1,
              metadata: [],
              sourceCardinality: '1',
              targetCardinality: '0..*',
              kind: 'regular',
            };
        set((s) => ({
          relationships: [...s.relationships, rel],
          selectedRelationshipIds: [rel.id],
          selectedNodeIds: [],
          isDirty: true,
        }));
      },

      updateRelationship: (id, updates) => {
        pushUndoDebounced(get());
        set((s) => ({
          relationships: s.relationships.map((r) =>
            r.id === id ? { ...r, ...updates } : r
          ),
          isDirty: true,
        }));
      },

      deleteRelationship: (id) => {
        pushUndo(get());
        set((s) => ({
          relationships: s.relationships.filter((r) => r.id !== id),
          selectedRelationshipIds: s.selectedRelationshipIds.filter((rid) => rid !== id),
          isDirty: true,
        }));
      },

      selectNode: (id) =>
        set({
          selectedNodeIds: id ? [id] : [],
          selectedRelationshipIds: [],
        }),

      selectRelationship: (id) =>
        set({
          selectedRelationshipIds: id ? [id] : [],
          selectedNodeIds: [],
        }),

      toggleNodeSelection: (id) =>
        set((s) => {
          const ids = s.selectedNodeIds.includes(id)
            ? s.selectedNodeIds.filter((nid) => nid !== id)
            : [...s.selectedNodeIds, id];
          return { selectedNodeIds: ids, selectedRelationshipIds: [] };
        }),

      selectMultiple: (nodeIds, relIds) =>
        set({
          selectedNodeIds: nodeIds,
          selectedRelationshipIds: relIds,
        }),

      deleteSelected: () => {
        pushUndo(get());
        set((s) => {
          const nodeIdSet = new Set(s.selectedNodeIds);
          const relIdSet = new Set(s.selectedRelationshipIds);
          const remainingNodes = s.nodes.filter((n) => !nodeIdSet.has(n.id));
          const remainingRels = s.relationships.filter(
            (r) => !relIdSet.has(r.id) && !nodeIdSet.has(r.sourceId) && !nodeIdSet.has(r.targetId)
          );
          return {
            nodes: remainingNodes,
            relationships: remainingRels,
            selectedNodeIds: [],
            selectedRelationshipIds: [],
            isDirty: true,
          };
        });
      },

      setDragState: (dragState) => set({ dragState }),

      setNodeDragState: (nodeDragState) => set({ nodeDragState }),

      setInstanceDragState: (instanceDragState) => set({ instanceDragState }),

      setMarqueeState: (marqueeState) => set({ marqueeState }),

      setContextMenu: (contextMenu) => set({ contextMenu }),

      setCameraState: (cameraState) => set({ cameraState }),

      updateTheme: (updates) =>
        set((s) => {
          const newTheme = { ...s.theme, ...updates };
          const newState: Partial<GraphState> = { theme: newTheme };
          if (updates.nodeBackground) {
            newState.nodes = s.nodes.map((n) => ({
              ...n,
              color: n.color === s.theme.nodeBackground ? updates.nodeBackground! : n.color,
            }));
          }
          newState.isDirty = true;
          return newState;
        }),

      setDefaultTheme: () =>
        set((s) => ({
          defaultTheme: { ...s.theme },
          defaultGrid: { ...s.grid },
          defaultNodeSettings: { ...s.nodeSettings },
        })),

      applyThemeToAll: () =>
        set((s) => ({
          nodes: s.nodes.map((n) => ({ ...n, color: s.theme.nodeBackground })),
          isDirty: true,
        })),

      updateGrid: (updates) =>
        set((s) => ({ grid: { ...s.grid, ...updates }, isDirty: true })),

      updateNodeSettings: (updates) =>
        set((s) => ({ nodeSettings: { ...s.nodeSettings, ...updates }, isDirty: true })),

      resetTheme: () => {
        const { defaultTheme, defaultGrid, defaultNodeSettings } = get();
        set({ theme: { ...defaultTheme }, grid: { ...defaultGrid }, nodeSettings: { ...defaultNodeSettings }, isDirty: true });
      },

      clearSelection: () =>
        set({ selectedNodeIds: [], selectedRelationshipIds: [] }),

      markClean: () => set({ isDirty: false }),

      newGraph: () => {
        undoStack.length = 0;
        redoStack.length = 0;
        set({
          nodes: [],
          relationships: [],
          nextNodeNumber: 1,
          selectedNodeIds: [],
          selectedRelationshipIds: [],
          cameraState: null,
          theme: { ...get().defaultTheme },
          grid: { ...get().defaultGrid },
          nodeSettings: { ...get().defaultNodeSettings },
          isDirty: false,
        });
      },

      autoLayout: () => {
        const s = get();
        pushUndo(s);
        const snapPx = s.grid.snapEnabled ? s.grid.minorGridPx : null;
        const results = forceDirectedLayout(s.nodes, s.relationships, s.nodeSettings.minWidthPx, { snapPx });
        const posMap = new Map(results.map((r) => [r.id, r.position]));
        set({
          nodes: s.nodes.map((n) => ({
            ...n,
            position: posMap.get(n.id) ?? n.position,
          })),
          isDirty: true,
        });
      },

      exportGraph: () => {
        const s = get();
        return JSON.stringify({
          nodes: s.nodes,
          relationships: s.relationships,
          nextNodeNumber: s.nextNodeNumber,
          theme: s.theme,
          grid: s.grid,
          nodeSettings: s.nodeSettings,
          cameraState: s.cameraState,
        }, null, 2);
      },

      undo: () => {
        if (undoStack.length === 0) return;
        const snapshot = undoStack.pop()!;
        redoStack.push(takeSnapshot(get()));
        set({
          nodes: snapshot.nodes,
          relationships: snapshot.relationships,
          nextNodeNumber: snapshot.nextNodeNumber,
          selectedNodeIds: [],
          selectedRelationshipIds: [],
          isDirty: true,
        });
      },

      redo: () => {
        if (redoStack.length === 0) return;
        const snapshot = redoStack.pop()!;
        undoStack.push(takeSnapshot(get()));
        set({
          nodes: snapshot.nodes,
          relationships: snapshot.relationships,
          nextNodeNumber: snapshot.nextNodeNumber,
          selectedNodeIds: [],
          selectedRelationshipIds: [],
          isDirty: true,
        });
      },

      canUndo: () => undoStack.length > 0,
      canRedo: () => redoStack.length > 0,

      importGraph: (json) => {
        const data = JSON.parse(json);
        undoStack.length = 0;
        redoStack.length = 0;
        set({
          nodes: (data.nodes ?? []).map((n: Record<string, unknown>) => migrateNode(n)),
          relationships: (data.relationships ?? []).map((r: Record<string, unknown>) => migrateRelationship(r)),
          nextNodeNumber: data.nextNodeNumber ?? 1,
          theme: { ...DEFAULT_THEME, ...(data.theme ?? {}) },
          grid: { ...DEFAULT_GRID, ...(data.grid ?? {}) },
          nodeSettings: { ...DEFAULT_NODE_SETTINGS, ...(data.nodeSettings ?? {}) },
          cameraState: data.cameraState ?? null,
          selectedNodeIds: [],
          selectedRelationshipIds: [],
          isDirty: false,
        });
      },
    }),
    {
      name: 'graph-creator-storage',
      partialize: (state) => ({
        nodes: state.nodes,
        relationships: state.relationships,
        nextNodeNumber: state.nextNodeNumber,
        theme: state.theme,
        defaultTheme: state.defaultTheme,
        grid: state.grid,
        defaultGrid: state.defaultGrid,
        nodeSettings: state.nodeSettings,
        defaultNodeSettings: state.defaultNodeSettings,
        cameraState: state.cameraState,
      }),
      merge: (persisted, current) => {
        const p = persisted as Partial<GraphState>;
        return {
          ...current,
          ...p,
          nodes: (p.nodes ?? []).map((n) => migrateNode(n as unknown as Record<string, unknown>)),
          relationships: (p.relationships ?? []).map((r) => migrateRelationship(r as unknown as Record<string, unknown>)),
          theme: { ...DEFAULT_THEME, ...(p.theme ?? {}) },
          defaultTheme: { ...DEFAULT_THEME, ...(p.defaultTheme ?? {}) },
          grid: { ...DEFAULT_GRID, ...(p.grid ?? {}) },
          defaultGrid: { ...DEFAULT_GRID, ...(p.defaultGrid ?? {}) },
          nodeSettings: { ...DEFAULT_NODE_SETTINGS, ...(p.nodeSettings ?? {}) },
          defaultNodeSettings: { ...DEFAULT_NODE_SETTINGS, ...(p.defaultNodeSettings ?? {}) },
        };
      },
    }
  )
);

