'use client';

import { useGraphStore } from '@/store/graphStore';
import { ThemeColors } from '@/types';

const THEME_FIELDS: { key: keyof ThemeColors; label: string }[] = [
  { key: 'canvasBg', label: 'Canvas Background' },
  { key: 'canvasGridMajor', label: 'Grid Major' },
  { key: 'canvasGridMinor', label: 'Grid Minor' },
  { key: 'nodeBackground', label: 'Node Background' },
  { key: 'nodeForeground', label: 'Node Text' },
  { key: 'nodeBorder', label: 'Node Border' },
  { key: 'selectionHighlight', label: 'Highlight' },
  { key: 'relationshipLine', label: 'Relationship Line' },
  { key: 'relationshipText', label: 'Relationship Text' },
];

function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-0.5">
      <div className="flex items-center justify-between">
        <label className="text-xs text-gray-300">{label}</label>
        <span className="text-xs text-gray-500 tabular-nums">{value}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value))}
        className="w-full h-1 bg-gray-600 rounded appearance-none cursor-pointer accent-indigo-500"
      />
    </div>
  );
}

interface SettingsPanelProps {
  onClose: () => void;
}

export default function SettingsPanel({ onClose }: SettingsPanelProps) {
  const theme = useGraphStore((s) => s.theme);
  const grid = useGraphStore((s) => s.grid);
  const updateTheme = useGraphStore((s) => s.updateTheme);
  const updateGrid = useGraphStore((s) => s.updateGrid);
  const nodeSettings = useGraphStore((s) => s.nodeSettings);
  const updateNodeSettings = useGraphStore((s) => s.updateNodeSettings);
  const applyThemeToAll = useGraphStore((s) => s.applyThemeToAll);
  const resetTheme = useGraphStore((s) => s.resetTheme);

  return (
    <div className="absolute top-12 left-4 z-50 w-64 bg-gray-800 border border-gray-600 rounded-lg shadow-xl max-h-[calc(100vh-4rem)] overflow-y-auto">
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-700">
        <h3 className="text-sm font-semibold text-gray-200">Settings</h3>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-200 text-lg leading-none"
        >
          &times;
        </button>
      </div>

      {/* Colors */}
      <div className="px-3 pt-3 pb-1">
        <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Colors</h4>
      </div>
      <div className="px-3 space-y-2">
        {THEME_FIELDS.map(({ key, label }) => (
          <div key={key} className="flex items-center gap-2">
            <input
              type="color"
              value={theme[key]}
              onChange={(e) => updateTheme({ [key]: e.target.value })}
              className="w-7 h-7 rounded border border-gray-600 bg-gray-800 cursor-pointer shrink-0"
            />
            <label className="text-xs text-gray-300">{label}</label>
          </div>
        ))}
      </div>

      {/* Grid */}
      <div className="px-3 pt-4 pb-1">
        <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Grid</h4>
      </div>
      <div className="px-3 space-y-3">
        <Slider
          label="Major grid (px)"
          value={grid.majorGridPx}
          min={30}
          max={200}
          step={5}
          onChange={(v) => {
            updateGrid({ majorGridPx: v });
            if (grid.minorGridPx > v) updateGrid({ minorGridPx: v });
          }}
        />
        <Slider
          label="Minor grid (px)"
          value={grid.minorGridPx}
          min={1}
          max={grid.majorGridPx}
          step={1}
          onChange={(v) => updateGrid({ minorGridPx: v })}
        />
        <div className="flex items-center justify-between">
          <label className="text-xs text-gray-300">Snap to grid</label>
          <button
            onClick={() => updateGrid({ snapEnabled: !grid.snapEnabled })}
            className={`px-2 py-0.5 text-xs rounded transition-colors ${
              grid.snapEnabled
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-700 text-gray-400'
            }`}
          >
            {grid.snapEnabled ? 'On' : 'Off'}
          </button>
        </div>
      </div>

      {/* Node Palette */}
      <div className="px-3 pt-4 pb-1">
        <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Node Palette</h4>
      </div>
      <div className="px-3 flex gap-1.5 flex-wrap">
        {nodeSettings.palette.map((c, i) => (
          <div key={i} className="relative">
            <input
              type="color"
              value={c}
              onChange={(e) => {
                const newPalette = [...nodeSettings.palette];
                newPalette[i] = e.target.value;
                updateNodeSettings({ palette: newPalette });
              }}
              className="w-7 h-7 rounded border border-gray-600 bg-gray-800 cursor-pointer"
            />
          </div>
        ))}
      </div>

      {/* Nodes */}
      <div className="px-3 pt-4 pb-1">
        <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Nodes</h4>
      </div>
      <div className="px-3 space-y-3">
        <Slider
          label="Min width (px)"
          value={nodeSettings.minWidthPx}
          min={50}
          max={200}
          step={5}
          onChange={(v) => updateNodeSettings({ minWidthPx: v })}
        />
        <Slider
          label="Rel text position"
          value={nodeSettings.relTextPosition}
          min={10}
          max={90}
          step={5}
          onChange={(v) => updateNodeSettings({ relTextPosition: v })}
        />
        <Slider
          label="Edge gap (px)"
          value={nodeSettings.edgeGapPx}
          min={0}
          max={30}
          step={1}
          onChange={(v) => updateNodeSettings({ edgeGapPx: v })}
        />
        <div className="flex items-center justify-between">
          <label className="text-xs text-gray-300">Hand-drawn lines</label>
          <button
            onClick={() => updateNodeSettings({ jiggleEnabled: !nodeSettings.jiggleEnabled })}
            className={`px-2 py-0.5 text-xs rounded transition-colors ${
              nodeSettings.jiggleEnabled
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-700 text-gray-400'
            }`}
          >
            {nodeSettings.jiggleEnabled ? 'On' : 'Off'}
          </button>
        </div>
        <div className="flex items-center justify-between">
          <label className="text-xs text-gray-300">Drop shadows</label>
          <button
            onClick={() => updateNodeSettings({ shadowsEnabled: !nodeSettings.shadowsEnabled })}
            className={`px-2 py-0.5 text-xs rounded transition-colors ${
              nodeSettings.shadowsEnabled
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-700 text-gray-400'
            }`}
          >
            {nodeSettings.shadowsEnabled ? 'On' : 'Off'}
          </button>
        </div>
      </div>

      {/* Actions */}
      <div className="px-3 py-3 space-y-2">
        <button
          onClick={applyThemeToAll}
          className="w-full px-2 py-1 text-xs text-white bg-indigo-600 rounded hover:bg-indigo-500 transition-colors"
        >
          Apply to All Nodes
        </button>
        <button
          onClick={resetTheme}
          className="w-full px-2 py-1 text-xs text-gray-400 border border-gray-600 rounded hover:bg-gray-700 transition-colors"
        >
          Reset to Defaults
        </button>
      </div>
    </div>
  );
}
