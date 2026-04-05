import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { GraphNode, Relationship, DragState, NodeDragState, ThemeColors, GridSettings, NodeSettings } from '@/types';
import { snapToGrid } from '@/utils/geometry';

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
  marqueeState: MarqueeState | null;
  contextMenu: { worldX: number; worldY: number; screenX: number; screenY: number } | null;
  theme: ThemeColors;
  grid: GridSettings;
  nodeSettings: NodeSettings;
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
  setMarqueeState: (state: MarqueeState | null) => void;
  setContextMenu: (menu: { worldX: number; worldY: number; screenX: number; screenY: number } | null) => void;
  updateTheme: (updates: Partial<ThemeColors>) => void;
  updateGrid: (updates: Partial<GridSettings>) => void;
  updateNodeSettings: (updates: Partial<NodeSettings>) => void;
  applyThemeToAll: () => void;
  resetTheme: () => void;
  clearSelection: () => void;
  markClean: () => void;
  exportGraph: () => string;
  importGraph: (json: string) => void;
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
      marqueeState: null,
      contextMenu: null,
      theme: { ...DEFAULT_THEME },
      grid: { ...DEFAULT_GRID },
      nodeSettings: { ...DEFAULT_NODE_SETTINGS },
      isDirty: false,
      nextNodeNumber: 1,

      addNode: (position) => {
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
        const num = get().nextNodeNumber;
        const node: GraphNode = {
          id: generateId(),
          name: `Node ${num}`,
          type: 'default',
          description: '',
          color: get().theme.nodeBackground,
          position,
        };
        const rel: Relationship = {
          id: generateId(),
          sourceId,
          targetId: node.id,
          name: 'relates to',
          type: 'default',
          weight: 1,
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

      updateNode: (id, updates) =>
        set((s) => ({
          nodes: s.nodes.map((n) => (n.id === id ? { ...n, ...updates } : n)),
          isDirty: true,
        })),

      deleteNode: (id) =>
        set((s) => ({
          nodes: s.nodes.filter((n) => n.id !== id),
          relationships: s.relationships.filter(
            (r) => r.sourceId !== id && r.targetId !== id
          ),
          selectedNodeIds: s.selectedNodeIds.filter((nid) => nid !== id),
          isDirty: true,
        })),

      addRelationship: (sourceId, targetId) => {
        if (sourceId === targetId) return;
        const existing = get().relationships.find(
          (r) => r.sourceId === sourceId && r.targetId === targetId
        );
        if (existing) return;

        const rel: Relationship = {
          id: generateId(),
          sourceId,
          targetId,
          name: 'relates to',
          type: 'default',
          weight: 1,
        };
        set((s) => ({
          relationships: [...s.relationships, rel],
          selectedRelationshipIds: [rel.id],
          selectedNodeIds: [],
          isDirty: true,
        }));
      },

      updateRelationship: (id, updates) =>
        set((s) => ({
          relationships: s.relationships.map((r) =>
            r.id === id ? { ...r, ...updates } : r
          ),
          isDirty: true,
        })),

      deleteRelationship: (id) =>
        set((s) => ({
          relationships: s.relationships.filter((r) => r.id !== id),
          selectedRelationshipIds: s.selectedRelationshipIds.filter((rid) => rid !== id),
          isDirty: true,
        })),

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

      deleteSelected: () =>
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
        }),

      setDragState: (dragState) => set({ dragState }),

      setNodeDragState: (nodeDragState) => set({ nodeDragState }),

      setMarqueeState: (marqueeState) => set({ marqueeState }),

      setContextMenu: (contextMenu) => set({ contextMenu }),

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

      applyThemeToAll: () =>
        set((s) => ({
          nodes: s.nodes.map((n) => ({ ...n, color: s.theme.nodeBackground })),
          isDirty: true,
        })),

      updateGrid: (updates) =>
        set((s) => ({ grid: { ...s.grid, ...updates }, isDirty: true })),

      updateNodeSettings: (updates) =>
        set((s) => ({ nodeSettings: { ...s.nodeSettings, ...updates }, isDirty: true })),

      resetTheme: () => set({ theme: { ...DEFAULT_THEME }, grid: { ...DEFAULT_GRID }, nodeSettings: { ...DEFAULT_NODE_SETTINGS }, isDirty: true }),

      clearSelection: () =>
        set({ selectedNodeIds: [], selectedRelationshipIds: [] }),

      markClean: () => set({ isDirty: false }),

      exportGraph: () => {
        const s = get();
        return JSON.stringify({
          nodes: s.nodes,
          relationships: s.relationships,
          nextNodeNumber: s.nextNodeNumber,
          theme: s.theme,
          grid: s.grid,
          nodeSettings: s.nodeSettings,
        }, null, 2);
      },

      importGraph: (json) => {
        const data = JSON.parse(json);
        set({
          nodes: data.nodes ?? [],
          relationships: data.relationships ?? [],
          nextNodeNumber: data.nextNodeNumber ?? 1,
          theme: { ...DEFAULT_THEME, ...(data.theme ?? {}) },
          grid: { ...DEFAULT_GRID, ...(data.grid ?? {}) },
          nodeSettings: { ...DEFAULT_NODE_SETTINGS, ...(data.nodeSettings ?? {}) },
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
        grid: state.grid,
        nodeSettings: state.nodeSettings,
      }),
      merge: (persisted, current) => {
        const p = persisted as Partial<GraphState>;
        return {
          ...current,
          ...p,
          theme: { ...DEFAULT_THEME, ...(p.theme ?? {}) },
          grid: { ...DEFAULT_GRID, ...(p.grid ?? {}) },
          nodeSettings: { ...DEFAULT_NODE_SETTINGS, ...(p.nodeSettings ?? {}) },
        };
      },
    }
  )
);

