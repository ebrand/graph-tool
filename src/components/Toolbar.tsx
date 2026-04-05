'use client';

import { useState } from 'react';
import { useGraphStore } from '@/store/graphStore';
import SettingsPanel from './SettingsPanel';
import FileMenu from './FileMenu';

export default function Toolbar() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [fileOpen, setFileOpen] = useState(false);
  const selectedNodeIds = useGraphStore((s) => s.selectedNodeIds);
  const selectedRelationshipIds = useGraphStore((s) => s.selectedRelationshipIds);
  const addNode = useGraphStore((s) => s.addNode);
  const deleteSelected = useGraphStore((s) => s.deleteSelected);
  const isDirty = useGraphStore((s) => s.isDirty);

  const hasSelection = selectedNodeIds.length > 0 || selectedRelationshipIds.length > 0;

  return (
    <div className="relative flex items-center gap-2 px-4 py-2 bg-gray-900 border-b border-gray-700">
      <h1 className="text-sm font-semibold text-gray-200 mr-2">Graph Creator</h1>
      <span
        className={`w-3 h-3 rounded-full mr-2 ${isDirty ? 'bg-amber-400' : 'bg-green-500'}`}
        title={isDirty ? 'Unsaved changes' : 'Saved'}
      />
      <button
        onClick={() => { setFileOpen(!fileOpen); setSettingsOpen(false); }}
        className={`px-3 py-1.5 text-sm rounded transition-colors ${
          fileOpen
            ? 'bg-gray-600 text-white'
            : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
        }`}
      >
        File
      </button>
      <button
        onClick={() => addNode()}
        className="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded hover:bg-indigo-500 transition-colors"
      >
        + Add Node
      </button>
      <button
        onClick={deleteSelected}
        disabled={!hasSelection}
        className="px-3 py-1.5 text-sm bg-red-700 text-white rounded hover:bg-red-600 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
      >
        Delete
      </button>
      <button
        onClick={() => { setSettingsOpen(!settingsOpen); setFileOpen(false); }}
        className={`px-3 py-1.5 text-sm rounded transition-colors ${
          settingsOpen
            ? 'bg-gray-600 text-white'
            : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
        }`}
      >
        Theme
      </button>
      <div className="flex-1" />
      <span className="text-xs text-gray-500">
        Option+drag from a node to create relationships
      </span>
      {fileOpen && <FileMenu onClose={() => setFileOpen(false)} />}
      {settingsOpen && <SettingsPanel onClose={() => setSettingsOpen(false)} />}
    </div>
  );
}
