'use client';

import { useRef } from 'react';
import { useGraphStore } from '@/store/graphStore';
import { useDataStore } from '@/store/dataStore';
import { GraphNode, NodeInstance, Relationship } from '@/types';
import InstanceDetailDrawer from './InstanceDetailDrawer';

/** All descendant node IDs (via inherits-from chains) for a given parent. */
function getAllDescendantIds(nodeId: string, relationships: Relationship[]): string[] {
  const children = relationships
    .filter((r) => r.kind === 'inherits-from' && r.targetId === nodeId)
    .map((r) => r.sourceId);
  const result: string[] = [...children];
  for (const childId of children) {
    result.push(...getAllDescendantIds(childId, relationships));
  }
  return result;
}

// ── InstanceRow ───────────────────────────────────────────────────────────────

function InstanceRow({
  instance,
  readOnly,
  onSelect,
  onDelete,
}: {
  instance: NodeInstance;
  readOnly: boolean;
  onSelect: () => void;
  onDelete: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className="group w-full flex items-center gap-1 py-0.5 pl-1 rounded hover:bg-gray-700/40 transition-colors text-left"
    >
      <span className="flex-1 text-xs text-gray-300 truncate" title={instance.label}>
        {instance.label}
      </span>
      {!readOnly && (
        <span
          role="button"
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          title="Delete instance"
          className="text-gray-600 hover:text-red-400 text-sm opacity-0 group-hover:opacity-100 transition-opacity shrink-0 leading-none px-0.5 cursor-pointer"
        >
          ×
        </span>
      )}
    </button>
  );
}

// ── NodeSection ───────────────────────────────────────────────────────────────

