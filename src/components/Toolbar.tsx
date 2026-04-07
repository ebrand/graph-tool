'use client';

import { useState, useEffect, useRef } from 'react';
import { useGraphStore } from '@/store/graphStore';
import { useDataStore } from '@/store/dataStore';
import SettingsPanel from './SettingsPanel';
import FileMenu, { quickSaveSchema, quickSaveData } from './FileMenu';

export default function Toolbar() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [fileOpen, setFileOpen] = useState(false);
  const selectedNodeIds = useGraphStore((s) => s.selectedNodeIds);
  const selectedRelationshipIds = useGraphStore((s) => s.selectedRelationshipIds);
  const addNode = useGraphStore((s) => s.addNode);
  const deleteSelected = useGraphStore((s) => s.deleteSelected);
  const autoLayout = useGraphStore((s) => s.autoLayout);
  const autoLayoutData = useDataStore((s) => s.autoLayoutData);
  const exportGraph = useGraphStore((s) => s.exportGraph);
  const isDirtySchema = useGraphStore((s) => s.isDirty);
  const mode = useDataStore((s) => s.mode);
  const setMode = useDataStore((s) => s.setMode);
  const isDirtyData = useDataStore((s) => s.isDirty);

  const hasSelection = selectedNodeIds.length > 0 || selectedRelationshipIds.length > 0;
  const isSchemaMode = mode === 'schema';
  const isDataGraph = mode === 'data';
  const isDirty = isSchemaMode ? isDirtySchema : isDirtyData;

  const fileRef = useRef<HTMLDivElement>(null);
  const themeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!fileOpen && !settingsOpen) return;
    const handler = (e: PointerEvent) => {
      if (fileOpen && fileRef.current && !fileRef.current.contains(e.target as Node)) {
        setFileOpen(false);
      }
      if (settingsOpen && themeRef.current && !themeRef.current.contains(e.target as Node)) {
        setSettingsOpen(false);
      }
    };
    document.addEventListener('pointerdown', handler);
    return () => document.removeEventListener('pointerdown', handler);
  }, [fileOpen, settingsOpen]);

  return (
    <div className="relative flex items-center gap-2 px-4 py-2 bg-gray-900 border-b border-gray-700">
      <h1 className="text-sm font-semibold text-gray-200 mr-2">Graph Creator</h1>
      <span
        className={`w-3 h-3 rounded-full mr-2 ${isDirty ? 'bg-amber-400' : 'bg-green-500'}`}
        title={isDirty ? 'Unsaved changes' : 'Saved'}
      />

      <div className="relative" ref={fileRef}>
        <button
          onClick={() => { setFileOpen(!fileOpen); setSettingsOpen(false); }}
          className={`px-3 py-1.5 text-sm rounded transition-colors ${
            fileOpen ? 'bg-gray-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          File
        </button>
        {fileOpen && <FileMenu onClose={() => setFileOpen(false)} />}
      </div>

      <div className="flex-1" />

      <span className={`text-xs mr-2 transition-opacity ${isDataGraph ? 'text-gray-500' : 'text-gray-700'}`}>
        {isDataGraph ? 'Option+drag between instances to link' : 'Option+drag from a node to create relationships'}
      </span>
      <div className="w-px h-5 bg-gray-600 mx-1" />
      <button
        onClick={() => {
          const name = isSchemaMode ? quickSaveSchema(exportGraph) : quickSaveData();
          if (!name) alert('No previous save found. Use File > Save first.');
        }}
        disabled={!isDirty}
        className="px-3 py-1.5 text-sm bg-gray-700 text-gray-300 rounded hover:bg-gray-600 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        title="Quick save (⌘S)"
      >
        Save
      </button>
      <button
        onClick={isSchemaMode ? autoLayout : autoLayoutData}
        disabled={isDataGraph}
        className="px-3 py-1.5 text-sm bg-gray-700 text-gray-300 rounded hover:bg-gray-600 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
      >
        Auto Layout
      </button>
      <div className="relative" ref={themeRef}>
        <button
          onClick={() => { if (isSchemaMode) { setSettingsOpen(!settingsOpen); setFileOpen(false); } }}
          disabled={!isSchemaMode}
          className={`px-3 py-1.5 text-sm rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
            settingsOpen ? 'bg-gray-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          Theme
        </button>
        {settingsOpen && <SettingsPanel onClose={() => setSettingsOpen(false)} />}
      </div>
      <div className="w-px h-5 bg-gray-600 mx-1" />
      <button
        onClick={() => addNode()}
        disabled={!isSchemaMode}
        className="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded hover:bg-indigo-500 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
      >
        + Add Node
      </button>
      <button
        onClick={deleteSelected}
        disabled={!isSchemaMode || !hasSelection}
        className="px-3 py-1.5 text-sm bg-red-700 text-white rounded hover:bg-red-600 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
      >
        Delete
      </button>
      <div className="w-px h-5 bg-gray-600 mx-1" />

      {/* Mode toggle — always at the far right so its position is stable across modes */}
      <div className="flex rounded border border-gray-600 overflow-hidden">
        <button
          onClick={() => setMode('schema')}
          className={`px-3 py-1.5 text-sm transition-colors ${
            mode === 'schema' ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
          }`}
        >
          Schema
        </button>
        <button
          onClick={() => setMode('data-entry')}
          className={`px-3 py-1.5 text-sm transition-colors ${
            mode === 'data-entry' ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
          }`}
        >
          Data Entry
        </button>
        <button
          onClick={() => setMode('data')}
          className={`px-3 py-1.5 text-sm transition-colors ${
            mode === 'data' ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
          }`}
        >
          Data Explorer
        </button>
      </div>
    </div>
  );
}
