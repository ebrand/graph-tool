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
  { key: 'abstractColor', label: 'Abstract / Inherits' },
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
  const defaultTheme = useGraphStore((s) => s.defaultTheme);
  const defaultGrid = useGraphStore((s) => s.defaultGrid);
  const defaultNodeSettings = useGraphStore((s) => s.defaultNodeSettings);
  const applyThemeToAll = useGraphStore((s) => s.applyThemeToAll);
  const resetTheme = useGraphStore((s) => s.resetTheme);
  const setDefaultTheme = useGraphStore((s) => s.setDefaultTheme);

  const isAlreadyDefault =
    JSON.stringify(theme) === JSON.stringify(defaultTheme) &&
    JSON.stringify(grid) === JSON.stringify(defaultGrid) &&
    JSON.stringify(nodeSettings) === JSON.stringify(defaultNodeSettings);

  return (
    <div className="absolute top-full right-0 mt-1 z-50 w-[32rem] bg-gray-800 border border-gray-600 rounded-lg shadow-xl max-h-[calc(100vh-4rem)] overflow-hidden flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-700 shrink-0">
        <h3 className="text-sm font-semibold text-gray-200">Settings</h3>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-200 text-lg leading-none">
          &times;
        </button>
      </div>

      {/* Two-column body */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Left column: Colors + Apply to All + Node Palette ── */}
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4 min-w-0">
          {/* Colors */}
          <div>
            <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Colors</h4>
            <div className="space-y-2">
              {THEME_FIELDS.map(({ key, label }) => (
                <div key={key} className="flex items-center gap-2">
                  <input
                    type="color"
                    value={theme[key]}
                    onChange={(e) => updateTheme({ [key]: e.target.value })}
                    className="w-6 h-6 rounded border border-gray-600 bg-gray-800 cursor-pointer shrink-0"
                  />
                  <label className="text-xs text-gray-300 truncate">{label}</label>
                </div>
              ))}
            </div>
          </div>

          {/* Apply to All — sits right below Colors */}
          <button
            onClick={applyThemeToAll}
            className="w-full px-2 py-1 text-xs text-white bg-indigo-600 rounded hover:bg-indigo-500 transition-colors"
          >
            Apply to All Nodes
          </button>

          {/* Node Palette */}
          <div>
            <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Node Palette</h4>
            <div className="flex gap-1.5 flex-wrap">
              {nodeSettings.palette.map((c, i) => (
                <input
                  key={i}
                  type="color"
                  value={c}
                  onChange={(e) => {
                    const newPalette = [...nodeSettings.palette];
                    newPalette[i] = e.target.value;
                    updateNodeSettings({ palette: newPalette });
                  }}
                  className="w-6 h-6 rounded border border-gray-600 bg-gray-800 cursor-pointer"
                />
              ))}
            </div>
          </div>
        </div>

        {/* Vertical divider */}
        <div className="w-px bg-gray-700 shrink-0" />

        {/* ── Right column: Grid + Nodes ── */}
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4 min-w-0">
          {/* Grid */}
          <div>
            <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Grid</h4>
            <div className="space-y-3">
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
                    grid.snapEnabled ? 'bg-indigo-600 text-white' : 'bg-gray-700 text-gray-400'
                  }`}
                >
                  {grid.snapEnabled ? 'On' : 'Off'}
                </button>
              </div>
            </div>
          </div>

          {/* Nodes */}
          <div>
            <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Nodes</h4>
            <div className="space-y-3">
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
                    nodeSettings.jiggleEnabled ? 'bg-indigo-600 text-white' : 'bg-gray-700 text-gray-400'
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
                    nodeSettings.shadowsEnabled ? 'bg-indigo-600 text-white' : 'bg-gray-700 text-gray-400'
                  }`}
                >
                  {nodeSettings.shadowsEnabled ? 'On' : 'Off'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer — pinned to bottom, outside scrollable columns */}
      <div className="flex gap-2 px-3 py-2 border-t border-gray-700 shrink-0">
        <button
          onClick={setDefaultTheme}
          disabled={isAlreadyDefault}
          className="flex-1 px-2 py-1 text-xs text-gray-300 border border-gray-600 rounded hover:bg-gray-700 transition-colors disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent"
          title={isAlreadyDefault ? 'Already the default theme' : 'New graphs will open with this theme'}
        >
          Set as Default Theme
        </button>
        <button
          onClick={resetTheme}
          disabled={isAlreadyDefault}
          className="flex-1 px-2 py-1 text-xs text-gray-300 border border-gray-600 rounded hover:bg-gray-700 transition-colors disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent"
          title={isAlreadyDefault ? 'Already at the default theme' : 'Restore the saved default theme'}
        >
          Reset to Default Theme
        </button>
      </div>
    </div>
  );
}
