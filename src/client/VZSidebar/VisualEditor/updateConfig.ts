import type { VizContent, VizFileId } from '@vizhub/viz-types';
import { setNestedProperty, getEditablePropertyValue } from './utils';

export type WidgetValue = string | number | boolean;

/**
 * Apply one or more edits to the LATEST ShareDB content, with exactly one
 * config.json serialization. Never overwrite unrelated properties or files.
 * Skip invalidated paths, type changes, or no-op writes from stale widgets.
 */
export function updateVisualEditorProperties(
  document: VizContent,
  configFileId: VizFileId | null,
  changes: Record<string, WidgetValue>,
): VizContent {
  if (!configFileId) return document;
  const original = document.files[configFileId];
  if (!original) return document;
  let data: unknown;
  try { data = JSON.parse(original.text); } catch { return document; }
  if (!data || typeof data !== 'object' || Array.isArray(data)) return document;

  let next = data as Record<string, unknown>;
  let changed = false;
  for (const [property, value] of Object.entries(changes)) {
    if (typeof value === 'number' && !Number.isFinite(value)) continue;
    const existing = getEditablePropertyValue(next, property);
    if (!existing.found || typeof existing.value !== typeof value ||
      Object.is(existing.value, value)) continue;
    try {
      next = setNestedProperty(next, property, value);
      changed = true;
    } catch {
      // An unsafe/stale property must not reject other valid edits.
    }
  }
  if (!changed) return document;
  return {
    ...document,
    files: {
      ...document.files,
      [configFileId]: {
        ...original,
        text: JSON.stringify(next, null, 2),
      },
    },
  };
}

/** Backward-compatible single-property helper. */
export function updateVisualEditorProperty(
  document: VizContent,
  configFileId: VizFileId | null,
  property: string,
  value: WidgetValue,
): VizContent {
  return updateVisualEditorProperties(document, configFileId, { [property]: value });
}
