import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { NodeInstance, RelationshipInstance, FieldValue, Cardinality, RelationshipKind } from '@/types';
import { forceDirectedLayout } from '@/utils/forceLayout';
import { useGraphStore, _setDataStoreRef } from '@/store/graphStore';

let idCounter = 0;
export const generateInstanceId = () => `di-${Date.now()}-${++idCounter}`;

export type AppMode = 'schema' | 'data-entry' | 'data';

// Undo/redo history (kept outside store to avoid persistence/re-render issues)
interface DataSnapshot {
  nodeInstances: NodeInstance[];
  relationshipInstances: RelationshipInstance[];
}

const MAX_HISTORY = 50;
const dataUndoStack: DataSnapshot[] = [];
const dataRedoStack: DataSnapshot[] = [];
let lastDataUndoPush = 0;

function takeDataSnapshot(state: DataState): DataSnapshot {
  return {
    nodeInstances: JSON.parse(JSON.stringify(state.nodeInstances)),
    relationshipInstances: JSON.parse(JSON.stringify(state.relationshipInstances)),
  };
}

function pushDataUndo(state: DataState) {
  dataUndoStack.push(takeDataSnapshot(state));
  if (dataUndoStack.length > MAX_HISTORY) dataUndoStack.shift();
  dataRedoStack.length = 0;
  lastDataUndoPush = Date.now();
}

function pushDataUndoDebounced(state: DataState, ms = 1000) {
  if (Date.now() - lastDataUndoPush > ms) {
    pushDataUndo(state);
  }
}

interface DataState {
  mode: AppMode;
  nodeInstances: NodeInstance[];
  relationshipInstances: RelationshipInstance[];
  selectedInstanceId: string | null;
  selectedInstanceIds: string[];
  /** Persisted set of schema node IDs whose section is expanded in the data panel */
  expandedNodeIds: string[];
  /** Ephemeral: which schema node type the "Add Instance" modal is open for */
  addingInstanceForNodeId: string | null;
  isDirty: boolean;
  jsonPanelOpen: boolean;

  setMode: (mode: AppMode) => void;
  setJsonPanelOpen: (open: boolean) => void;
  setAddingInstanceForNodeId: (id: string | null) => void;
  toggleExpandedNode: (id: string) => void;
  expandAllNodes: () => void;
  collapseAllNodes: () => void;
  markClean: () => void;

  addNodeInstance: (schemaNodeId: string, label: string, fields: FieldValue[], id?: string, position?: { x: number; y: number }) => string;
  updateNodeInstance: (id: string, updates: Partial<Pick<NodeInstance, 'label' | 'fields' | 'position'>>) => void;
  autoLayoutData: () => void;
  deleteNodeInstance: (id: string) => void;

  addRelationshipInstance: (
    schemaRelationshipId: string,
    sourceInstanceId: string,
    targetInstanceId: string,
    fields: FieldValue[]
  ) => string;
  deleteRelationshipInstance: (id: string) => void;

  selectInstance: (id: string | null) => void;
  selectMultipleInstances: (ids: string[]) => void;
  toggleInstanceSelection: (id: string) => void;

  exportData: () => string;
  importData: (json: string) => void;
  clearData: () => void;

  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
}

