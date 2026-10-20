import { color } from 'd3-color';
import type { VisualEditorEmptyReason } from '../../../types';

const UNSAFE_PATH_SEGMENTS = new Set([
  '__proto__',
  'constructor',
  'prototype',
]);

const isRecord = (
  value: unknown,
): value is Record<string, unknown> =>
  value !== null &&
  typeof value === 'object' &&
  !Array.isArray(value);

/**
 * Resolve only own properties of plain JSON objects, using the same dot-path
 * semantics as setNestedProperty. Missing values, arrays in the path and
 * dangerous keys are not editable targets.
 */
function editableValueAt(
  config: Record<string, unknown>,
  path: string,
): { found: boolean; value: unknown } {
  const segments = path.split('.');
  if (
    segments.some(
      (segment) =>
        !segment || UNSAFE_PATH_SEGMENTS.has(segment),
    )
  ) {
    return { found: false, value: undefined };
  }

  let value: unknown = config;
  for (const segment of segments) {
    if (
      !isRecord(value) ||
      !Object.prototype.hasOwnProperty.call(value, segment)
    ) {
      return { found: false, value: undefined };
    }
    value = value[segment];
  }

  return { found: true, value };
}

/** Pure classifier shared by the visual editor and host integration tests. */
export function getVisualEditorEmptyReason(
  configText: string | null,
): VisualEditorEmptyReason | null {
  if (configText === null) return 'missing-config';
  let config: unknown;
  try {
    config = JSON.parse(configText);
  } catch {
    return 'invalid-config';
  }
  if (!isRecord(config)) return 'invalid-config';
  if (!Object.prototype.hasOwnProperty.call(config, 'visualEditorWidgets'))
    return 'missing-widgets';

  const widgets = config.visualEditorWidgets;
  if (!Array.isArray(widgets)) return 'invalid-widgets';
  if (!widgets.length) return 'empty-widgets';

  for (const widget of widgets) {
    if (
      !isRecord(widget) ||
      typeof widget.property !== 'string' ||
      !widget.property ||
      typeof widget.label !== 'string' ||
      !widget.label.trim()
    ) {
      return 'invalid-widgets';
    }

    const { found, value } = editableValueAt(
      config,
      widget.property,
    );
    if (!found) return 'invalid-widgets';

    switch (widget.type) {
      case 'slider':
        if (
          !Number.isFinite(value) ||
          !Number.isFinite(widget.min) ||
          !Number.isFinite(widget.max) ||
          (widget.min as number) >= (widget.max as number) ||
          (widget.step !== undefined &&
            (!Number.isFinite(widget.step) ||
              (widget.step as number) <= 0))
        ) {
          return 'invalid-widgets';
        }
        break;
      case 'checkbox':
        if (typeof value !== 'boolean') return 'invalid-widgets';
        break;
      case 'textInput':
        if (typeof value !== 'string') return 'invalid-widgets';
        break;
      case 'dropdown':
        if (
          typeof value !== 'string' ||
          !Array.isArray(widget.options) ||
          widget.options.length === 0 ||
          !widget.options.every(
            (option: unknown) => typeof option === 'string',
          ) ||
          !widget.options.includes(value)
        ) {
          return 'invalid-widgets';
        }
        break;
      case 'color': {
        if (typeof value !== 'string') return 'invalid-widgets';
        // A color widget converts through RGB/HCL. A mere string (or the
        // special transparent color with NaN RGB channels) is not usable.
        const rgb = color(value)?.rgb();
        if (
          !rgb ||
          !Number.isFinite(rgb.r) ||
          !Number.isFinite(rgb.g) ||
          !Number.isFinite(rgb.b)
        ) {
          return 'invalid-widgets';
        }
        break;
      }
      default:
        return 'invalid-widgets';
    }
  }

  return null;
}
