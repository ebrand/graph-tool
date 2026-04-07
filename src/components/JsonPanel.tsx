'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useGraphStore } from '@/store/graphStore';
import { useDataStore } from '@/store/dataStore';

type Tab = 'schema' | 'data';

function findIdInJson(text: string, id: string): { start: number; end: number } | null {
  // Find the object block containing this id
  const idPattern = `"id": "${id}"`;
  const altPattern = `"id":"${id}"`;
  let idx = text.indexOf(idPattern);
  if (idx === -1) idx = text.indexOf(altPattern);
  if (idx === -1) return null;

  // Walk backwards to find the opening { of this object
  let braceCount = 0;
  let start = idx;
  for (let i = idx; i >= 0; i--) {
    if (text[i] === '}') braceCount++;
    if (text[i] === '{') {
      if (braceCount === 0) { start = i; break; }
      braceCount--;
    }
  }

  // Walk forward to find the closing }
  braceCount = 0;
  let end = idx;
  for (let i = start; i < text.length; i++) {
    if (text[i] === '{') braceCount++;
    if (text[i] === '}') {
      braceCount--;
      if (braceCount === 0) { end = i + 1; break; }
    }
  }

  return { start, end };
}

export default function JsonPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [tab, setTab] = useState<Tab>('schema');
  const [schemaText, setSchemaText] = useState('');
  const [dataText, setDataText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [highlight, setHighlight] = useState<{ start: number; end: number } | null>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);

  const exportGraph = useGraphStore((s) => s.exportGraph);
  const importGraph = useGraphStore((s) => s.importGraph);
  const exportData = useDataStore((s) => s.exportData);
  const importData = useDataStore((s) => s.importData);
  const clearData = useDataStore((s) => s.clearData);

  const selectedNodeIds = useGraphStore((s) => s.selectedNodeIds);
  const selectedRelationshipIds = useGraphStore((s) => s.selectedRelationshipIds);

  // Load current JSON when panel opens or tab changes
  useEffect(() => {
    if (!open) return;
    if (tab === 'schema') {
      setSchemaText(exportGraph());
    } else {
      setDataText(exportData());
    }
    setError(null);
    setDirty(false);
    setHighlight(null);
  }, [open, tab, exportGraph, exportData]);

  // Scroll to selected node/relationship in the JSON
  useEffect(() => {
    if (!open || dirty) return; // don't jump while user is editing
    const selectedId =
      selectedNodeIds.length === 1 ? selectedNodeIds[0] :
      selectedRelationshipIds.length === 1 ? selectedRelationshipIds[0] :
      null;
    if (!selectedId) { setHighlight(null); return; }

    // Refresh the text to ensure it's current
    const freshText = tab === 'schema' ? exportGraph() : exportData();
    if (tab === 'schema') setSchemaText(freshText);
    else setDataText(freshText);

    const range = findIdInJson(freshText, selectedId);
    if (!range) { setHighlight(null); return; }

    setHighlight(range);

    // Scroll textarea to put the highlighted text at the top
    requestAnimationFrame(() => {
      if (!textRef.current) return;
      const ta = textRef.current;
      const textBefore = freshText.substring(0, range.start);
      const lineNumber = textBefore.split('\n').length - 1;
      // Measure actual line height from textarea
      const style = window.getComputedStyle(ta);
      const lineHeight = parseFloat(style.lineHeight) || 18;
      ta.scrollTop = lineNumber * lineHeight;
      ta.focus();
      ta.setSelectionRange(range.start, range.end);
    });
  }, [open, dirty, selectedNodeIds, selectedRelationshipIds, tab, exportGraph, exportData]);

  const currentText = tab === 'schema' ? schemaText : dataText;
  const setCurrent = tab === 'schema' ? setSchemaText : setDataText;

  const handleChange = (val: string) => {
    setCurrent(val);
    setDirty(true);
    setError(null);
    setHighlight(null);
  };

  const handleApply = () => {
    try {
      JSON.parse(currentText);
      if (tab === 'schema') {
        importGraph(currentText);
      } else {
        importData(currentText);
      }
      setError(null);
      setDirty(false);
    } catch (e) {
      setError('Invalid JSON: ' + (e as Error).message);
    }
  };

  const handleRefresh = () => {
    if (tab === 'schema') {
      setSchemaText(exportGraph());
    } else {
      setDataText(exportData());
    }
    setError(null);
    setDirty(false);
    setHighlight(null);
  };

  const handleFormat = () => {
    try {
      const parsed = JSON.parse(currentText);
      setCurrent(JSON.stringify(parsed, null, 2));
      setError(null);
    } catch (e) {
      setError('Invalid JSON: ' + (e as Error).message);
    }
  };

  if (!open) return null;

  return (
    <div className="absolute top-0 left-0 h-full w-[420px] bg-gray-800 border-r border-gray-700 z-10 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-700 shrink-0">
        <div className="flex rounded border border-gray-600 overflow-hidden">
          <button
            onClick={() => setTab('schema')}
            className={`px-3 py-1 text-xs transition-colors ${
              tab === 'schema' ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            Schema
          </button>
          <button
            onClick={() => setTab('data')}
            className={`px-3 py-1 text-xs transition-colors ${
              tab === 'data' ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            Data
          </button>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleFormat}
            className="px-2 py-1 text-xs text-gray-400 hover:text-gray-200 transition-colors"
            title="Format JSON"
          >
            Format
          </button>
          <button
            onClick={handleRefresh}
            className="px-2 py-1 text-xs text-gray-400 hover:text-gray-200 transition-colors"
            title="Reload from graph"
          >
            Refresh
          </button>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-200 text-lg leading-none ml-1"
          >
            &times;
          </button>
        </div>
      </div>

      {/* Editor */}
      <textarea
        ref={textRef}
        value={currentText}
        onChange={(e) => handleChange(e.target.value)}
        spellCheck={false}
        className="flex-1 p-3 text-xs font-mono bg-gray-900 text-gray-300 resize-none focus:outline-none leading-relaxed"
      />

      {/* Footer */}
      <div className="flex items-center justify-between px-3 py-2 border-t border-gray-700 shrink-0">
        {error ? (
          <span className="text-xs text-red-400 truncate flex-1 mr-2">{error}</span>
        ) : dirty ? (
          <span className="text-xs text-amber-400">Unsaved edits</span>
        ) : highlight ? (
          <span className="text-xs text-indigo-400">Synced to selection</span>
        ) : (
          <span className="text-xs text-gray-500">In sync</span>
        )}
        <div className="flex gap-2">
          {tab === 'data' && (
            <button
              onClick={() => {
                if (confirm('Clear all data instances? This cannot be undone.')) {
                  clearData();
                  setDataText(exportData());
                  setDirty(false);
                  setError(null);
                }
              }}
              className="px-3 py-1 text-xs bg-red-700 text-white rounded hover:bg-red-600 transition-colors"
            >
              Clear All
            </button>
          )}
          <button
            onClick={handleApply}
            disabled={!dirty}
            className="px-3 py-1 text-xs bg-indigo-600 text-white rounded hover:bg-indigo-500 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}
