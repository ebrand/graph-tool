'use client';

import { useRef, useEffect, useState } from 'react';
import { useGraphStore } from '@/store/graphStore';
import { MetadataEntry, MetadataType } from '@/types';

export default function PropertiesPanel() {
  const nodes = useGraphStore((s) => s.nodes);
  const relationships = useGraphStore((s) => s.relationships);
  const selectedNodeIds = useGraphStore((s) => s.selectedNodeIds);
  const selectedRelationshipIds = useGraphStore((s) => s.selectedRelationshipIds);
  const updateNode = useGraphStore((s) => s.updateNode);
  const updateRelationship = useGraphStore((s) => s.updateRelationship);
  const palette = useGraphStore((s) => s.nodeSettings.palette);

  const totalSelected = selectedNodeIds.length + selectedRelationshipIds.length;

  // Multi-select: show count + color swatches for nodes
  if (selectedNodeIds.length > 1) {
    return (
      <div className="p-4 space-y-3">
        <div className="text-sm text-gray-400">
          <span className="font-semibold text-gray-200">{selectedNodeIds.length}</span> nodes selected
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Color</label>
          <div className="flex gap-1.5 flex-wrap">
            {palette.map((c) => (
              <button
                key={c}
                onClick={() => {
                  for (const nid of selectedNodeIds) {
                    updateNode(nid, { color: c });
                  }
                }}
                className="w-7 h-7 rounded border-2 transition-colors"
                style={{
                  backgroundColor: c,
                  borderColor: 'transparent',
                }}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (totalSelected > 1) {
    return (
      <div className="p-4 text-sm text-gray-400">
        <span className="font-semibold text-gray-200">{totalSelected}</span> items selected
      </div>
    );
  }

  const selectedNode = selectedNodeIds.length === 1
    ? nodes.find((n) => n.id === selectedNodeIds[0])
    : null;
  const selectedRel = selectedRelationshipIds.length === 1
    ? relationships.find((r) => r.id === selectedRelationshipIds[0])
    : null;

  if (!selectedNode && !selectedRel) {
    return (
      <div className="p-4 text-sm text-gray-500">
        Select a node or relationship to view its properties.
      </div>
    );
  }

  if (selectedNode) {
    return (
      <div className="p-4 space-y-3">
        <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">
          Node Properties
        </h2>
        <Field
          label="Name"
          value={selectedNode.name}
          onChange={(v) => updateNode(selectedNode.id, { name: v })}
          autoFocusSelect
          selectionKey={selectedNode.id}
        />
        <Field
          label="Type"
          value={selectedNode.type}
          onChange={(v) => updateNode(selectedNode.id, { type: v })}
        />
        <Field
          label="Description"
          value={selectedNode.description}
          onChange={(v) => updateNode(selectedNode.id, { description: v })}
          multiline
        />
        <div>
          <label className="block text-xs text-gray-400 mb-1">Color</label>
          <div className="flex gap-1.5 flex-wrap">
            {palette.map((c) => (
              <button
                key={c}
                onClick={() => updateNode(selectedNode.id, { color: c })}
                className="w-7 h-7 rounded border-2 transition-colors"
                style={{
                  backgroundColor: c,
                  borderColor: selectedNode.color === c ? '#ffffff' : 'transparent',
                }}
              />
            ))}
          </div>
        </div>
        <MetadataEditor
          entries={selectedNode.metadata ?? []}
          onChange={(metadata) => updateNode(selectedNode.id, { metadata })}
        />
      </div>
    );
  }

  if (selectedRel) {
    return <RelationshipEditor rel={selectedRel} nodes={nodes} updateRelationship={updateRelationship} />;
  }

  return null;
}

function RelationshipEditor({
  rel,
  nodes,
  updateRelationship,
}: {
  rel: { id: string; sourceId: string; targetId: string; name: string; type: string; weight: number; metadata: MetadataEntry[] };
  nodes: { id: string; name: string }[];
  updateRelationship: (id: string, updates: Record<string, unknown>) => void;
}) {
  const [focusKey, setFocusKey] = useState(0);
  const source = nodes.find((n) => n.id === rel.sourceId);
  const target = nodes.find((n) => n.id === rel.targetId);

  return (
    <div className="p-4 space-y-3">
      <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">
        Relationship Properties
      </h2>
      <div className="flex items-center gap-2 text-xs text-gray-500">
        <span>{source?.name ?? '?'} → {target?.name ?? '?'}</span>
        <button
          onClick={() => {
            updateRelationship(rel.id, {
              sourceId: rel.targetId,
              targetId: rel.sourceId,
            });
            setFocusKey((k) => k + 1);
          }}
          className="px-1.5 py-0.5 text-xs bg-gray-700 text-gray-300 rounded hover:bg-gray-600 transition-colors"
          title="Reverse direction"
        >
          ⇄
        </button>
      </div>
      <Field
        label="Name"
        value={rel.name}
        onChange={(v) => updateRelationship(rel.id, { name: v })}
        autoFocusSelect
        selectionKey={`${rel.id}-${focusKey}`}
      />
      <Field
        label="Type"
        value={rel.type}
        onChange={(v) => updateRelationship(rel.id, { type: v })}
      />
      <div>
        <label className="block text-xs text-gray-400 mb-1">Weight</label>
        <input
          type="number"
          value={rel.weight}
          onChange={(e) =>
            updateRelationship(rel.id, {
              weight: parseFloat(e.target.value) || 0,
            })
          }
          className="w-full px-2 py-1 text-sm bg-gray-800 border border-gray-600 rounded text-gray-200 focus:border-indigo-500 focus:outline-none"
        />
      </div>
      <MetadataEditor
        entries={rel.metadata ?? []}
        onChange={(metadata) => updateRelationship(rel.id, { metadata })}
      />
    </div>
  );
}

const DATA_TYPES = ['string', 'number', 'boolean', 'date'] as const;

function MetadataEditor({
  entries,
  onChange,
}: {
  entries: MetadataEntry[];
  onChange: (entries: MetadataEntry[]) => void;
}) {
  const inputClass =
    'px-1.5 py-0.5 text-xs bg-gray-800 border border-gray-600 rounded text-gray-200 focus:border-indigo-500 focus:outline-none';

  const updateName = (index: number, val: string) => {
    const updated = entries.map((e, i) => (i === index ? { ...e, name: val } : e));
    onChange(updated);
  };

  const updateType = (index: number, val: MetadataType) => {
    const updated = entries.map((e, i) => (i === index ? { ...e, dataType: val } : e));
    onChange(updated);
  };

  const addEntry = () => {
    onChange([...entries, { name: '', dataType: 'string' as MetadataType }]);
  };

  const removeEntry = (index: number) => {
    onChange(entries.filter((_, i) => i !== index));
  };

  return (
    <div className="border-t border-gray-700 pt-3">
      <div className="flex items-center justify-between mb-2">
        <label className="text-xs text-gray-400">Properties</label>
        <button
          onClick={addEntry}
          className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
        >
          + Add
        </button>
      </div>
      {entries.length === 0 && (
        <p className="text-xs text-gray-600">No properties</p>
      )}
      <div className="space-y-1">
        {entries.map((entry, i) => (
          <div key={i} className="flex gap-1 items-center group">
            <input
              type="text"
              value={entry.name}
              onChange={(e) => updateName(i, e.target.value)}
              placeholder="name"
              className={inputClass + ' flex-1'}
            />
            <select
              value={entry.dataType}
              onChange={(e) => updateType(i, e.target.value as MetadataType)}
              className={inputClass}
            >
              {DATA_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <button
              onClick={() => removeEntry(i)}
              className="text-gray-600 hover:text-red-400 text-xs opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
            >
              &times;
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  multiline,
  autoFocusSelect,
  selectionKey,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
  autoFocusSelect?: boolean;
  selectionKey?: string;
}) {
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  useEffect(() => {
    if (autoFocusSelect && inputRef.current) {
      const el = inputRef.current;
      requestAnimationFrame(() => {
        el.focus();
        el.select();
      });
    }
  }, [selectionKey, autoFocusSelect]);

  const inputClass =
    'w-full px-2 py-1 text-sm bg-gray-800 border border-gray-600 rounded text-gray-200 focus:border-indigo-500 focus:outline-none';

  return (
    <div>
      <label className="block text-xs text-gray-400 mb-1">{label}</label>
      {multiline ? (
        <textarea
          ref={inputRef as React.RefObject<HTMLTextAreaElement>}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          className={inputClass + ' resize-none'}
        />
      ) : (
        <input
          ref={inputRef as React.RefObject<HTMLInputElement>}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={inputClass}
        />
      )}
    </div>
  );
}