function NodeSection({ node, instances, readOnly }: { node: GraphNode; instances: NodeInstance[]; readOnly: boolean }) {
  const deleteNodeInstance = useDataStore((s) => s.deleteNodeInstance);
  const openModal = useDataStore((s) => s.setAddingInstanceForNodeId);
  const selectInstance = useDataStore((s) => s.selectInstance);
  const allNodeInstances = useDataStore((s) => s.nodeInstances);
  const relationships = useGraphStore((s) => s.relationships);
  const expanded = useDataStore((s) => s.expandedNodeIds.includes(node.id));
  const toggleExpanded = useDataStore((s) => s.toggleExpandedNode);

  // Polymorphic count: direct + all subtype instances
  const descendantIds = getAllDescendantIds(node.id, relationships);
  const polymorphicCount =
    instances.length +
    (descendantIds.length > 0
      ? allNodeInstances.filter((ni) => descendantIds.includes(ni.schemaNodeId)).length
      : 0);
  const hasSubtypes = descendantIds.length > 0;

  return (
    <div className="border-b border-gray-700/50 last:border-b-0">
      {/* Header row */}
      <button
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-gray-700/40 transition-colors"
        onClick={() => toggleExpanded(node.id)}
      >
        <span
          className="w-2.5 h-2.5 rounded-sm shrink-0 border border-white/10"
          style={{ background: node.color }}
        />
        <span className="text-sm text-gray-200 truncate flex-1">{node.name}</span>
        {node.abstract && (
          <span className="text-[10px] text-violet-400/70 font-mono shrink-0 border border-violet-700/50 rounded px-1 py-px">
            abstract
          </span>
        )}
        {polymorphicCount > 0 && (
          <span
            className="text-xs font-mono shrink-0 tabular-nums"
            title={hasSubtypes && polymorphicCount !== instances.length
              ? `${instances.length} direct + ${polymorphicCount - instances.length} via subtypes`
              : undefined}
          >
            <span className="text-amber-400">{polymorphicCount}</span>
            {hasSubtypes && polymorphicCount !== instances.length && (
              <span className="text-gray-600">*</span>
            )}
          </span>
        )}
        <span className="text-gray-600 text-xs shrink-0">{expanded ? '▾' : '▸'}</span>
      </button>

      {/* Expanded body */}
      {expanded && (
        <div className="px-3 pb-2.5">
          {instances.length === 0 ? (
            <p className="text-xs text-gray-600 py-0.5 mb-1.5">No instances yet</p>
          ) : (
            <div className="mb-2">
              {instances.map((inst) => (
                <InstanceRow
                  key={inst.id}
                  instance={inst}
                  readOnly={readOnly}
                  onSelect={() => selectInstance(inst.id)}
                  onDelete={() => deleteNodeInstance(inst.id)}
                />
              ))}
            </div>
          )}
          {!readOnly && (
            <button
              onClick={() => openModal(node.id)}
              className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              + Add instance
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── DataPanel ─────────────────────────────────────────────────────────────────

export default function DataPanel() {
  const nodes = useGraphStore((s) => s.nodes);
  const nodeInstances = useDataStore((s) => s.nodeInstances);
  const exportData = useDataStore((s) => s.exportData);
  const importData = useDataStore((s) => s.importData);
  const clearData = useDataStore((s) => s.clearData);
  const selectedInstanceId = useDataStore((s) => s.selectedInstanceId);
  const mode = useDataStore((s) => s.mode);
  const readOnly = mode === 'data';

  const fileInputRef = useRef<HTMLInputElement>(null);
  const totalInstances = nodeInstances.length;

  // When an instance is selected, render the detail drawer instead
  if (selectedInstanceId) {
    return <InstanceDetailDrawer />;
  }

  const handleExport = () => {
    const json = exportData();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'graph-data.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        importData(ev.target?.result as string);
      } catch {
        alert('Failed to import data — invalid JSON format.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleClear = () => {
    if (totalInstances === 0) return;
    if (!confirm(`Delete all ${totalInstances} instance${totalInstances === 1 ? '' : 's'}? This cannot be undone.`)) return;
    clearData();
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-3 py-2.5 border-b border-gray-700 flex items-center gap-2 shrink-0">
        <h2 className="text-xs font-semibold text-gray-300 uppercase tracking-wider flex-1">
          {readOnly ? 'Data Explorer' : 'Data Entry'}
        </h2>
        {totalInstances > 0 && (
          <span className="text-xs text-gray-500">{totalInstances} total</span>
        )}
        <button
          onClick={() => useDataStore.getState().expandAllNodes()}
          className="px-1.5 py-0.5 text-[10px] text-gray-500 hover:text-gray-300 transition-colors"
          title="Expand all"
        >
          ▼
        </button>
        <button
          onClick={() => useDataStore.getState().collapseAllNodes()}
          className="px-1.5 py-0.5 text-[10px] text-gray-500 hover:text-gray-300 transition-colors"
          title="Collapse all"
        >
          ▲
        </button>
      </div>

      {/* Node list */}
      <div className="flex-1 overflow-y-auto">
        {nodes.length === 0 ? (
          <p className="p-4 text-xs text-gray-500">No schema nodes defined.</p>
        ) : (
          [...nodes].sort((a, b) => a.name.localeCompare(b.name)).map((node) => (
            <NodeSection
              key={node.id}
              node={node}
              instances={nodeInstances.filter((ni) => ni.schemaNodeId === node.id)}
              readOnly={readOnly}
            />
          ))
        )}
      </div>

      {/* Footer */}
      <div className="px-3 py-2 border-t border-gray-700 flex gap-1.5 shrink-0">
        <button
          onClick={handleExport}
          disabled={totalInstances === 0}
          className="flex-1 px-2 py-1 text-xs bg-gray-700 text-gray-300 rounded hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Export
        </button>
        {!readOnly && (
          <>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex-1 px-2 py-1 text-xs bg-gray-700 text-gray-300 rounded hover:bg-gray-600 transition-colors"
            >
              Import
            </button>
            <button
              onClick={handleClear}
              disabled={totalInstances === 0}
              className="px-2 py-1 text-xs bg-gray-700 text-red-400 rounded hover:bg-red-900/40 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Clear
            </button>
          </>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={handleImport}
      />
    </div>
  );
}
