import type {
  VizContent,
  VizFileId,
} from '@vizhub/viz-types';
import {
  setNestedProperty,
  getEditablePropertyValue,
} from './utils';

/**
 * Apply a widget edit against the LATEST ShareDB document, not a stale React
 * closure. Preserve unrelated files and concurrent edits to other properties.
 */
export function updateVisualEditorProperty(
  document: VizContent,
  configFileId: VizFileId | null,
  property: string,
  value: string | number | boolean,
): VizContent {
  if (!configFileId) return document;
  const original = document.files[configFileId];
  if (!original) return document;
  let currentConfig: unknown;
  try {
    currentConfig = JSON.parse(original.text);
  } catch {
    return document;
  }
  if (
    !currentConfig ||
    typeof currentConfig !== 'object' ||
    Array.isArray(currentConfig)
  )
    return document;
  // A widget may become stale after a concurrent config edit. Never recreate
  // a removed property or change the structure of its parent object.
  if (
    !getEditablePropertyValue(currentConfig, property).found
  )
    return document;
  let updated: Record<string, unknown>;
  try {
    updated = setNestedProperty(
      currentConfig as Record<string, unknown>,
      property,
      value,
    );
  } catch {
    return document;
  }
  return {
    ...document,
    files: {
      ...document.files,
      [configFileId]: {
        ...original,
        text: JSON.stringify(updated, null, 2),
      },
    },
  };
}
