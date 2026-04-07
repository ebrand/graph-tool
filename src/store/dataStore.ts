import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { NodeInstance, RelationshipInstance, FieldValue, Cardinality, RelationshipKind } from '@/types';
import { forceDirectedLayout } from '@/utils/forceLayout';
import { useGraphStore } from '@/store/graphStore';

let idCounter = 0;
export const generateInstanceId = () => `di-${Date.now()}-${++idCounter}`;

export type AppMode = 'schema' | 'data-entry' | 'data';

interface DataState {
  mode: AppMode;
  nodeInstances: NodeInstance[];
  relationshipInstances: RelationshipInstance[];
  selectedInstanceId: string | null;
  /** Persisted set of schema node IDs whose section is expanded in the data panel */
  expandedNodeIds: string[];
  /** Ephemeral: which schema node type the "Add Instance" modal is open for */
  addingInstanceForNodeId: string | null;
  isDirty: boolean;

  setMode: (mode: AppMode) => void;
  setAddingInstanceForNodeId: (id: string | null) => void;
  toggleExpandedNode: (id: string) => void;
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

  exportData: () => string;
  importData: (json: string) => void;
  clearData: () => void;
}

export const useDataStore = create<DataState>()(
  persist(
    (set, get) => ({
      mode: 'schema',
      nodeInstances: [],
      relationshipInstances: [],
      selectedInstanceId: null,
      expandedNodeIds: [],
      addingInstanceForNodeId: null,
      isDirty: false,

      setMode: (mode) => set({ mode, selectedInstanceId: null, addingInstanceForNodeId: null }),
      setAddingInstanceForNodeId: (id) => set({ addingInstanceForNodeId: id }),
      toggleExpandedNode: (id) =>
        set((s) => ({
          expandedNodeIds: s.expandedNodeIds.includes(id)
            ? s.expandedNodeIds.filter((n) => n !== id)
            : [...s.expandedNodeIds, id],
        })),
      markClean: () => set({ isDirty: false }),

      addNodeInstance: (schemaNodeId, label, fields, id?, position?) => {
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
        const { nodeInstances, relationshipInstances } = get();
        if (nodeInstances.length === 0) return;
        const { nodeSettings, grid } = useGraphStore.getState();
        const syntheticNodes = nodeInstances.map((ni) => ({
          id: ni.id,
          name: ni.label || ni.id,
          position: ni.position,
          type: 'default', description: '', color: '#000', metadata: [], abstract: false,
        }));
        const syntheticRels = relationshipInstances.map((ri) => ({
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
        set((s) => ({
          nodeInstances: s.nodeInstances.map((ni) =>
            ni.id === id ? { ...ni, ...updates } : ni
          ),
          isDirty: true,
        }));
      },

      deleteNodeInstance: (id) => {
        set((s) => ({
          nodeInstances: s.nodeInstances.filter((ni) => ni.id !== id),
          relationshipInstances: s.relationshipInstances.filter(
            (ri) => ri.sourceInstanceId !== id && ri.targetInstanceId !== id
          ),
          selectedInstanceId: s.selectedInstanceId === id ? null : s.selectedInstanceId,
          isDirty: true,
        }));
      },

      addRelationshipInstance: (schemaRelationshipId, sourceInstanceId, targetInstanceId, fields) => {
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
        set((s) => ({
          relationshipInstances: s.relationshipInstances.filter((ri) => ri.id !== id),
          isDirty: true,
        }));
      },

      selectInstance: (id) => set({ selectedInstanceId: id }),

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
        set({
          nodeInstances: (data.nodeInstances ?? []).map((ni: NodeInstance) => ({
            ...ni,
            position: ni.position ?? { x: (Math.random() - 0.5) * 4, y: (Math.random() - 0.5) * 4 },
          })),
          relationshipInstances: data.relationshipInstances ?? [],
          selectedInstanceId: null,
          isDirty: false,
        });
      },

      clearData: () => {
        set({ nodeInstances: [], relationshipInstances: [], selectedInstanceId: null, isDirty: false });
      },
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
