import type { VisualEditorEmptyReason } from '../../../types';

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
  if (!config || typeof config !== 'object' || Array.isArray(config))
    return 'invalid-config';
  if (!('visualEditorWidgets' in config)) return 'missing-widgets';
  const widgets = (config as { visualEditorWidgets: unknown }).visualEditorWidgets;
  if (!Array.isArray(widgets)) return 'invalid-widgets';
  if (!widgets.length) return 'empty-widgets';
  for (const w of widgets) {
    if (!w || typeof w !== 'object' ||
      typeof w.property !== 'string' || !w.property ||
      typeof w.label !== 'string' || !w.label) return 'invalid-widgets';
    if (w.type === 'slider') {
      if (!Number.isFinite(w.min) || !Number.isFinite(w.max) ||
        w.min >= w.max || (w.step !== undefined && !(w.step > 0)))
        return 'invalid-widgets';
    } else if (w.type === 'dropdown') {
      if (!Array.isArray(w.options) || !w.options.length ||
        !w.options.every((o: unknown) => typeof o === 'string'))
        return 'invalid-widgets';
    } else if (!['checkbox', 'textInput', 'color'].includes(w.type)) {
      return 'invalid-widgets';
    }
  }
  return null;
}
