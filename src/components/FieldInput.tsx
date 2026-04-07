'use client';

/**
 * Shared form utilities for instance data entry.
 * Consumed by AddInstanceModal and InstanceDetailDrawer.
 */

import { MetadataEntry, FieldValue } from '@/types';

export function defaultValueForType(dataType: string): string | number | boolean | null {
  if (dataType === 'boolean') return false;
  if (dataType === 'number') return null;
  return '';
}

export function deriveLabel(fields: FieldValue[], nodeName: string, existingCount: number): string {
  for (const f of fields) {
    if (typeof f.value === 'string' && f.value.trim() !== '') return f.value.trim();
  }
  for (const f of fields) {
    if (typeof f.value === 'number') return `${nodeName} ${f.value}`;
  }
  return `${nodeName} ${existingCount + 1}`;
}

interface FieldInputProps {
  meta: MetadataEntry;
  value: string | number | boolean | null;
  showError: boolean;
  disabled?: boolean;
  inputRef?: React.RefObject<HTMLInputElement | null>;
  onChange: (v: string | number | boolean | null) => void;
}

export function FieldInput({ meta, value, showError, disabled, inputRef, onChange }: FieldInputProps) {
  const isEmpty = value === null || value === '' || value === undefined;
  const invalid = !disabled && showError && meta.required && isEmpty;

  const baseClass = `w-full px-3 py-1.5 text-sm border rounded focus:outline-none transition-colors ${
    disabled
      ? 'bg-gray-800/50 border-gray-700 text-gray-500 cursor-not-allowed'
      : invalid
        ? 'bg-gray-800 border-red-500 text-gray-200 focus:border-red-400'
        : 'bg-gray-800 border-gray-600 text-gray-200 focus:border-indigo-500'
  }`;

  return (
    <div>
      <label className="flex items-center gap-1 text-xs text-gray-400 mb-1">
        {meta.name}
        {meta.required && !disabled && (
          <span className={`font-bold ${invalid ? 'text-red-400' : 'text-red-500/70'}`}>*</span>
        )}
        <span className="ml-auto text-gray-600 font-mono text-[10px]">{meta.dataType}</span>
      </label>

      {meta.dataType === 'boolean' ? (
        <label className={`inline-flex items-center gap-2.5 select-none ${disabled ? 'opacity-50' : 'cursor-pointer'}`}>
          <button
            type="button"
            role="switch"
            aria-checked={Boolean(value)}
            onClick={() => !disabled && onChange(!value)}
            disabled={disabled}
            className={`relative w-9 h-5 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1 focus:ring-offset-gray-900 disabled:cursor-not-allowed ${
              value ? 'bg-indigo-600' : 'bg-gray-700'
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                value ? 'translate-x-4' : 'translate-x-0'
              }`}
            />
          </button>
          <span className="text-sm text-gray-300">{value ? 'Yes' : 'No'}</span>
        </label>
      ) : meta.dataType === 'number' ? (
        <input
          ref={inputRef as React.RefObject<HTMLInputElement>}
          type="number"
          value={value == null ? '' : String(value)}
          onChange={(e) => onChange(e.target.value === '' ? null : parseFloat(e.target.value))}
          disabled={disabled}
          className={baseClass}
          placeholder="0"
        />
      ) : meta.dataType === 'date' ? (
        <input
          ref={inputRef as React.RefObject<HTMLInputElement>}
          type="date"
          value={value == null ? '' : String(value)}
          onChange={(e) => onChange(e.target.value || null)}
          disabled={disabled}
          className={baseClass}
        />
      ) : (
        <input
          ref={inputRef as React.RefObject<HTMLInputElement>}
          type="text"
          value={value == null ? '' : String(value)}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className={baseClass}
          placeholder={meta.name}
        />
      )}

      {invalid && (
        <p className="mt-0.5 text-xs text-red-400">{meta.name} is required</p>
      )}
    </div>
  );
}
