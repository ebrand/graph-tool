'use client';

import { useRef, useEffect, useState } from 'react';
import { useGraphStore } from '@/store/graphStore';
import { Cardinality, MetadataEntry, MetadataType, RelationshipKind } from '@/types';

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

        {/* Abstract toggle */}
        <div className="flex items-start justify-between gap-3 pt-1 border-t border-gray-700">
          <div>
            <p className="text-xs text-gray-200">Abstract</p>
            <p className="text-[11px] text-gray-500 mt-0.5 leading-snug">
              No direct instances — use a concrete subtype in Data mode
            </p>
          </div>
          <button
            role="switch"
            aria-checked={selectedNode.abstract}
            onClick={() => updateNode(selectedNode.id, { abstract: !selectedNode.abstract })}
            className={`relative shrink-0 w-9 h-5 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-1 focus:ring-offset-gray-800 mt-0.5 ${
              selectedNode.abstract ? 'bg-violet-600' : 'bg-gray-700'
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                selectedNode.abstract ? 'translate-x-4' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        <MetadataEditor
          entries={selectedNode.metadata ?? []}
          onChange={(metadata) => updateNode(selectedNode.id, { metadata })}
        />
      </div>
    );
  }

  if (selectedRel) {
    return <RelationshipEditor rel={{ ...selectedRel, kind: selectedRel.kind ?? 'regular' }} nodes={nodes} updateRelationship={updateRelationship} />;
  }

  return null;
}

const CARDINALITIES: Cardinality[] = ['1', '0..1', '1..*', '0..*'];

function RelationshipEditor({
  rel,
  nodes,
  updateRelationship,
}: {
  rel: { id: string; sourceId: string; targetId: string; name: string; type: string; weight: number; metadata: MetadataEntry[]; sourceCardinality: Cardinality; targetCardinality: Cardinality; kind: RelationshipKind };
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

      {/* Relationship kind */}
      <div>
        <label className="block text-xs text-gray-400 mb-1">Kind</label>
        <div className="flex rounded border border-gray-600 overflow-hidden">
          <button
            onClick={() => updateRelationship(rel.id, { kind: 'regular' })}
            className={`flex-1 px-2 py-1 text-xs transition-colors ${
              rel.kind !== 'inherits-from'
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            Regular
          </button>
          <button
            onClick={() => updateRelationship(rel.id, { kind: 'inherits-from', name: 'is' })}
            className={`flex-1 px-2 py-1 text-xs transition-colors ${
              rel.kind === 'inherits-from'
                ? 'bg-violet-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            Inherits From
          </button>
        </div>
        {rel.kind === 'inherits-from' && (
          <p className="text-[11px] text-gray-500 mt-1 leading-snug">
            Source specializes target. Arrow tip points at the parent (supertype).
          </p>
        )}
      </div>

      <Field
        label="Name"
        value={rel.name}
        onChange={(v) => updateRelationship(rel.id, { name: v })}
        autoFocusSelect={rel.kind !== 'inherits-from'}
        selectionKey={`${rel.id}-${focusKey}`}
        readOnly={rel.kind === 'inherits-from'}
      />
      <Field
        label="Type"
        value={rel.type}
        onChange={(v) => updateRelationship(rel.id, { type: v })}
      />
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-xs text-gray-400 mb-1">Source cardinality</label>
          <select
            value={rel.sourceCardinality}
            onChange={(e) => updateRelationship(rel.id, { sourceCardinality: e.target.value as Cardinality })}
            className="w-full px-2 py-1 text-sm bg-gray-800 border border-gray-600 rounded text-gray-200 focus:border-indigo-500 focus:outline-none"
          >
            {CARDINALITIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Target cardinality</label>
          <select
            value={rel.targetCardinality}
            onChange={(e) => updateRelationship(rel.id, { targetCardinality: e.target.value as Cardinality })}
            className="w-full px-2 py-1 text-sm bg-gray-800 border border-gray-600 rounded text-gray-200 focus:border-indigo-500 focus:outline-none"
          >
            {CARDINALITIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>
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

// Field names ending in 'id' (case-insensitive) are system-managed.
const isSystemIdField = (name: string) => /id$/i.test(name.trim());

function MetadataEditor({
  entries,
  onChange,
}: {
  entries: MetadataEntry[];
  onChange: (entries: MetadataEntry[]) => void;
}) {
  const inputClass =
    'px-1.5 py-0.5 text-xs bg-gray-800 border border-gray-600 rounded text-gray-200 focus:border-indigo-500 focus:outline-none';

  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);

  // Strip system *id fields — they are auto-generated and not user-editable.
  const userEntries = entries.filter((e) => !isSystemIdField(e.name));

  const updateName = (index: number, val: string) => {
    const updated = userEntries.map((e, i) => (i === index ? { ...e, name: val } : e));
    onChange(updated);
  };

  const updateType = (index: number, val: MetadataType) => {
    const updated = userEntries.map((e, i) => (i === index ? { ...e, dataType: val } : e));
    onChange(updated);
  };

  const updateRequired = (index: number, val: boolean) => {
    const updated = userEntries.map((e, i) => (i === index ? { ...e, required: val } : e));
    onChange(updated);
  };

  const addEntry = () => {
    onChange([...userEntries, { name: '', dataType: 'string' as MetadataType, required: false }]);
  };

  const removeEntry = (index: number) => {
    onChange(userEntries.filter((_, i) => i !== index));
  };

  const handleDragStart = (index: number) => {
    setDragIdx(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setOverIdx(index);
  };

  const handleDrop = (index: number) => {
    if (dragIdx === null || dragIdx === index) { setDragIdx(null); setOverIdx(null); return; }
    const reordered = [...userEntries];
    const [moved] = reordered.splice(dragIdx, 1);
    reordered.splice(index, 0, moved);
    onChange(reordered);
    setDragIdx(null);
    setOverIdx(null);
  };

  const handleDragEnd = () => {
    setDragIdx(null);
    setOverIdx(null);
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

      {/* System id field — always present, read-only indicator */}
      <div className="flex gap-1 items-center mb-1 opacity-40" title="Auto-generated by the system">
        <span className="w-4 shrink-0" />
        <input
          type="text"
          value="id"
          readOnly
          className={inputClass + ' flex-1 cursor-default'}
        />
        <span className={inputClass + ' text-gray-500'}>string</span>
        <span className="text-[10px] text-gray-500 shrink-0 px-1">sys</span>
        <span className="w-4 shrink-0" />
      </div>

      {userEntries.length === 0 && (
        <p className="text-xs text-gray-600">No properties</p>
      )}
      <div className="space-y-0.5">
        {userEntries.map((entry, i) => (
          <div
            key={i}
            draggable
            onDragStart={() => handleDragStart(i)}
            onDragOver={(e) => handleDragOver(e, i)}
            onDrop={() => handleDrop(i)}
            onDragEnd={handleDragEnd}
            className={`flex gap-1 items-center group rounded transition-colors ${
              overIdx === i && dragIdx !== null && dragIdx !== i
                ? 'bg-indigo-900/30 border border-indigo-500/30'
                : dragIdx === i
                ? 'opacity-40'
                : ''
            }`}
          >
            <span
              className="shrink-0 w-4 text-center text-gray-600 cursor-grab active:cursor-grabbing text-[10px] select-none"
              title="Drag to reorder"
            >
              ⠿
            </span>
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
              onClick={() => updateRequired(i, !entry.required)}
              title={entry.required ? 'Required — click to make optional' : 'Optional — click to make required'}
              className={`text-sm font-bold shrink-0 w-4 leading-none transition-colors ${
                entry.required ? 'text-red-400' : 'text-gray-600 hover:text-gray-400'
              }`}
            >
              *
            </button>
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
  readOnly,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
  autoFocusSelect?: boolean;
  selectionKey?: string;
  readOnly?: boolean;
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
    'w-full px-2 py-1 text-sm bg-gray-800 border rounded text-gray-200 focus:outline-none ' +
    (readOnly
      ? 'border-gray-700 text-gray-500 cursor-default'
      : 'border-gray-600 focus:border-indigo-500');

  return (
    <div>
      <label className="block text-xs text-gray-400 mb-1">{label}</label>
      {multiline ? (
        <textarea
          ref={inputRef as React.RefObject<HTMLTextAreaElement>}
          value={value}
          onChange={(e) => !readOnly && onChange(e.target.value)}
          readOnly={readOnly}
          rows={3}
          className={inputClass + ' resize-none'}
        />
      ) : (
        <input
          ref={inputRef as React.RefObject<HTMLInputElement>}
          type="text"
          value={value}
          onChange={(e) => !readOnly && onChange(e.target.value)}
          readOnly={readOnly}
          className={inputClass}
        />
      )}
    </div>
  );
}
