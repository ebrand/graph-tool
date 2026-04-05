'use client';

import { useEffect, useCallback } from 'react';
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

      if ((e.key === 'Delete' || e.key === 'Backspace') && !isInput) {
        e.preventDefault();
        useGraphStore.getState().deleteSelected();
      }
    };

    // Attach to document in capture phase to intercept before R3F canvas
    document.addEventListener('keydown', handler, { capture: true });
    return () => document.removeEventListener('keydown', handler, { capture: true });
  }, []);

  return (
    <div className="h-screen flex flex-col bg-gray-900 text-gray-100">
      <Toolbar />
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 relative">
          <GraphCanvas />
          <ContextMenu />
        </div>
        <div className="w-72 bg-gray-800 border-l border-gray-700 overflow-y-auto flex-shrink-0">
          <PropertiesPanel />
          <RelationshipsPanel />
        </div>
      </div>
    </div>
  );
}
