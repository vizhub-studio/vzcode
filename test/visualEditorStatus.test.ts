import { describe, expect, it } from 'vitest';
import { getVisualEditorEmptyReason } from '../src/client/VZSidebar/VisualEditor/status';

describe('visual editor configuration', () => {
  it('distinguishes missing, malformed, empty, and configured visual editors', () => {
    expect(getVisualEditorEmptyReason(null)).toBe(
      'missing-config',
    );
    expect(getVisualEditorEmptyReason('{')).toBe(
      'invalid-config',
    );
    expect(getVisualEditorEmptyReason('null')).toBe(
      'invalid-config',
    );
    expect(getVisualEditorEmptyReason('{}')).toBe(
      'missing-widgets',
    );
    expect(
      getVisualEditorEmptyReason(
        '{"visualEditorWidgets":{}}',
      ),
    ).toBe('invalid-widgets');
    expect(
      getVisualEditorEmptyReason(
        '{"visualEditorWidgets":[]}',
      ),
    ).toBe('empty-widgets');
    expect(
      getVisualEditorEmptyReason(
        JSON.stringify({
          color: '#fff',
          visualEditorWidgets: [
            {
              type: 'color',
              label: 'Color',
              property: 'color',
            },
          ],
        }),
      ),
    ).toBeNull();
  });
  it('rejects unsupported widget definitions', () => {
    expect(
      getVisualEditorEmptyReason(
        JSON.stringify({
          visualEditorWidgets: [
            {
              type: 'slider',
              label: 'Radius',
              property: 'r',
              min: 10,
              max: 1,
            },
          ],
        }),
      ),
    ).toBe('invalid-widgets');
  });
});
