'use client';

import { useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useGraphStore } from '@/store/graphStore';
import { quickSave } from '@/components/FileMenu';

import Toolbar from '@/components/Toolbar';
import PropertiesPanel from '@/components/PropertiesPanel';
import RelationshipsPanel from '@/components/RelationshipsPanel';
import ContextMenu from '@/components/ContextMenu';

const GraphCanvas = dynamic(() => import('@/components/Canvas'), {
  ssr: false,
  loading: () => (
    <div className="flex-1 flex items-center justify-center bg-gray-900 text-gray-500">
      Loading canvas...
    </div>
  ),
});

function SidePanel() {
  const hasSelection = useGraphStore((s) =>
    s.selectedNodeIds.length > 0 || s.selectedRelationshipIds.length > 0
  );

  if (!hasSelection) return null;

  return (
    <div className="absolute top-0 right-0 h-full w-72 bg-gray-800 border-l border-gray-700 overflow-y-auto z-10">
      <PropertiesPanel />
      <RelationshipsPanel />
    </div>
  );
}

export default function Home() {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      const isInput = el?.tagName === 'INPUT' || el?.tagName === 'TEXTAREA';

      if ((e.key === 's' || e.code === 'KeyS') && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        const name = quickSave(useGraphStore.getState().exportGraph);
        if (!name) {
          alert('No previous save found. Use File > Save first.');
        }
        return;
      }

      if ((e.key === 'z' || e.code === 'KeyZ') && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        if (e.shiftKey) {
          useGraphStore.getState().redo();
        } else {
          useGraphStore.getState().undo();
        }
        return;
      }

      if ((e.key === 'Delete' || e.key === 'Backspace') && !isInput) {
        e.preventDefault();
        useGraphStore.getState().deleteSelected();
      }
    };

    document.addEventListener('keydown', handler, { capture: true });
    return () => document.removeEventListener('keydown', handler, { capture: true });
  }, []);

  return (
    <div className="h-screen flex flex-col bg-gray-900 text-gray-100">
      <Toolbar />
      <div className="flex-1 relative overflow-hidden">
        <div className="absolute inset-0 z-0">
          <GraphCanvas />
        </div>
        <ContextMenu />
        <SidePanel />
      </div>
    </div>
  );
}
