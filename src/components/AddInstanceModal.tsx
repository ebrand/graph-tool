'use client';

import { useEffect, useRef, useState } from 'react';
import { useGraphStore } from '@/store/graphStore';
import { useDataStore, generateInstanceId } from '@/store/dataStore';
import { FieldValue, GraphNode, Relationship } from '@/types';
import { FieldInput, defaultValueForType, deriveLabel } from './FieldInput';

// ── Relationship helpers ──────────────────────────────────────────────────────

/** Returns all schema node IDs that (transitively) inherit from nodeId. */
function getSubtypeIds(nodeId: string, relationships: Relationship[]): string[] {
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

// ── Inheritance helpers ───────────────────────────────────────────────────────

/** Walk the inherits-from chain upward; returns [direct parent, grandparent, …]. */
function getAncestorChain(
  nodeId: string,
  relationships: Relationship[],
  nodes: GraphNode[],
): GraphNode[] {
  const ancestors: GraphNode[] = [];
  const visited = new Set<string>();
  let currentId = nodeId;

  while (true) {
    const parentRel = relationships.find(
      (r) => r.kind === 'inherits-from' && r.sourceId === currentId,
    );
    if (!parentRel || visited.has(parentRel.targetId)) break;
    const parent = nodes.find((n) => n.id === parentRel.targetId);
    if (!parent) break;
    ancestors.push(parent);
    visited.add(parent.id);
    currentId = parent.id;
  }

  return ancestors;
}

/** Returns immediate concrete subtypes (nodes that inherit FROM nodeId). */
function getSubtypeNodes(
  nodeId: string,
  relationships: Relationship[],
  nodes: GraphNode[],
): GraphNode[] {
  return relationships
    .filter((r) => r.kind === 'inherits-from' && r.targetId === nodeId)
    .map((r) => nodes.find((n) => n.id === r.sourceId))
    .filter((n): n is GraphNode => n !== undefined);
}

// ── Subtype picker ────────────────────────────────────────────────────────────

function SubtypePicker({
  baseNode,
  subtypes,
  onSelect,
  onClose,
}: {
  baseNode: GraphNode;
  subtypes: GraphNode[];
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-full max-w-sm flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start gap-3 px-5 py-4 border-b border-gray-700">
          <span
            className="w-5 h-5 rounded shrink-0 mt-0.5 border border-white/15"
            style={{ background: baseNode.color }}
          />
          <div className="flex-1">
            <h2 className="text-base font-semibold text-white">Which kind?</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {baseNode.name} is abstract — select a concrete type
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-300 text-xl leading-none shrink-0"
          >
            ×
          </button>
        </div>

        {/* Subtype list */}
        <div className="px-4 py-3 space-y-2">
          {subtypes.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-2">
              No subtypes defined yet.
              <br />
              <span className="text-xs text-gray-600">
                Add <em>inherits-from</em> relationships from concrete nodes to {baseNode.name}.
              </span>
            </p>
          ) : (
            subtypes.map((sub) => (
              <button
                key={sub.id}
                onClick={() => onSelect(sub.id)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg bg-gray-800 hover:bg-gray-700 transition-colors text-left group"
              >
                <span
                  className="w-4 h-4 rounded-sm shrink-0 border border-white/15"
                  style={{ background: sub.color }}
                />
                <span className="flex-1 text-sm text-gray-200">{sub.name}</span>
                {sub.description && (
                  <span className="text-xs text-gray-500 truncate max-w-[120px]">{sub.description}</span>
                )}
                <span className="text-gray-600 group-hover:text-gray-400 text-sm">→</span>
              </button>
            ))
          )}
        </div>

        <div className="px-4 pb-4">
          <button
            onClick={onClose}
            className="w-full px-3 py-1.5 text-sm bg-gray-800 text-gray-400 rounded-lg hover:bg-gray-700 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ── AddInstanceModal ──────────────────────────────────────────────────────────

export default function AddInstanceModal() {
  const nodeId = useDataStore((s) => s.addingInstanceForNodeId);
  const close = useDataStore((s) => s.setAddingInstanceForNodeId);
  const addNodeInstance = useDataStore((s) => s.addNodeInstance);
  const addRelationshipInstance = useDataStore((s) => s.addRelationshipInstance);
  const nodeInstances = useDataStore((s) => s.nodeInstances);
  const existingCount = useDataStore(
    (s) => s.nodeInstances.filter((ni) => ni.schemaNodeId === nodeId).length,
  );
  const baseNode = useGraphStore((s) => s.nodes.find((n) => n.id === nodeId));
  const allNodes = useGraphStore((s) => s.nodes);
  const relationships = useGraphStore((s) => s.relationships);
  const enforceChildOwns = useGraphStore((s) => s.nodeSettings.enforceChildOwnsRelationship);

  // When the base node is abstract, the user first picks a concrete subtype
  const [subtypeId, setSubtypeId] = useState<string | null>(null);

  const effectiveNode = subtypeId
    ? allNodes.find((n) => n.id === subtypeId)
    : baseNode;

  // Ancestors of the effective (concrete) node, outermost first
  const ancestors = effectiveNode
    ? getAncestorChain(effectiveNode.id, relationships, allNodes).reverse()
    : [];

  // Subtypes of the base node (for abstract picker)
  const subtypes = baseNode ? getSubtypeNodes(baseNode.id, relationships, allNodes) : [];

  const isAbstract = baseNode?.abstract ?? false;
  const showPicker = isAbstract && subtypeId === null;

  // ── Form state ──────────────────────────────────────────────────────────────

  // Build flat fields array: [ancestor0 fields…, ancestor1 fields…, …, own fields…]
  const inheritedMeta = ancestors.flatMap((a) => a.metadata);
  const ownMeta = effectiveNode?.metadata ?? [];

  const [fields, setFields] = useState<FieldValue[]>([]);
  const [labelOverride, setLabelOverride] = useState('');
  const [attempted, setAttempted] = useState(false);
  const [previewId, setPreviewId] = useState(() => generateInstanceId());
  // relKey → selected target instance id; relKey = `${rel.id}:out` or `${rel.id}:in`
  const [relTargets, setRelTargets] = useState<Record<string, string>>({});
  const addedCountRef = useRef(0);
  const firstInputRef = useRef<HTMLInputElement>(null);

  // Reinitialise form when modal opens for a new node or subtype is selected
  useEffect(() => {
    if (!effectiveNode) return;
    setFields([
      ...inheritedMeta.map((m) => ({ fieldName: m.name, value: defaultValueForType(m.dataType) })),
      ...ownMeta.map((m) => ({ fieldName: m.name, value: defaultValueForType(m.dataType) })),
    ]);
    setLabelOverride('');
    setAttempted(false);
    setPreviewId(generateInstanceId());
    setRelTargets({});
    addedCountRef.current = 0;
    requestAnimationFrame(() => firstInputRef.current?.focus());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveNode?.id]);

  // Reset subtype selection and preview ID when modal opens for a different base node
  useEffect(() => {
    setSubtypeId(null);
    setRelTargets({});
    if (nodeId) setPreviewId(generateInstanceId());
  }, [nodeId]);

  // Close on Escape
  useEffect(() => {
    if (!nodeId) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') close(null); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [nodeId, close]);

  if (!nodeId || !baseNode) return null;

  // ── Subtype picker ──────────────────────────────────────────────────────────

  if (showPicker) {
    return (
      <SubtypePicker
        baseNode={baseNode}
        subtypes={subtypes}
        onSelect={setSubtypeId}
        onClose={() => close(null)}
      />
    );
  }

  if (!effectiveNode) return null;

  // ── Form helpers ────────────────────────────────────────────────────────────

  const setField = (index: number, value: string | number | boolean | null) => {
    setFields((prev) => prev.map((f, i) => (i === index ? { ...f, value } : f)));
  };

  const allMeta = [...inheritedMeta, ...ownMeta];
  const allRequiredFilled = allMeta
    .filter((m) => m.required)
    .every((m) => {
      const f = fields.find((f) => f.fieldName === m.name);
      return f && f.value !== null && f.value !== '' && f.value !== undefined;
    });

  const derivedLabel = deriveLabel(fields, effectiveNode.name, existingCount + addedCountRef.current);

  const canSubmit =
    effectiveNode.metadata.length === 0 && inheritedMeta.length === 0
      ? labelOverride.trim() !== ''
      : allRequiredFilled;

  // Outgoing relationships only (source = this node or ancestors).
  // Outgoing relationships (child→parent): shown prominently.
  // Incoming relationships (parent→child): shown as optional "link existing" selectors.
  type RelDir = 'out' | 'in';
  const effectiveNodeIds = new Set([effectiveNode.id, ...ancestors.map((a) => a.id)]);
  const relevantRels: Array<{ rel: Relationship; dir: RelDir; otherNodeId: string }> = [
    ...relationships
      .filter((r) => effectiveNodeIds.has(r.sourceId) && r.kind !== 'inherits-from')
      .map((r) => ({ rel: r, dir: 'out' as RelDir, otherNodeId: r.targetId })),
    // Incoming relationships: only when "child owns relationship" is off
    ...(enforceChildOwns ? [] : relationships
      .filter((r) => effectiveNodeIds.has(r.targetId) && r.kind !== 'inherits-from')
      // Exclude if the same pair already appears as outgoing (bidirectional)
      .filter((r) => !relationships.some(
        (o) => o.sourceId === r.targetId && o.targetId === r.sourceId && o.kind !== 'inherits-from'
          && effectiveNodeIds.has(o.sourceId)
      ))
      .map((r) => ({ rel: r, dir: 'in' as RelDir, otherNodeId: r.sourceId }))),
  ];

  const resetForm = () => {
    setFields([
      ...inheritedMeta.map((m) => ({ fieldName: m.name, value: defaultValueForType(m.dataType) })),
      ...ownMeta.map((m) => ({ fieldName: m.name, value: defaultValueForType(m.dataType) })),
    ]);
    setLabelOverride('');
    setAttempted(false);
    setPreviewId(generateInstanceId());
    setRelTargets({});
    requestAnimationFrame(() => firstInputRef.current?.focus());
  };

  const doAdd = (): boolean => {
    if (!canSubmit) { setAttempted(true); return false; }
    const label =
      labelOverride.trim() ||
      deriveLabel(fields, effectiveNode.name, existingCount + addedCountRef.current);
    const scatter = { x: (Math.random() - 0.5) * 1.5, y: (Math.random() - 0.5) * 1.5 };
    const pos = { x: effectiveNode.position.x + scatter.x, y: effectiveNode.position.y + scatter.y };
    addNodeInstance(effectiveNode.id, label, fields, previewId, pos);
    // Create relationship instances for any linked targets,
    // plus auto-create reverse relationships if they exist in the schema
    for (const { rel, dir } of relevantRels) {
      const selectedId = relTargets[`${rel.id}:${dir}`];
      if (!selectedId) continue;
      if (dir === 'out') {
        addRelationshipInstance(rel.id, previewId, selectedId, []);
        // Auto-create reverse if it exists
        const reverseRel = relationships.find(
          (r) => r.sourceId === rel.targetId && r.targetId === rel.sourceId && r.kind !== 'inherits-from'
        );
        if (reverseRel) {
          addRelationshipInstance(reverseRel.id, selectedId, previewId, []);
        }
      } else {
        // Incoming: the selected instance is the source, new instance is the target
        addRelationshipInstance(rel.id, selectedId, previewId, []);
        // Auto-create reverse if it exists
        const reverseRel = relationships.find(
          (r) => r.sourceId === rel.targetId && r.targetId === rel.sourceId && r.kind !== 'inherits-from'
        );
        if (reverseRel) {
          addRelationshipInstance(reverseRel.id, previewId, selectedId, []);
        }
      }
    }
    addedCountRef.current += 1;
    return true;
  };

  // Build grouped sections for the form body
  // Each section: { label, color, metadata, startIndex }
  const sections: Array<{ label: string; color: string; metadata: typeof ownMeta; startIndex: number }> = [];
  let offset = 0;
  for (const ancestor of ancestors) {
    if (ancestor.metadata.length > 0) {
      sections.push({ label: `From ${ancestor.name}`, color: ancestor.color, metadata: ancestor.metadata, startIndex: offset });
    }
    offset += ancestor.metadata.length;
  }
  if (ownMeta.length > 0) {
    sections.push({ label: effectiveNode.name, color: effectiveNode.color, metadata: ownMeta, startIndex: offset });
  }
  const hasMultipleSections = sections.length > 1;
  const hasNoFields = sections.length === 0;

  const totalFields = allMeta.length;
  const requiredCount = allMeta.filter((m) => m.required).length;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => close(null)} />

      <div
        className="relative bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-full max-w-md flex flex-col max-h-[88vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start gap-3 px-5 py-4 border-b border-gray-700 shrink-0">
          <span
            className="w-5 h-5 rounded shrink-0 mt-0.5 border border-white/15 shadow-inner"
            style={{ background: effectiveNode.color }}
          />
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-semibold text-white leading-tight">
              {effectiveNode.name}
            </h2>
            {/* Show lineage for subtype instances */}
            {subtypeId && ancestors.length > 0 && (
              <p className="text-xs text-violet-400 mt-0.5">
                ↑ {ancestors.map((a) => a.name).join(' → ')}
              </p>
            )}
            {effectiveNode.type && effectiveNode.type !== 'default' && !subtypeId && (
              <p className="text-xs text-gray-500 mt-0.5">{effectiveNode.type}</p>
            )}
            {effectiveNode.description && (
              <p className="text-xs text-gray-400 mt-1 leading-snug">{effectiveNode.description}</p>
            )}
          </div>
          <button
            onClick={() => close(null)}
            className="text-gray-500 hover:text-gray-300 text-xl leading-none mt-0.5 shrink-0"
          >
            ×
          </button>
        </div>

        {/* Summary strip */}
        {totalFields > 0 && (
          <div className="px-5 py-2 bg-gray-800/50 border-b border-gray-700/60 flex items-center gap-3 shrink-0">
            <span className="text-xs text-gray-500">{totalFields} field{totalFields !== 1 ? 's' : ''}</span>
            {requiredCount > 0 && (
              <>
                <span className="text-gray-700">·</span>
                <span className="text-xs text-red-400/80">{requiredCount} required</span>
              </>
            )}
            {ancestors.length > 0 && (
              <>
                <span className="text-gray-700">·</span>
                <span className="text-xs text-violet-400/80">{inheritedMeta.length} inherited</span>
              </>
            )}
            {addedCountRef.current > 0 && (
              <>
                <span className="text-gray-700">·</span>
                <span className="text-xs text-green-400/80">+{addedCountRef.current} added</span>
              </>
            )}
          </div>
        )}

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {/* System id — auto-generated, read-only */}
          <div>
            <label className="flex items-center gap-1.5 text-xs text-gray-600 mb-1">
              id
              <span className="text-[10px] text-gray-700 border border-gray-700 rounded px-1 py-px font-mono">auto</span>
            </label>
            <input
              type="text"
              value={previewId}
              disabled
              className="w-full px-3 py-1.5 text-xs bg-gray-800/50 border border-gray-700 rounded text-gray-600 font-mono cursor-not-allowed"
            />
          </div>

          {hasNoFields && (
            <p className="text-xs text-gray-500">
              No fields defined. Provide a label below to identify this instance.
            </p>
          )}

          {sections.map((section, si) => (
            <div key={si}>
              {hasMultipleSections && (
                <div className="flex items-center gap-2 mb-3 pb-1.5 border-b border-gray-700/60">
                  <span
                    className="w-2.5 h-2.5 rounded-sm shrink-0 border border-white/10"
                    style={{ background: section.color }}
                  />
                  <p className="text-[11px] uppercase tracking-wider text-gray-500 font-medium">
                    {section.label}
                  </p>
                </div>
              )}
              <div className="space-y-3.5">
                {section.metadata.map((meta, i) => (
                  <FieldInput
                    key={meta.name || i}
                    meta={meta}
                    value={fields[section.startIndex + i]?.value ?? null}
                    showError={attempted}
                    inputRef={si === 0 && i === 0 ? firstInputRef : undefined}
                    onChange={(v) => setField(section.startIndex + i, v)}
                  />
                ))}
              </div>
            </div>
          ))}

          {/* Label override */}
          <div className={hasNoFields ? '' : 'pt-1 border-t border-gray-700/60'}>
            <label className="flex items-center gap-1 text-xs text-gray-400 mb-1">
              Label
              {hasNoFields && <span className="font-bold text-red-500/70">*</span>}
              {!hasNoFields && (
                <span className="text-gray-600 ml-1">— optional</span>
              )}
            </label>
            <input
              ref={hasNoFields ? (firstInputRef as React.RefObject<HTMLInputElement>) : undefined}
              type="text"
              value={labelOverride}
              onChange={(e) => setLabelOverride(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { if (doAdd()) close(null); } }}
              placeholder={hasNoFields ? `${effectiveNode.name} label` : derivedLabel}
              className={`w-full px-3 py-1.5 text-sm bg-gray-800 border rounded text-gray-200 focus:outline-none transition-colors ${
                attempted && hasNoFields && labelOverride.trim() === ''
                  ? 'border-red-500 focus:border-red-400'
                  : 'border-gray-600 focus:border-indigo-500'
              }`}
            />
          </div>

          {/* Relationship links — optional */}
          {relevantRels.length > 0 && (
            <div className="pt-1 border-t border-gray-700/60 space-y-2.5">
              <p className="text-xs text-gray-400">
                Relationships <span className="text-gray-600">— optional</span>
              </p>
              {relevantRels.map(({ rel, dir, otherNodeId }) => {
                const otherNode = allNodes.find((n) => n.id === otherNodeId);
                if (!otherNode) return null;
                const otherSchemaIds = new Set([otherNodeId, ...getSubtypeIds(otherNodeId, relationships)]);
                const candidates = nodeInstances.filter((ni) => otherSchemaIds.has(ni.schemaNodeId));
                const relKey = `${rel.id}:${dir}`;
                const dirLabel = dir === 'out'
                  ? `→ ${rel.name} → ${otherNode.name}`
                  : `← ${otherNode.name} ${rel.name} (link existing)`;
                return (
                  <div key={relKey}>
                    <label className="flex items-center gap-1.5 text-[11px] text-gray-500 mb-1">
                      <span
                        className="w-2 h-2 rounded-sm shrink-0 border border-white/10"
                        style={{ background: otherNode.color }}
                      />
                      {dirLabel}
                    </label>
                    <select
                      value={relTargets[relKey] ?? ''}
                      onChange={(e) =>
                        setRelTargets((prev) => ({ ...prev, [relKey]: e.target.value }))
                      }
                      className="w-full px-2 py-1.5 text-xs bg-gray-800 border border-gray-600 rounded text-gray-300 focus:outline-none focus:border-indigo-500 transition-colors"
                    >
                      <option value="">— none —</option>
                      {candidates.length === 0 ? (
                        <option disabled value="">No {otherNode.name} instances yet</option>
                      ) : (
                        candidates.map((ni) => (
                          <option key={ni.id} value={ni.id}>{ni.label}</option>
                        ))
                      )}
                    </select>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-gray-700 flex items-center gap-2 shrink-0">
          <button
            onClick={() => close(null)}
            className="px-3 py-1.5 text-sm bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 transition-colors"
          >
            Cancel
          </button>
          {/* Allow stepping back to subtype picker */}
          {subtypeId && (
            <button
              onClick={() => setSubtypeId(null)}
              className="px-3 py-1.5 text-sm bg-gray-700 text-violet-400 rounded-lg hover:bg-gray-600 transition-colors"
            >
              ← Change type
            </button>
          )}
          <div className="flex-1" />
          <button
            onClick={() => { if (doAdd()) resetForm(); }}
            className="px-3 py-1.5 text-sm bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 transition-colors"
          >
            Add &amp; another
          </button>
          <button
            onClick={() => { if (doAdd()) close(null); }}
            className="px-4 py-1.5 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 font-medium transition-colors"
          >
            Add instance
          </button>
        </div>
      </div>
    </div>
  );
}
