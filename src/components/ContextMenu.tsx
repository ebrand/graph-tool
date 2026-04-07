'use client';

import { useEffect } from 'react';
import { useGraphStore } from '@/store/graphStore';
import { snapToGrid } from '@/utils/geometry';
import { MetadataType } from '@/types';

const DATA_TYPE_COLORS: Record<MetadataType, string> = {
  string: 'bg-gray-600 text-gray-200',
  number: 'bg-blue-800 text-blue-200',
  boolean: 'bg-green-800 text-green-200',
  date: 'bg-amber-800 text-amber-200',
};

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 text-xs">
      <span className="text-gray-500 shrink-0">{label}</span>
      <span className="text-gray-300 text-right break-all">{value}</span>
    </div>
  );
}

function NodeDetails({ id }: { id: string }) {
  const node = useGraphStore((s) => s.nodes.find((n) => n.id === id));
  if (!node) return <p className="px-3 py-2 text-gray-400 text-xs">Node not found</p>;

  return (
    <>
      <div className="px-3 py-2 flex items-center gap-2 border-b border-gray-700">
        <span
          className="w-3 h-3 rounded-sm shrink-0 border border-white/20"
          style={{ background: node.color }}
        />
        <span className="font-semibold text-white text-sm truncate">{node.name}</span>
      </div>

      <div className="px-3 py-2 space-y-1 border-b border-gray-700">
        <Row label="type" value={node.type} />
        {node.description && <Row label="description" value={node.description} />}
      </div>

      {node.metadata.length > 0 && (
        <div className="px-3 py-2">
          <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-1.5">Properties</p>
          <div className="space-y-1">
            {node.metadata.map((m, i) => (
              <div key={i} className="flex items-center justify-between gap-2">
                <span className="text-xs text-gray-300 truncate flex items-center gap-0.5">
                  {m.name}
                  {m.required && <span className="text-red-400 font-bold leading-none">*</span>}
                </span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono shrink-0 ${DATA_TYPE_COLORS[m.dataType] ?? 'bg-gray-700 text-gray-300'}`}>
                  {m.dataType}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

function RelationshipDetails({ id }: { id: string }) {
  const rel = useGraphStore((s) => s.relationships.find((r) => r.id === id));
  const nodes = useGraphStore((s) => s.nodes);
  if (!rel) return <p className="px-3 py-2 text-gray-400 text-xs">Relationship not found</p>;

  const source = nodes.find((n) => n.id === rel.sourceId);
  const target = nodes.find((n) => n.id === rel.targetId);

  return (
    <>
      <div className="px-3 py-2 border-b border-gray-700">
        <div className="flex items-center gap-1 text-xs min-w-0">
          {rel.sourceCardinality && (
            <span className="text-gray-500 font-mono shrink-0">{rel.sourceCardinality}</span>
          )}
          <span className="text-gray-400 truncate max-w-[56px]" title={source?.name}>{source?.name ?? '?'}</span>
          <span className="text-gray-600 shrink-0">→</span>
          <span className="font-semibold text-white truncate shrink-0">{rel.name}</span>
          <span className="text-gray-600 shrink-0">→</span>
          <span className="text-gray-400 truncate max-w-[56px]" title={target?.name}>{target?.name ?? '?'}</span>
          {rel.targetCardinality && (
            <span className="text-gray-500 font-mono shrink-0">{rel.targetCardinality}</span>
          )}
        </div>
      </div>

      <div className="px-3 py-2 space-y-1 border-b border-gray-700">
        <Row label="type" value={rel.type} />
        <Row label="weight" value={String(rel.weight)} />
      </div>

      {rel.metadata.length > 0 && (
        <div className="px-3 py-2">
          <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-1.5">Metadata</p>
          <div className="space-y-1">
            {rel.metadata.map((m, i) => (
              <div key={i} className="flex items-center justify-between gap-2">
                <span className="text-xs text-gray-300 truncate flex items-center gap-0.5">
                  {m.name}
                  {m.required && <span className="text-red-400 font-bold leading-none">*</span>}
                </span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono shrink-0 ${DATA_TYPE_COLORS[m.dataType] ?? 'bg-gray-700 text-gray-300'}`}>
                  {m.dataType}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

export default function ContextMenu() {
  const contextMenu = useGraphStore((s) => s.contextMenu);
  const setContextMenu = useGraphStore((s) => s.setContextMenu);
  const addNode = useGraphStore((s) => s.addNode);
  const grid = useGraphStore((s) => s.grid);

  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    window.addEventListener('pointerdown', close);
    return () => window.removeEventListener('pointerdown', close);
  }, [contextMenu, setContextMenu]);

  if (!contextMenu) return null;

  const handleAddNode = (e: React.MouseEvent) => {
    e.stopPropagation();
    const pos = { x: contextMenu.worldX, y: contextMenu.worldY };
    addNode(grid.snapEnabled ? snapToGrid(pos, grid.minorGridPx) : pos);
    setContextMenu(null);
  };

  // Viewport-aware positioning: flip left/up when near the right/bottom edge
  const flipX = contextMenu.screenX > window.innerWidth * 0.65;
  const flipY = contextMenu.screenY > window.innerHeight * 0.55;
  const style: React.CSSProperties = {
    left: flipX ? undefined : contextMenu.screenX,
    right: flipX ? window.innerWidth - contextMenu.screenX : undefined,
    top: flipY ? undefined : contextMenu.screenY,
    bottom: flipY ? window.innerHeight - contextMenu.screenY : undefined,
  };

  const { target } = contextMenu;

  return (
    <div
      className="fixed z-50 bg-gray-900 border border-gray-700 rounded-lg shadow-2xl w-[240px] max-h-[420px] overflow-y-auto"
      style={style}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {!target ? (
        <button
          onClick={handleAddNode}
          className="w-full text-left px-3 py-1.5 text-sm text-gray-200 hover:bg-gray-700 transition-colors rounded-lg"
        >
          + Add Node Here
        </button>
      ) : target.kind === 'node' ? (
        <NodeDetails id={target.id} />
      ) : (
        <RelationshipDetails id={target.id} />
      )}
    </div>
  );
}
