'use client';

import { useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useGraphStore } from '@/store/graphStore';
import { useDataStore } from '@/store/dataStore';
import { FieldValue, MetadataEntry, Relationship } from '@/types';
import { FieldInput, defaultValueForType } from './FieldInput';

// ── Descendant node IDs helper (for abstract target nodes) ───────────────────

function getDescendantIds(nodeId: string, relationships: Relationship[]): string[] {
  const result: string[] = [];
  const queue = [nodeId];
  const visited = new Set<string>();
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const r of relationships) {
      if (r.kind === 'inherits-from' && r.targetId === current && !visited.has(r.sourceId)) {
        visited.add(r.sourceId);
        result.push(r.sourceId);
        queue.push(r.sourceId);
      }
    }
  }
  return result;
}

// ── Ancestor metadata helper ──────────────────────────────────────────────────

function getInheritedMeta(
  nodeId: string,
  nodes: { id: string; metadata: MetadataEntry[] }[],
  relationships: Relationship[],
): MetadataEntry[] {
  const meta: MetadataEntry[] = [];
  const visited = new Set<string>();
  let currentId = nodeId;
  while (true) {
    const parentRel = relationships.find(
      (r) => r.kind === 'inherits-from' && r.sourceId === currentId,
    );
    if (!parentRel || visited.has(parentRel.targetId)) break;
    const parent = nodes.find((n) => n.id === parentRel.targetId);
    if (!parent) break;
    meta.push(...parent.metadata);
    visited.add(parent.id);
    currentId = parent.id;
  }
  return meta;
}

// ── Inline link form ──────────────────────────────────────────────────────────

