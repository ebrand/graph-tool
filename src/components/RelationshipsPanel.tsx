'use client';

import { useGraphStore } from '@/store/graphStore';

export default function RelationshipsPanel() {
  const nodes = useGraphStore((s) => s.nodes);
  const relationships = useGraphStore((s) => s.relationships);
  const selectedNodeIds = useGraphStore((s) => s.selectedNodeIds);
  const selectRelationship = useGraphStore((s) => s.selectRelationship);

  // Only show for single node selection
  if (selectedNodeIds.length !== 1) return null;
  const selectedNodeId = selectedNodeIds[0];

  const selectedNode = nodes.find((n) => n.id === selectedNodeId);
  if (!selectedNode) return null;

  const outgoing = relationships.filter((r) => r.sourceId === selectedNodeId);
  const incoming = relationships.filter((r) => r.targetId === selectedNodeId);

  if (outgoing.length === 0 && incoming.length === 0) {
    return (
      <div className="p-4 border-t border-gray-700">
        <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-2">
          Relationships
        </h2>
        <p className="text-xs text-gray-500">No relationships yet.</p>
      </div>
    );
  }

  const getNodeName = (id: string) =>
    nodes.find((n) => n.id === id)?.name ?? '?';

  return (
    <div className="p-4 border-t border-gray-700">
      <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-2">
        Relationships
      </h2>

      {outgoing.length > 0 && (
        <div className="mb-3">
          <h3 className="text-xs text-gray-400 mb-1">Outgoing</h3>
          {outgoing.map((r) => (
            <button
              key={r.id}
              onClick={() => selectRelationship(r.id)}
              className="block w-full text-left px-2 py-1 text-xs text-gray-300 hover:bg-gray-700 rounded transition-colors"
            >
              → {getNodeName(r.targetId)}{' '}
              <span className="text-gray-500">({r.name})</span>
            </button>
          ))}
        </div>
      )}

      {incoming.length > 0 && (
        <div>
          <h3 className="text-xs text-gray-400 mb-1">Incoming</h3>
          {incoming.map((r) => (
            <button
              key={r.id}
              onClick={() => selectRelationship(r.id)}
              className="block w-full text-left px-2 py-1 text-xs text-gray-300 hover:bg-gray-700 rounded transition-colors"
            >
              ← {getNodeName(r.sourceId)}{' '}
              <span className="text-gray-500">({r.name})</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