export const useDataStore = create<DataState>()(
  persist(
    (set, get) => ({
      mode: 'schema',
      nodeInstances: [],
      relationshipInstances: [],
      selectedInstanceId: null,
      selectedInstanceIds: [],
      expandedNodeIds: [],
      addingInstanceForNodeId: null,
      isDirty: false,
      jsonPanelOpen: false,

      setMode: (mode) => set({ mode, selectedInstanceId: null, selectedInstanceIds: [], addingInstanceForNodeId: null }),
      setJsonPanelOpen: (open) => set({ jsonPanelOpen: open }),
      setAddingInstanceForNodeId: (id) => set({ addingInstanceForNodeId: id }),
      toggleExpandedNode: (id) =>
        set((s) => ({
          expandedNodeIds: s.expandedNodeIds.includes(id)
            ? s.expandedNodeIds.filter((n) => n !== id)
            : [...s.expandedNodeIds, id],
        })),
      expandAllNodes: () => {
        const allIds = useGraphStore.getState().nodes.map((n) => n.id);
        set({ expandedNodeIds: allIds });
      },
      collapseAllNodes: () => set({ expandedNodeIds: [] }),
      markClean: () => set({ isDirty: false }),

      addNodeInstance: (schemaNodeId, label, fields, id?, position?) => {
        pushDataUndo(get());
        id = id ?? generateInstanceId();
        const instance: NodeInstance = {
          id,
          schemaNodeId,
          label,
          fields: [{ fieldName: 'id', value: id }, ...fields],
          createdAt: new Date().toISOString(),
          position: position ?? { x: (Math.random() - 0.5) * 4, y: (Math.random() - 0.5) * 4 },
        };
        set((s) => ({ nodeInstances: [...s.nodeInstances, instance], isDirty: true }));
        return id;
      },

      autoLayoutData: () => {
        const s = get();
        if (s.nodeInstances.length === 0) return;
        pushDataUndo(s);
        const { nodeSettings, grid } = useGraphStore.getState();
        const syntheticNodes = s.nodeInstances.map((ni) => ({
          id: ni.id,
          name: ni.label || ni.id,
          position: ni.position,
          type: 'default', description: '', color: '#000', metadata: [], abstract: false,
        }));
        const syntheticRels = s.relationshipInstances.map((ri) => ({
          id: ri.id,
          sourceId: ri.sourceInstanceId,
          targetId: ri.targetInstanceId,
          name: '', type: 'default', weight: 1, metadata: [],
          sourceCardinality: '1' as Cardinality,
          targetCardinality: '0..*' as Cardinality,
          kind: 'regular' as RelationshipKind,
        }));
        const snapPx = grid.snapEnabled ? grid.minorGridPx : null;
        const results = forceDirectedLayout(syntheticNodes, syntheticRels, nodeSettings.minWidthPx, { snapPx });
        set((s) => ({
          nodeInstances: s.nodeInstances.map((ni) => {
            const r = results.find((r) => r.id === ni.id);
            return r ? { ...ni, position: r.position } : ni;
          }),
          isDirty: true,
        }));
      },

      updateNodeInstance: (id, updates) => {
        pushDataUndoDebounced(get());
        set((s) => ({
          nodeInstances: s.nodeInstances.map((ni) =>
            ni.id === id ? { ...ni, ...updates } : ni
          ),
          isDirty: true,
        }));
      },

      deleteNodeInstance: (id) => {
        pushDataUndo(get());
        set((s) => ({
          nodeInstances: s.nodeInstances.filter((ni) => ni.id !== id),
          relationshipInstances: s.relationshipInstances.filter(
            (ri) => ri.sourceInstanceId !== id && ri.targetInstanceId !== id
          ),
          selectedInstanceId: s.selectedInstanceId === id ? null : s.selectedInstanceId,
          selectedInstanceIds: s.selectedInstanceIds.filter((i) => i !== id),
          isDirty: true,
        }));
      },

      addRelationshipInstance: (schemaRelationshipId, sourceInstanceId, targetInstanceId, fields) => {
        pushDataUndo(get());
        const id = generateInstanceId();
        const instance: RelationshipInstance = {
          id,
          schemaRelationshipId,
          sourceInstanceId,
          targetInstanceId,
          fields,
          createdAt: new Date().toISOString(),
        };
        set((s) => ({ relationshipInstances: [...s.relationshipInstances, instance], isDirty: true }));
        return id;
      },

      deleteRelationshipInstance: (id) => {
        pushDataUndo(get());
        set((s) => ({
          relationshipInstances: s.relationshipInstances.filter((ri) => ri.id !== id),
          isDirty: true,
        }));
      },

      selectInstance: (id) => set({ selectedInstanceId: id, selectedInstanceIds: id ? [id] : [] }),

      selectMultipleInstances: (ids) => set({
        selectedInstanceIds: ids,
        selectedInstanceId: ids.length === 1 ? ids[0] : null,
      }),

      toggleInstanceSelection: (id) =>
        set((s) => {
          const ids = s.selectedInstanceIds.includes(id)
            ? s.selectedInstanceIds.filter((i) => i !== id)
            : [...s.selectedInstanceIds, id];
          return { selectedInstanceIds: ids, selectedInstanceId: ids.length === 1 ? ids[0] : null };
        }),

      exportData: () => {
        const { nodeInstances, relationshipInstances } = get();
        return JSON.stringify(
          { version: 1, nodeInstances, relationshipInstances },
          null,
          2
        );
      },

      importData: (json) => {
        const data = JSON.parse(json);
        dataUndoStack.length = 0;
        dataRedoStack.length = 0;
        set({
          nodeInstances: (data.nodeInstances ?? []).map((ni: NodeInstance) => ({
            ...ni,
            position: ni.position ?? { x: (Math.random() - 0.5) * 4, y: (Math.random() - 0.5) * 4 },
          })),
          relationshipInstances: data.relationshipInstances ?? [],
          selectedInstanceId: null,
          selectedInstanceIds: [],
          isDirty: false,
        });
      },

      clearData: () => {
        dataUndoStack.length = 0;
        dataRedoStack.length = 0;
        set({ nodeInstances: [], relationshipInstances: [], selectedInstanceId: null, selectedInstanceIds: [], isDirty: false });
      },

      undo: () => {
        if (dataUndoStack.length === 0) return;
        const snapshot = dataUndoStack.pop()!;
        dataRedoStack.push(takeDataSnapshot(get()));
        set({
          nodeInstances: snapshot.nodeInstances,
          relationshipInstances: snapshot.relationshipInstances,
          selectedInstanceId: null,
          selectedInstanceIds: [],
          isDirty: true,
        });
      },

      redo: () => {
        if (dataRedoStack.length === 0) return;
        const snapshot = dataRedoStack.pop()!;
        dataUndoStack.push(takeDataSnapshot(get()));
        set({
          nodeInstances: snapshot.nodeInstances,
          relationshipInstances: snapshot.relationshipInstances,
          selectedInstanceId: null,
          selectedInstanceIds: [],
          isDirty: true,
        });
      },

      canUndo: () => dataUndoStack.length > 0,
      canRedo: () => dataRedoStack.length > 0,
    }),
    {
      name: 'graph-data-storage',
      partialize: (state) => ({
        nodeInstances: state.nodeInstances,
        relationshipInstances: state.relationshipInstances,
        expandedNodeIds: state.expandedNodeIds,
      }),
      merge: (persisted, current) => {
        const p = persisted as Partial<DataState>;
        return {
          ...current,
          ...p,
          nodeInstances: (p.nodeInstances ?? []).map((ni) => ({
            ...ni,
            position: ni.position ?? { x: (Math.random() - 0.5) * 4, y: (Math.random() - 0.5) * 4 },
          })),
          relationshipInstances: p.relationshipInstances ?? [],
          expandedNodeIds: p.expandedNodeIds ?? [],
        };
      },
    }
  )
);

// Register with graphStore so it can cascade deletes without circular imports
_setDataStoreRef(() => useDataStore.getState());
