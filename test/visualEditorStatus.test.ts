import { describe, expect, it } from 'vitest';
import { getVisualEditorEmptyReason } from '../src/client/VZSidebar/VisualEditor/status';

const configWithWidget = (
  properties: Record<string, unknown>,
  widget: Record<string, unknown>,
) =>
  JSON.stringify({
    ...properties,
    visualEditorWidgets: [widget],
  });

const slider = (property: string) => ({
  type: 'slider',
  label: 'Radius',
  property,
  min: 1,
  max: 30,
});

describe('visual editor configuration', () => {
  it('distinguishes missing, malformed, and empty configurations', () => {
    expect(getVisualEditorEmptyReason(null)).toBe(
      'missing-config',
    );
    expect(getVisualEditorEmptyReason('{')).toBe(
      'invalid-config',
    );
    expect(getVisualEditorEmptyReason('null')).toBe(
      'invalid-config',
    );
    expect(getVisualEditorEmptyReason('[]')).toBe(
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
  });

  it('accepts configured controls with matching values and nested paths', () => {
    expect(
      getVisualEditorEmptyReason(
        JSON.stringify({
          radius: 17,
          enabled: false,
          title: '',
          axis: 'x',
          fill: '#1f77b4',
          margin: { left: 60 },
          visualEditorWidgets: [
            slider('radius'),
            slider('margin.left'),
            {
              type: 'checkbox',
              label: 'Enabled',
              property: 'enabled',
            },
            {
              type: 'textInput',
              label: 'Title',
              property: 'title',
            },
            {
              type: 'dropdown',
              label: 'Axis',
              property: 'axis',
              options: ['x', 'y'],
            },
            {
              type: 'color',
              label: 'Fill',
              property: 'fill',
            },
          ],
        }),
      ),
    ).toBeNull();
    expect(
      getVisualEditorEmptyReason(
        configWithWidget(
          { fill: 'black' },
          {
            type: 'color',
            label: 'Color',
            property: 'fill',
          },
        ),
      ),
    ).toBeNull();
  });

  it('rejects missing and unsafe property paths', () => {
    const properties = {
      radius: 10,
      margin: { left: 20 },
      values: [1, 2],
    };

    for (const path of [
      'missing',
      'margin.right',
      'margin.left.deep',
      'radius.deep',
      '',
      '.radius',
      'margin.',
      'margin..left',
      'values.0',
      '__proto__',
      'constructor',
      'margin.prototype',
    ]) {
      expect(
        getVisualEditorEmptyReason(
          configWithWidget(properties, slider(path)),
        ),
        path,
      ).toBe('invalid-widgets');
    }
  });

  it('rejects incompatible values for every widget type', () => {
    const incompatible = [
      { value: '17', widget: slider('value') },
      {
        value: 1,
        widget: {
          type: 'checkbox',
          label: 'Enabled',
          property: 'value',
        },
      },
      {
        value: null,
        widget: {
          type: 'textInput',
          label: 'Title',
          property: 'value',
        },
      },
      {
        value: 0,
        widget: {
          type: 'dropdown',
          label: 'Axis',
          property: 'value',
          options: ['x', 'y'],
        },
      },
      {
        value: 10,
        widget: {
          type: 'color',
          label: 'Fill',
          property: 'value',
        },
      },
      {
        value: 'not-a-css-color',
        widget: {
          type: 'color',
          label: 'Fill',
          property: 'value',
        },
      },
      {
        value: 'transparent',
        widget: {
          type: 'color',
          label: 'Fill',
          property: 'value',
        },
      },
      {
        value: 'rgba(255, 0, 0, 0.5)',
        widget: {
          type: 'color',
          label: 'Fill',
          property: 'value',
        },
      },
    ];
    for (const { value, widget } of incompatible) {
      expect(
        getVisualEditorEmptyReason(
          configWithWidget({ value }, widget),
        ),
        widget.type as string,
      ).toBe('invalid-widgets');
    }
  });

  it('rejects an unselected dropdown value and invalid control options', () => {
    const widget = {
      type: 'dropdown',
      label: 'Axis',
      property: 'axis',
      options: ['x', 'y'],
    };
    expect(
      getVisualEditorEmptyReason(
        configWithWidget({ axis: 'z' }, widget),
      ),
    ).toBe('invalid-widgets');
    expect(
      getVisualEditorEmptyReason(
        configWithWidget(
          { axis: 'x' },
          { ...widget, options: ['x', 5] },
        ),
      ),
    ).toBe('invalid-widgets');
  });

  it('rejects invalid slider bounds and steps', () => {
    for (const overrides of [
      { min: 10, max: 1 },
      { min: 1, max: 1 },
      { step: 0 },
      { step: -1 },
      { step: '1' },
      { step: null },
      { min: '0' },
    ]) {
      expect(
        getVisualEditorEmptyReason(
          configWithWidget(
            { radius: 5 },
            { ...slider('radius'), ...overrides },
          ),
        ),
      ).toBe('invalid-widgets');
    }
  });

  it('rejects unsupported widgets', () => {
    expect(
      getVisualEditorEmptyReason(
        configWithWidget(
          { radius: 5 },
          {
            type: 'unknown',
            label: 'Radius',
            property: 'radius',
          },
        ),
      ),
    ).toBe('invalid-widgets');
  });
});
