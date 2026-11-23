import { describe, expect, it } from 'vitest';
import { updateVisualEditorProperty, updateVisualEditorProperties } from '../src/client/VZSidebar/VisualEditor/updateConfig';

describe('visual editor ShareDB updates', () => {
  const doc = {
    files: {
      config: {
        name: 'config.json',
        text: JSON.stringify({
          pointRadius: 3,
          margin: { left: 20, right: 40 },
        }),
      },
      code: { name: 'index.js', text: 'renderChart()' },
    },
  } as never;
  it('preserves concurrent property changes, siblings, and unrelated files', () => {
    const first = updateVisualEditorProperty(
      doc,
      'config',
      'margin.left',
      50,
    );
    const next = updateVisualEditorProperty(
      first,
      'config',
      'pointRadius',
      8,
    );
    expect(
      JSON.parse(next.files.config.text),
    ).toMatchObject({
      pointRadius: 8,
      margin: { left: 50, right: 40 },
    });
    expect(next.files.code.text).toBe('renderChart()');
  });
  it('batches multiple property edits while retaining the latest siblings', () => {
    const next = updateVisualEditorProperties(doc, 'config', {
      pointRadius: 7,
      'margin.left': 25,
    });
    expect(JSON.parse(next.files.config.text)).toEqual({
      pointRadius: 7, margin: { left: 25, right: 40 },
    });
    expect(next.files.code).toEqual(doc.files.code);
    expect(updateVisualEditorProperties(next, 'config', {
      pointRadius: 7,
    })).toBe(next);
  });

  it('ignores stale type changes rather than corrupting config', () => {
    expect(updateVisualEditorProperties(doc, 'config', {
      pointRadius: 'bad',
      'margin.missing': 50,
    })).toBe(doc);
  });

  it('ignores vanished, stale, unsafe or malformed config documents', () => {
    expect(
      updateVisualEditorProperty(
        doc,
        null,
        'pointRadius',
        8,
      ),
    ).toBe(doc);
    expect(
      updateVisualEditorProperty(
        doc,
        'missing',
        'pointRadius',
        8,
      ),
    ).toBe(doc);
    expect(
      updateVisualEditorProperty(
        doc,
        'config',
        '__proto__.bad',
        1,
      ),
    ).toBe(doc);
    expect(
      updateVisualEditorProperty(
        doc,
        'config',
        'margin.top',
        12,
      ),
    ).toBe(doc);
    expect(
      updateVisualEditorProperty(
        doc,
        'config',
        'pointRadius.x',
        4,
      ),
    ).toBe(doc);
  });
});