function LinkForm({
  rel,
  sourceInstanceId,
  onDone,
}: {
  rel: Relationship;
  sourceInstanceId: string;
  onDone: () => void;
}) {
  const nodes = useGraphStore((s) => s.nodes);
  const relationships = useGraphStore((s) => s.relationships);
  const nodeInstances = useDataStore((s) => s.nodeInstances);
  const addRelationshipInstance = useDataStore((s) => s.addRelationshipInstance);

  const targetNode = nodes.find((n) => n.id === rel.targetId);
  const descendantIds = getDescendantIds(rel.targetId, relationships);
  const eligibleNodeIds = new Set([rel.targetId, ...descendantIds]);
  const availableTargets = nodeInstances.filter((ni) => eligibleNodeIds.has(ni.schemaNodeId));

  const [targetInstanceId, setTargetInstanceId] = useState('');
  const [relFields, setRelFields] = useState<FieldValue[]>(
    rel.metadata.map((m) => ({ fieldName: m.name, value: defaultValueForType(m.dataType) }))
  );
  const [attempted, setAttempted] = useState(false);

  const setRelField = (index: number, value: string | number | boolean | null) => {
    setRelFields((prev) => prev.map((f, i) => (i === index ? { ...f, value } : f)));
  };

  const requiredRelFilled = rel.metadata
    .filter((m) => m.required)
    .every((m) => {
      const f = relFields.find((f) => f.fieldName === m.name);
      return f && f.value !== null && f.value !== '' && f.value !== undefined;
    });

  const canSubmit = targetInstanceId !== '' && requiredRelFilled;

  const handleLink = () => {
    if (!canSubmit) {
      setAttempted(true);
      return;
    }
    addRelationshipInstance(rel.id, sourceInstanceId, targetInstanceId, relFields);
    onDone();
  };

  if (availableTargets.length === 0) {
    return (
      <div className="mt-1 p-2 bg-gray-800/60 rounded border border-gray-700 text-xs text-gray-500">
        No {targetNode?.name ?? 'target'} instances exist yet.{' '}
        <span className="text-gray-600">Add some first.</span>
      </div>
    );
  }

  return (
    <div className="mt-1.5 p-2.5 bg-gray-800/60 rounded-md space-y-2.5 border border-gray-700">
      <div>
        <label className="flex items-center gap-1 text-xs text-gray-400 mb-1">
          <span
            className="w-2 h-2 rounded-sm border border-white/10"
            style={{ background: targetNode?.color ?? '#6b7280' }}
          />
          {targetNode?.name ?? 'Target'}
          <span className="font-bold text-red-500/70 ml-0.5">*</span>
        </label>
        <select
          value={targetInstanceId}
          onChange={(e) => setTargetInstanceId(e.target.value)}
          className={`w-full px-2 py-1.5 text-sm bg-gray-800 border rounded text-gray-200 focus:outline-none transition-colors ${
            attempted && !targetInstanceId
              ? 'border-red-500 focus:border-red-400'
              : 'border-gray-600 focus:border-indigo-500'
          }`}
        >
          <option value="">Select {targetNode?.name}…</option>
          {availableTargets.map((ti) => {
            const concreteNode = nodes.find((n) => n.id === ti.schemaNodeId);
            const typeSuffix = targetNode?.abstract && concreteNode && concreteNode.id !== rel.targetId
              ? ` (${concreteNode.name})`
              : '';
            return (
              <option key={ti.id} value={ti.id}>{ti.label}{typeSuffix}</option>
            );
          })}
        </select>
        {attempted && !targetInstanceId && (
          <p className="mt-0.5 text-xs text-red-400">Please select a target</p>
        )}
      </div>

      {rel.metadata.map((meta, i) => (
        <FieldInput
          key={meta.name || i}
          meta={meta}
          value={relFields[i]?.value ?? null}
          showError={attempted}
          onChange={(v) => setRelField(i, v)}
        />
      ))}

      <div className="flex gap-1.5 pt-0.5">
        <button
          onClick={handleLink}
          className="flex-1 px-2 py-1 text-xs bg-indigo-600 text-white rounded hover:bg-indigo-500 transition-colors"
        >
          Link
        </button>
        <button
          onClick={onDone}
          className="px-2 py-1 text-xs bg-gray-700 text-gray-300 rounded hover:bg-gray-600 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── Outgoing relationship section ─────────────────────────────────────────────

function OutgoingRelSection({
  rel,
  sourceInstanceId,
  readOnly,
}: {
  rel: Relationship;
  sourceInstanceId: string;
  readOnly: boolean;
}) {
  const nodes = useGraphStore((s) => s.nodes);
  const nodeInstances = useDataStore((s) => s.nodeInstances);
  const relInstances = useDataStore(
    useShallow((s) =>
      s.relationshipInstances.filter(
        (ri) => ri.schemaRelationshipId === rel.id && ri.sourceInstanceId === sourceInstanceId
      )
    )
  );
  const deleteRelationshipInstance = useDataStore((s) => s.deleteRelationshipInstance);
  const [linking, setLinking] = useState(false);

  const targetNode = nodes.find((n) => n.id === rel.targetId);

  return (
    <div className="py-2 border-b border-gray-700/40 last:border-b-0">
      <div className="flex items-center gap-1.5">
        <span className="text-gray-600 text-[10px] shrink-0">→</span>
        <span className="text-xs font-medium text-gray-300 flex-1 truncate">{rel.name}</span>
        {relInstances.length > 0 && (
          <span className="text-[11px] text-amber-400 font-mono shrink-0">{relInstances.length}</span>
        )}
        {rel.targetCardinality && (
          <span className="text-[10px] text-gray-600 font-mono shrink-0 ml-0.5">
            {rel.targetCardinality}
          </span>
        )}
        {!readOnly && (
          <button
            onClick={() => setLinking((l) => !l)}
            className="text-[11px] text-indigo-400 hover:text-indigo-300 transition-colors shrink-0 ml-1"
          >
            {linking ? 'Cancel' : '+ Link'}
          </button>
        )}
      </div>

      {targetNode && (
        <div className="flex items-center gap-1 mt-0.5 mb-1">
          <span className="text-gray-700 text-[10px] ml-3">to</span>
          <span
            className="w-2 h-2 rounded-sm border border-white/10 shrink-0"
            style={{ background: targetNode.color }}
          />
          <span className="text-[11px] text-gray-600">{targetNode.name}</span>
        </div>
      )}

      {relInstances.map((ri) => {
        const target = nodeInstances.find((ni) => ni.id === ri.targetInstanceId);
        return (
          <div key={ri.id} className="group flex items-center gap-1.5 pl-3 py-0.5">
            <span
              className="w-2 h-2 rounded-sm shrink-0 border border-white/10"
              style={{ background: targetNode?.color ?? '#6b7280' }}
            />
            <span className="flex-1 text-xs text-gray-400 truncate">
              {target?.label ?? <span className="italic text-gray-600">Unknown instance</span>}
            </span>
            {!readOnly && (
              <button
                onClick={() => deleteRelationshipInstance(ri.id)}
                title="Remove link"
                className="text-gray-600 hover:text-red-400 text-sm opacity-0 group-hover:opacity-100 transition-opacity shrink-0 leading-none px-0.5"
              >
                ×
              </button>
            )}
          </div>
        );
      })}

      {relInstances.length === 0 && !linking && (
        <p className="pl-3 text-[11px] text-gray-600 mt-0.5">No links yet</p>
      )}

      {linking && (
        <div className="pl-2 mt-1">
          <LinkForm rel={rel} sourceInstanceId={sourceInstanceId} onDone={() => setLinking(false)} />
        </div>
      )}
    </div>
  );
}

// ── Incoming relationship section (read-only) ─────────────────────────────────

function IncomingRelSection({
  rel,
  targetInstanceId,
}: {
  rel: Relationship;
  targetInstanceId: string;
}) {
  const nodes = useGraphStore((s) => s.nodes);
  const nodeInstances = useDataStore((s) => s.nodeInstances);
  const relInstances = useDataStore(
    useShallow((s) =>
      s.relationshipInstances.filter(
        (ri) => ri.schemaRelationshipId === rel.id && ri.targetInstanceId === targetInstanceId
      )
    )
  );

  if (relInstances.length === 0) return null;

  const sourceNode = nodes.find((n) => n.id === rel.sourceId);

  return (
    <div className="py-2 border-b border-gray-700/40 last:border-b-0">
      <div className="flex items-center gap-1.5 mb-1">
        <span className="text-gray-700 text-[10px] shrink-0">←</span>
        <span className="text-xs font-medium text-gray-500 flex-1 truncate">{rel.name}</span>
        <span className="text-[11px] text-gray-600 font-mono shrink-0">{relInstances.length}</span>
      </div>
      {relInstances.map((ri) => {
        const source = nodeInstances.find((ni) => ni.id === ri.sourceInstanceId);
        return (
          <div key={ri.id} className="flex items-center gap-1.5 pl-3 py-0.5">
            <span
              className="w-2 h-2 rounded-sm shrink-0 border border-white/10"
              style={{ background: sourceNode?.color ?? '#6b7280' }}
            />
            <span className="flex-1 text-xs text-gray-500 truncate">
              {source?.label ?? <span className="italic">Unknown instance</span>}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── InstanceDetailDrawer ──────────────────────────────────────────────────────

export default function InstanceDetailDrawer() {
  const selectedInstanceId = useDataStore((s) => s.selectedInstanceId);
  const selectInstance = useDataStore((s) => s.selectInstance);
  const deleteNodeInstance = useDataStore((s) => s.deleteNodeInstance);
  const updateNodeInstance = useDataStore((s) => s.updateNodeInstance);
  const nodeInstances = useDataStore((s) => s.nodeInstances);
  const relationships = useGraphStore((s) => s.relationships);
  const nodes = useGraphStore((s) => s.nodes);
  const readOnly = useDataStore((s) => s.mode === 'data');

  const instance = nodeInstances.find((ni) => ni.id === selectedInstanceId);

  // Graceful fallback — don't silently return null (shows blank pane)
  if (!instance) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center gap-2 px-3 py-2.5 border-b border-gray-700 shrink-0">
          <button
            onClick={() => selectInstance(null)}
            className="text-gray-500 hover:text-gray-300 transition-colors text-sm leading-none px-0.5"
          >
            ←
          </button>
          <span className="text-sm text-gray-500 italic">Instance not found</span>
        </div>
      </div>
    );
  }

  const schemaNode = nodes.find((n) => n.id === instance.schemaNodeId);

  if (!schemaNode) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center gap-2 px-3 py-2.5 border-b border-gray-700 shrink-0">
          <button
            onClick={() => selectInstance(null)}
            className="text-gray-500 hover:text-gray-300 transition-colors text-sm leading-none px-0.5"
          >
            ←
          </button>
          <span className="flex-1 text-sm font-semibold text-white truncate">{instance.label}</span>
        </div>
        <div className="p-4 text-xs text-gray-500">
          Schema node not found. The schema may have changed since this instance was created.
        </div>
        <div className="px-3 py-2 border-t border-gray-700 shrink-0 mt-auto">
          <button
            onClick={() => { selectInstance(null); deleteNodeInstance(instance.id); }}
            className="w-full px-2 py-1.5 text-xs bg-gray-800 text-red-400 rounded hover:bg-red-900/30 transition-colors"
          >
            Delete instance
          </button>
        </div>
      </div>
    );
  }

  // Build a metadata map from own + inherited fields so we know each field's type
  const inheritedMeta = getInheritedMeta(schemaNode.id, nodes, relationships);
  const allMeta = [...inheritedMeta, ...schemaNode.metadata];
  const metaByName = new Map(allMeta.map((m) => [m.name, m]));

  const systemIdField = instance.fields.find((f) => f.fieldName === 'id');
  const userFields = instance.fields.filter((f) => f.fieldName !== 'id');

  const outgoingRels = relationships.filter((r) => r.sourceId === instance.schemaNodeId);
  const incomingRels = relationships.filter((r) => r.targetId === instance.schemaNodeId);
  const hasIncoming = incomingRels.length > 0;

  const updateField = (fieldName: string, value: FieldValue['value']) => {
    const existing = instance.fields.find((f) => f.fieldName === fieldName);
    const updated = existing
      ? instance.fields.map((f) => (f.fieldName === fieldName ? { ...f, value } : f))
      : [...instance.fields, { fieldName, value }];
    updateNodeInstance(instance.id, { fields: updated });
  };

  const handleDelete = () => {
    if (!confirm(`Delete "${instance.label}"? This will also remove all its relationship links.`)) return;
    selectInstance(null);
    deleteNodeInstance(instance.id);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-gray-700 shrink-0">
        <button
          onClick={() => selectInstance(null)}
          className="text-gray-500 hover:text-gray-300 transition-colors text-sm leading-none px-0.5"
          title="Back"
        >
          ←
        </button>
        <span
          className="w-3 h-3 rounded-sm shrink-0 border border-white/15"
          style={{ background: schemaNode.color }}
        />
        <span className="flex-1 text-sm font-semibold text-white truncate" title={instance.label}>
          {instance.label}
        </span>
        <span className="text-[11px] text-gray-600 shrink-0">{schemaNode.name}</span>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto">

        {/* Fields — editable */}
        <section className="px-3 py-3 border-b border-gray-700/60 space-y-3">
          <p className="text-[10px] uppercase tracking-wider text-gray-600">Fields</p>

          {/* System id — always read-only */}
          <div>
            <label className="flex items-center gap-1.5 text-xs text-gray-600 mb-1">
              id
              <span className="text-[10px] text-gray-700 border border-gray-700 rounded px-1 py-px font-mono">sys</span>
            </label>
            <input
              type="text"
              value={systemIdField ? String(systemIdField.value) : instance.id}
              disabled
              className="w-full px-2 py-1 text-xs bg-gray-800/50 border border-gray-700 rounded text-gray-600 font-mono cursor-not-allowed"
            />
          </div>

          {/* Label */}
          <div>
            <label className="block text-xs text-gray-400 mb-1">Label</label>
            <input
              type="text"
              value={instance.label}
              onChange={(e) => updateNodeInstance(instance.id, { label: e.target.value })}
              disabled={readOnly}
              className={`w-full px-2 py-1 text-sm border rounded focus:outline-none ${
                readOnly
                  ? 'bg-gray-800/50 border-gray-700 text-gray-500 cursor-not-allowed'
                  : 'bg-gray-800 border-gray-600 text-gray-200 focus:border-indigo-500'
              }`}
            />
          </div>

          {/* Schema fields — editable via FieldInput */}
          {userFields.length === 0 && allMeta.length === 0 && (
            <p className="text-xs text-gray-600">No fields defined for this type</p>
          )}

          {allMeta.map((meta, i) => {
            const field = userFields.find((f) => f.fieldName === meta.name);
            return (
              <FieldInput
                key={`${meta.name}-${i}`}
                meta={meta}
                value={field?.value ?? defaultValueForType(meta.dataType)}
                showError={false}
                disabled={readOnly}
                onChange={(v) => updateField(meta.name, v)}
              />
            );
          })}

          {/* Orphaned fields — in instance but not in current schema */}
          {userFields
            .filter((f) => !metaByName.has(f.fieldName))
            .map((f) => (
              <div key={f.fieldName}>
                <label className="flex items-center gap-1.5 text-xs text-gray-500 mb-1">
                  {f.fieldName}
                  <span className="text-[10px] text-gray-700 border border-gray-700 rounded px-1 py-px font-mono">removed</span>
                </label>
                <input
                  type="text"
                  value={f.value == null ? '' : String(f.value)}
                  disabled
                  className="w-full px-2 py-1 text-xs bg-gray-800/50 border border-gray-700 rounded text-gray-600 cursor-not-allowed"
                />
              </div>
            ))}
        </section>

        {/* Outgoing relationships */}
        {outgoingRels.length > 0 && (
          <section className="px-3 py-2">
            <p className="text-[10px] uppercase tracking-wider text-gray-600 mb-0.5">Outgoing</p>
            {outgoingRels.map((rel) => (
              <OutgoingRelSection
                key={rel.id}
                rel={rel}
                sourceInstanceId={instance.id}
                readOnly={readOnly}
              />
            ))}
          </section>
        )}

        {/* Incoming relationships (read-only, only shown when links exist) */}
        {hasIncoming && (
          <section className="px-3 py-2 border-t border-gray-700/40">
            <p className="text-[10px] uppercase tracking-wider text-gray-600 mb-0.5">Incoming</p>
            {incomingRels.map((rel) => (
              <IncomingRelSection
                key={rel.id}
                rel={rel}
                targetInstanceId={instance.id}
              />
            ))}
          </section>
        )}
      </div>

      {/* Footer */}
      {!readOnly && (
        <div className="px-3 py-2 border-t border-gray-700 shrink-0">
          <button
            onClick={handleDelete}
            className="w-full px-2 py-1.5 text-xs bg-gray-800 text-red-400 rounded hover:bg-red-900/30 transition-colors"
          >
            Delete instance
          </button>
        </div>
      )}
    </div>
  );
}
