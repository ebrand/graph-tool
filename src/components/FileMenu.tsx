'use client';

import { useState, useRef, useEffect } from 'react';
import { useGraphStore } from '@/store/graphStore';
import { useDataStore } from '@/store/dataStore';

// ── Storage keys ──────────────────────────────────────────────────────────────

const SCHEMA_SAVES_KEY = 'graph-creator-saves';
const SCHEMA_LAST_KEY  = 'graph-creator-last-save';
const DATA_SAVES_KEY   = 'graph-creator-data-saves';
const DATA_LAST_KEY    = 'graph-creator-data-last-save';

interface SaveEntry {
  name: string;
  data: string;
  date: string;
}

function readSaves(key: string): SaveEntry[] {
  try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch { return []; }
}
function writeSaves(key: string, saves: SaveEntry[]) {
  localStorage.setItem(key, JSON.stringify(saves));
}
function getLastName(key: string): string | null {
  return localStorage.getItem(key);
}
function setLastName(key: string, name: string) {
  localStorage.setItem(key, name);
}

// ── Module-level quick-save helpers (called from Canvas Cmd+S) ───────────────

export function quickSaveSchema(exportGraph: () => string): string | null {
  const lastName = getLastName(SCHEMA_LAST_KEY);
  if (!lastName) return null;
  const saves = readSaves(SCHEMA_SAVES_KEY);
  const entry: SaveEntry = { name: lastName, data: exportGraph(), date: new Date().toLocaleString() };
  const idx = saves.findIndex((s) => s.name === lastName);
  if (idx >= 0) saves[idx] = entry; else saves.push(entry);
  writeSaves(SCHEMA_SAVES_KEY, saves);
  useGraphStore.getState().markClean();
  return lastName;
}

export function quickSaveData(): string | null {
  const lastName = getLastName(DATA_LAST_KEY);
  if (!lastName) return null;
  const saves = readSaves(DATA_SAVES_KEY);
  const entry: SaveEntry = { name: lastName, data: useDataStore.getState().exportData(), date: new Date().toLocaleString() };
  const idx = saves.findIndex((s) => s.name === lastName);
  if (idx >= 0) saves[idx] = entry; else saves.push(entry);
  writeSaves(DATA_SAVES_KEY, saves);
  useDataStore.getState().markClean();
  return lastName;
}

// ── SaveSection component ─────────────────────────────────────────────────────

