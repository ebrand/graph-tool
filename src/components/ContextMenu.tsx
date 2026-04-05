'use client';

import { useEffect } from 'react';
import { useGraphStore } from '@/store/graphStore';
import { snapToGrid } from '@/utils/geometry';

export default function ContextMenu() {
  const contextMenu = useGraphStore((s) => s.contextMenu);
  const setContextMenu = useGraphStore((s) => s.setContextMenu);
  const addNode = useGraphStore((s) => s.addNode);
  const grid = useGraphStore((s) => s.grid);

  // Close on any click outside
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

  return (
    <div
      className="fixed z-50 bg-gray-800 border border-gray-600 rounded-lg shadow-xl py-1 min-w-[140px]"
      style={{ left: contextMenu.screenX, top: contextMenu.screenY }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <button
        onClick={handleAddNode}
        className="w-full text-left px-3 py-1.5 text-sm text-gray-200 hover:bg-gray-700 transition-colors"
      >
        + Add Node Here
      </button>
    </div>
  );
}
