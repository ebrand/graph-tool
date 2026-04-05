'use client';

import { useState, useRef, useEffect } from 'react';
import { useGraphStore } from '@/store/graphStore';

const SAVES_KEY = 'graph-creator-saves';
const LAST_SAVE_KEY = 'graph-creator-last-save';

interface SaveEntry {
  name: string;
  data: string;
  date: string;
}

function getSaves(): SaveEntry[] {
  try {
    return JSON.parse(localStorage.getItem(SAVES_KEY) || '[]');
  } catch {
    return [];
  }
}

function setSaves(saves: SaveEntry[]) {
  localStorage.setItem(SAVES_KEY, JSON.stringify(saves));
}

function getLastSaveName(): string | null {
  return localStorage.getItem(LAST_SAVE_KEY);
}

function setLastSaveName(name: string) {
  localStorage.setItem(LAST_SAVE_KEY, name);
}

/** Quick-save to the most recent save slot. Returns the save name or null if no previous save exists. */
export function quickSave(exportGraph: () => string): string | null {
  const lastName = getLastSaveName();
  if (!lastName) return null;
  const saves = getSaves();
  const data = exportGraph();
  const entry: SaveEntry = { name: lastName, data, date: new Date().toLocaleString() };
  const idx = saves.findIndex((s) => s.name === lastName);
  if (idx >= 0) {
    saves[idx] = entry;
  } else {
    saves.push(entry);
  }
  setSaves(saves);
  useGraphStore.getState().markClean();
  return lastName;
}

export default function FileMenu({ onClose }: { onClose: () => void }) {
  const exportGraph = useGraphStore((s) => s.exportGraph);
  const importGraph = useGraphStore((s) => s.importGraph);
  const markClean = useGraphStore((s) => s.markClean);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [saves, setSavesState] = useState<SaveEntry[]>([]);
  const [saveName, setSaveName] = useState('');

  useEffect(() => {
    setSavesState(getSaves());
  }, []);

  const handleExportJSON = () => {
    const json = exportGraph();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'graph.json';
    a.click();
    URL.revokeObjectURL(url);
    onClose();
  };

  const handleImportJSON = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        importGraph(ev.target?.result as string);
        onClose();
      } catch {
        alert('Invalid graph file');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleSave = () => {
    const name = saveName.trim() || `Save ${saves.length + 1}`;
    const data = exportGraph();
    const entry: SaveEntry = { name, data, date: new Date().toLocaleString() };
    const existing = saves.findIndex((s) => s.name === name);
    const updated = [...saves];
    if (existing >= 0) {
      updated[existing] = entry;
    } else {
      updated.push(entry);
    }
    setSaves(updated);
    setSavesState(updated);
    setLastSaveName(name);
    setSaveName('');
    markClean();
  };

  const handleLoad = (entry: SaveEntry) => {
    try {
      importGraph(entry.data);
      setLastSaveName(entry.name);
      onClose();
    } catch {
      alert('Failed to load save');
    }
  };

  const handleDeleteSave = (name: string) => {
    const updated = saves.filter((s) => s.name !== name);
    setSaves(updated);
    setSavesState(updated);
  };

  return (
    <div className="absolute top-12 left-4 z-50 w-72 bg-gray-800 border border-gray-600 rounded-lg shadow-xl max-h-[80vh] overflow-y-auto">
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-700">
        <h3 className="text-sm font-semibold text-gray-200">File</h3>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-200 text-lg leading-none"
        >
          &times;
        </button>
      </div>

      {/* JSON Export/Import */}
      <div className="px-3 pt-3 pb-1">
        <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">JSON File</h4>
      </div>
      <div className="px-3 flex gap-2">
        <button
          onClick={handleExportJSON}
          className="flex-1 px-2 py-1.5 text-xs bg-gray-700 text-gray-200 rounded hover:bg-gray-600 transition-colors"
        >
          Export
        </button>
        <button
          onClick={handleImportJSON}
          className="flex-1 px-2 py-1.5 text-xs bg-gray-700 text-gray-200 rounded hover:bg-gray-600 transition-colors"
        >
          Import
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleFileChange}
          className="hidden"
        />
      </div>

      {/* Named Saves */}
      <div className="px-3 pt-4 pb-1">
        <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Quick Save</h4>
      </div>
      <div className="px-3 flex gap-2">
        <input
          type="text"
          value={saveName}
          onChange={(e) => setSaveName(e.target.value)}
          placeholder="Save name..."
          className="flex-1 px-2 py-1 text-xs bg-gray-900 border border-gray-600 rounded text-gray-200 focus:border-indigo-500 focus:outline-none"
          onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); }}
        />
        <button
          onClick={handleSave}
          className="px-3 py-1 text-xs bg-indigo-600 text-white rounded hover:bg-indigo-500 transition-colors"
        >
          Save
        </button>
      </div>

      {saves.length > 0 && (
        <div className="px-3 pt-3 pb-3 space-y-1">
          {saves.map((entry) => (
            <div
              key={entry.name}
              className="flex items-center justify-between px-2 py-1.5 rounded hover:bg-gray-700 transition-colors group"
            >
              <div>
                <div className="text-xs text-gray-200">{entry.name}</div>
                <div className="text-xs text-gray-500">{entry.date}</div>
              </div>
              <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => handleLoad(entry)}
                  className="text-gray-500 hover:text-green-400 text-xs"
                  title="Load this save"
                >
                  load
                </button>
                <button
                  onClick={() => {
                    const data = exportGraph();
                    const updated = saves.map((s) =>
                      s.name === entry.name ? { ...s, data, date: new Date().toLocaleString() } : s
                    );
                    setSaves(updated);
                    setSavesState(updated);
                    setLastSaveName(entry.name);
                    markClean();
                  }}
                  className="text-gray-500 hover:text-indigo-400 text-xs"
                  title="Update with current graph"
                >
                  save
                </button>
                <button
                  onClick={() => handleDeleteSave(entry.name)}
                  className="text-gray-500 hover:text-red-400 text-xs"
                  title="Delete save"
                >
                  &times;
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