function SaveSection({
  saves,
  onSave,
  onLoad,
  onUpdate,
  onDelete,
}: {
  saves: SaveEntry[];
  onSave: (name: string) => void;
  onLoad: (entry: SaveEntry) => void;
  onUpdate: (entry: SaveEntry) => void;
  onDelete: (name: string) => void;
}) {
  const [saveName, setSaveName] = useState('');

  return (
    <>
      <div className="px-3 flex gap-2">
        <input
          type="text"
          value={saveName}
          onChange={(e) => setSaveName(e.target.value)}
          placeholder="Save name..."
          className="flex-1 px-2 py-1 text-xs bg-gray-900 border border-gray-600 rounded text-gray-200 focus:border-indigo-500 focus:outline-none"
          onKeyDown={(e) => { if (e.key === 'Enter') { onSave(saveName.trim() || `Save ${saves.length + 1}`); setSaveName(''); } }}
        />
        <button
          onClick={() => { onSave(saveName.trim() || `Save ${saves.length + 1}`); setSaveName(''); }}
          className="px-3 py-1 text-xs bg-indigo-600 text-white rounded hover:bg-indigo-500 transition-colors"
        >
          Save
        </button>
      </div>
      {saves.length > 0 && (
        <div className="px-3 pt-2 pb-1 space-y-1">
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
                <button onClick={() => onLoad(entry)} className="text-gray-500 hover:text-green-400 text-xs" title="Load">load</button>
                <button onClick={() => onUpdate(entry)} className="text-gray-500 hover:text-indigo-400 text-xs" title="Overwrite with current">save</button>
                <button onClick={() => onDelete(entry.name)} className="text-gray-500 hover:text-red-400 text-xs" title="Delete">&times;</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

// ── FileMenu ──────────────────────────────────────────────────────────────────

export default function FileMenu({ onClose }: { onClose: () => void }) {
  const exportGraph   = useGraphStore((s) => s.exportGraph);
  const importGraph   = useGraphStore((s) => s.importGraph);
  const markCleanSchema = useGraphStore((s) => s.markClean);
  const newGraph      = useGraphStore((s) => s.newGraph);
  const isDirtySchema = useGraphStore((s) => s.isDirty);

  const exportData    = useDataStore((s) => s.exportData);
  const importData    = useDataStore((s) => s.importData);
  const markCleanData = useDataStore((s) => s.markClean);
  const clearData     = useDataStore((s) => s.clearData);
  const isDirtyData   = useDataStore((s) => s.isDirty);

  const schemaFileRef = useRef<HTMLInputElement>(null);
  const dataFileRef   = useRef<HTMLInputElement>(null);

  const [schemaSaves, setSchemaSaves] = useState<SaveEntry[]>([]);
  const [dataSaves,   setDataSaves]   = useState<SaveEntry[]>([]);

  useEffect(() => {
    setSchemaSaves(readSaves(SCHEMA_SAVES_KEY));
    setDataSaves(readSaves(DATA_SAVES_KEY));
  }, []);

  // ── Schema helpers ────────────────────────────────────────────────────────

  const saveSchema = (name: string) => {
    const entry: SaveEntry = { name, data: exportGraph(), date: new Date().toLocaleString() };
    const updated = [...schemaSaves];
    const idx = updated.findIndex((s) => s.name === name);
    if (idx >= 0) updated[idx] = entry; else updated.push(entry);
    writeSaves(SCHEMA_SAVES_KEY, updated);
    setLastName(SCHEMA_LAST_KEY, name);
    setSchemaSaves(updated);
    markCleanSchema();
  };

  const loadSchema = (entry: SaveEntry) => {
    try {
      importGraph(entry.data);
      setLastName(SCHEMA_LAST_KEY, entry.name);
      onClose();
    } catch { alert('Failed to load schema save'); }
  };

  const updateSchema = (entry: SaveEntry) => {
    const updated: SaveEntry = { ...entry, data: exportGraph(), date: new Date().toLocaleString() };
    const saves = schemaSaves.map((s) => s.name === entry.name ? updated : s);
    writeSaves(SCHEMA_SAVES_KEY, saves);
    setLastName(SCHEMA_LAST_KEY, entry.name);
    setSchemaSaves(saves);
    markCleanSchema();
  };

  const deleteSchema = (name: string) => {
    const updated = schemaSaves.filter((s) => s.name !== name);
    writeSaves(SCHEMA_SAVES_KEY, updated);
    setSchemaSaves(updated);
  };

  const exportSchemaJSON = () => {
    download(exportGraph(), 'schema.json');
    onClose();
  };

  const importSchemaFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    readFile(file, (text) => {
      try { importGraph(text); onClose(); } catch { alert('Invalid schema file'); }
    });
    e.target.value = '';
  };

  // ── Data helpers ──────────────────────────────────────────────────────────

  const saveData = (name: string) => {
    const entry: SaveEntry = { name, data: exportData(), date: new Date().toLocaleString() };
    const updated = [...dataSaves];
    const idx = updated.findIndex((s) => s.name === name);
    if (idx >= 0) updated[idx] = entry; else updated.push(entry);
    writeSaves(DATA_SAVES_KEY, updated);
    setLastName(DATA_LAST_KEY, name);
    setDataSaves(updated);
    markCleanData();
  };

  const loadData = (entry: SaveEntry) => {
    try {
      importData(entry.data);
      setLastName(DATA_LAST_KEY, entry.name);
      onClose();
    } catch { alert('Failed to load data save'); }
  };

  const updateData = (entry: SaveEntry) => {
    const updated: SaveEntry = { ...entry, data: exportData(), date: new Date().toLocaleString() };
    const saves = dataSaves.map((s) => s.name === entry.name ? updated : s);
    writeSaves(DATA_SAVES_KEY, saves);
    setLastName(DATA_LAST_KEY, entry.name);
    setDataSaves(saves);
    markCleanData();
  };

  const deleteData = (name: string) => {
    const updated = dataSaves.filter((s) => s.name !== name);
    writeSaves(DATA_SAVES_KEY, updated);
    setDataSaves(updated);
  };

  const exportDataJSON = () => {
    download(exportData(), 'data.json');
    onClose();
  };

  const importDataFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    readFile(file, (text) => {
      try { importData(text); onClose(); } catch { alert('Invalid data file'); }
    });
    e.target.value = '';
  };

  return (
    <div className="absolute top-full left-0 mt-1 z-50 w-72 bg-gray-800 border border-gray-600 rounded-lg shadow-xl max-h-[80vh] overflow-y-auto">
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-700">
        <h3 className="text-sm font-semibold text-gray-200">File</h3>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-200 text-lg leading-none">&times;</button>
      </div>

      {/* New graph */}
      <div className="px-3 pt-3 pb-2">
        <button
          onClick={() => {
            const dirty = isDirtySchema || isDirtyData;
            if (dirty && !confirm('You have unsaved changes. Start a new graph anyway?')) return;
            newGraph();
            clearData();
            onClose();
          }}
          className="w-full px-2 py-1.5 text-xs bg-gray-700 text-gray-200 rounded hover:bg-gray-600 transition-colors text-left"
        >
          New graph
        </button>
      </div>

      <div className="border-t border-gray-700" />

      {/* ── Schema ── */}
      <div className="px-3 pt-3 pb-1 flex items-center justify-between">
        <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Schema</h4>
        {isDirtySchema && <span className="w-1.5 h-1.5 rounded-full bg-amber-400" title="Unsaved schema changes" />}
      </div>
      <div className="px-3 flex gap-2 pb-2">
        <button onClick={exportSchemaJSON} className="flex-1 px-2 py-1.5 text-xs bg-gray-700 text-gray-200 rounded hover:bg-gray-600 transition-colors">Export</button>
        <button onClick={() => schemaFileRef.current?.click()} className="flex-1 px-2 py-1.5 text-xs bg-gray-700 text-gray-200 rounded hover:bg-gray-600 transition-colors">Import</button>
        <input ref={schemaFileRef} type="file" accept=".json" onChange={importSchemaFile} className="hidden" />
      </div>
      <SaveSection
        saves={schemaSaves}
        onSave={saveSchema}
        onLoad={loadSchema}
        onUpdate={updateSchema}
        onDelete={deleteSchema}
      />

      <div className="border-t border-gray-700 mt-2" />

      {/* ── Data ── */}
      <div className="px-3 pt-3 pb-1 flex items-center justify-between">
        <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Data</h4>
        {isDirtyData && <span className="w-1.5 h-1.5 rounded-full bg-amber-400" title="Unsaved data changes" />}
      </div>
      <div className="px-3 flex gap-2 pb-2">
        <button onClick={exportDataJSON} className="flex-1 px-2 py-1.5 text-xs bg-gray-700 text-gray-200 rounded hover:bg-gray-600 transition-colors">Export</button>
        <button onClick={() => dataFileRef.current?.click()} className="flex-1 px-2 py-1.5 text-xs bg-gray-700 text-gray-200 rounded hover:bg-gray-600 transition-colors">Import</button>
        <input ref={dataFileRef} type="file" accept=".json" onChange={importDataFile} className="hidden" />
      </div>
      <SaveSection
        saves={dataSaves}
        onSave={saveData}
        onLoad={loadData}
        onUpdate={updateData}
        onDelete={deleteData}
      />
      <div className="pb-2" />
    </div>
  );
}

// ── Utilities ─────────────────────────────────────────────────────────────────

function download(json: string, filename: string) {
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function readFile(file: File, onText: (text: string) => void) {
  const reader = new FileReader();
  reader.onload = (ev) => onText(ev.target?.result as string);
  reader.readAsText(file);
}
