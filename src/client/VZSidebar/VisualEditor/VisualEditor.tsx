import {
  useCallback, useContext, useEffect, useMemo, useRef, useState,
} from 'react';
import { VZCodeContext } from '../../VZCodeContext';
import type { VizContent, VizFileId } from '@vizhub/viz-types';
import type { VisualEditorConfigEntry } from '../../../types';
import { EmptyState } from '../EmptyState';
import {
  toHclChannels, coerceChannelNumber, hclChannelsToHex,
} from './colorUtils';
import { CONFIG_FILE_NAME } from './constants';
import { getVisualEditorEmptyReason } from './status';
import { updateVisualEditorProperties, type WidgetValue } from './updateConfig';
import { SliderWidget } from './SliderWidget';
import { CheckboxWidget } from './CheckboxWidget';
import { TextInputWidget } from './TextInputWidget';
import { DropdownWidget } from './DropdownWidget';
import { SegmentedWidget } from './SegmentedWidget';
import { ColorWidget } from './ColorWidget';
import { getNestedProperty } from './utils';
import { PropertySection } from './PropertySection';

const LIVE_EDIT_INTERVAL_MS = 75;

export const VisualEditor = () => {
  const { files, submitOperation, renderVisualEditorEmptyState } =
    useContext(VZCodeContext);
  const [localValues, setLocalValues] = useState<Record<string, WidgetValue>>({});
  const pendingRef = useRef<Record<string, WidgetValue>>({});
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  let configFileId: VizFileId | null = null;
  if (files) {
    for (const fileId in files) {
      if (files[fileId].name === CONFIG_FILE_NAME) {
        configFileId = fileId;
        break;
      }
    }
  }

  const configData = useMemo(() => {
    if (!files || !configFileId) return null;
    try {
      const parsed: unknown = JSON.parse(files[configFileId].text);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : null;
    } catch { return null; }
  }, [configFileId, files]);

  const visualEditorWidgets = useMemo(
    () => Array.isArray(configData?.visualEditorWidgets)
      ? configData.visualEditorWidgets as VisualEditorConfigEntry[]
      : [],
    [configData],
  );

  const groups = useMemo(() => {
    const grouped = new Map<string, VisualEditorConfigEntry[]>();
    for (const widget of visualEditorWidgets) {
      // Validate at render time too: invalid config must show its empty state,
      // never throw while preparing groups.
      if (!widget || typeof widget !== 'object' ||
        typeof widget.property !== 'string') continue;
      const section = typeof widget.section === 'string' && widget.section.trim()
        ? widget.section.trim()
        : 'Appearance';
      const members = grouped.get(section) ?? [];
      members.push(widget);
      grouped.set(section, members);
    }
    return [...grouped].map(([title, widgets]) => ({ title, widgets }));
  }, [visualEditorWidgets]);

  // Coalesce rapid slider/typing/color input events. Each flush reads the
  // latest ShareDB document; independent edits remain intact.
  const flushPending = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const changes = pendingRef.current;
    pendingRef.current = {};
    if (Object.keys(changes).length === 0) return;
    submitOperation((document: VizContent) =>
      updateVisualEditorProperties(document, configFileId, changes),
    );
  }, [configFileId, submitOperation]);

  // Flush a final pointer/typing change when the panel closes.
  useEffect(() => () => flushPending(), [flushPending]);

  const setWidgetValue = useCallback((
    property: string, value: WidgetValue,
    extra: Record<string, number> = {},
    continuous = false,
  ) => {
    setLocalValues((prev) => ({ ...prev, [property]: value, ...extra }));
    pendingRef.current[property] = value;
    if (continuous) {
      if (timerRef.current === null) {
        timerRef.current = setTimeout(flushPending, LIVE_EDIT_INTERVAL_MS);
      }
    } else flushPending();
  }, [flushPending]);

  const onSliderChange = useCallback(
    (property: string) => (event: React.ChangeEvent<HTMLInputElement>) =>
      setWidgetValue(property, Number(event.currentTarget.value), {}, true),
    [setWidgetValue],
  );
  const onCheckboxChange = useCallback(
    (property: string) => (event: React.ChangeEvent<HTMLInputElement>) =>
      setWidgetValue(property, event.currentTarget.checked),
    [setWidgetValue],
  );
  const onTextInputChange = useCallback(
    (property: string) => (event: React.ChangeEvent<HTMLInputElement>) =>
      setWidgetValue(property, event.currentTarget.value, {}, true),
    [setWidgetValue],
  );
  const onDropdownChange = useCallback(
    (property: string, value: string) => setWidgetValue(property, value),
    [setWidgetValue],
  );
  const onHexColorChange = useCallback(
    (property: string, value: string) => setWidgetValue(property, value),
    [setWidgetValue],
  );
  const onColorChange = useCallback(
    (property: string, component: 'l' | 'c' | 'h') =>
      (event: React.ChangeEvent<HTMLInputElement>) => {
        const fallback = getNestedProperty<string>(configData, property) ?? '#000000';
        const base = toHclChannels(fallback);
        const channels = {
          h: (localValues[`${property}_h`] as number) ?? base.h,
          c: (localValues[`${property}_c`] as number) ?? base.c,
          l: (localValues[`${property}_l`] as number) ?? base.l,
        };
        channels[component] = Number(event.currentTarget.value);
        const hex = hclChannelsToHex(channels, fallback);
        setWidgetValue(property, hex, {
          [`${property}_h`]: channels.h,
          [`${property}_c`]: channels.c,
          [`${property}_l`]: channels.l,
        }, true);
      },
    [configData, localValues, setWidgetValue],
  );

  useEffect(() => {
    const next: Record<string, WidgetValue> = {};
    for (const widget of visualEditorWidgets) {
      if (!widget || typeof widget !== 'object' ||
        typeof widget.property !== 'string') continue;
      const value = getNestedProperty<WidgetValue>(configData, widget.property);
      if (value === undefined) continue;
      next[widget.property] = value;
      if (widget.type === 'color' && typeof value === 'string') {
        const { h, c, l } = toHclChannels(value);
        next[`${widget.property}_h`] = h;
        next[`${widget.property}_c`] = c;
        next[`${widget.property}_l`] = l;
      }
    }
    // Keep locally pending input stable while a remote edit to a different
    // property arrives; settled values always converge to ShareDB.
    setLocalValues({ ...next, ...pendingRef.current });
  }, [configData, visualEditorWidgets]);

  const resetWidget = (widget: VisualEditorConfigEntry) => {
    const value = widget.defaultValue;
    if (value === undefined) return;
    if (widget.type === 'color' && typeof value === 'string') {
      const { h, c, l } = toHclChannels(value);
      setWidgetValue(widget.property, value, {
        [`${widget.property}_h`]: h,
        [`${widget.property}_c`]: c,
        [`${widget.property}_l`]: l,
      });
    } else setWidgetValue(widget.property, value);
  };

  const renderControl = (widget: VisualEditorConfigEntry) => {
    const value = localValues[widget.property] ??
      getNestedProperty<WidgetValue>(configData, widget.property);
    switch (widget.type) {
      case 'slider':
        return <SliderWidget
          property={widget.property} label={widget.label}
          min={widget.min} max={widget.max} step={widget.step}
          unit={widget.unit}
          currentValue={typeof value === 'number' ? value : widget.min}
          onChange={onSliderChange(widget.property)}
          onNumberChange={(next) => setWidgetValue(widget.property, next)}
        />;
      case 'checkbox':
        return <CheckboxWidget
          property={widget.property} label={widget.label}
          currentValue={typeof value === 'boolean' ? value : false}
          onChange={onCheckboxChange(widget.property)}
        />;
      case 'textInput':
        return <TextInputWidget
          property={widget.property} label={widget.label}
          currentValue={typeof value === 'string' ? value : ''}
          onChange={onTextInputChange(widget.property)}
        />;
      case 'dropdown':
        return <DropdownWidget
          property={widget.property} label={widget.label}
          options={widget.options} currentValue={typeof value === 'string' ? value : widget.options[0]}
          onChange={(next) => onDropdownChange(widget.property, next)}
        />;
      case 'segmented':
        return <SegmentedWidget
          label={widget.label} options={widget.options}
          currentValue={typeof value === 'string' ? value : widget.options[0]}
          onChange={(next) => onDropdownChange(widget.property, next)}
        />;
      case 'color': {
        const hex = typeof value === 'string' ? value : '#000000';
        const channels = toHclChannels(hex);
        return <ColorWidget
          property={widget.property} label={widget.label} currentHex={hex}
          currentH={coerceChannelNumber(localValues[`${widget.property}_h`], channels.h)}
          currentC={coerceChannelNumber(localValues[`${widget.property}_c`], channels.c)}
          currentL={coerceChannelNumber(localValues[`${widget.property}_l`], channels.l)}
          onColorChange={onColorChange} onHexChange={onHexColorChange}
        />;
      }
    }
  };

  const emptyReason = getVisualEditorEmptyReason(
    configFileId === null ? null : files?.[configFileId]?.text ?? null,
  );
  if (emptyReason) {
    const hostUI = renderVisualEditorEmptyState?.(emptyReason);
    if (hostUI != null) return <>{hostUI}</>;
    const messages = {
      'missing-config': 'To begin using the visual editor, create a config.json.',
      'invalid-config': 'Your config.json file is not valid JSON.',
      'missing-widgets': 'Add a visualEditorWidgets array to config.json.',
      'invalid-widgets': 'Your visualEditorWidgets configuration is invalid.',
      'empty-widgets': 'Add at least one widget to visualEditorWidgets.',
    };
    return <EmptyState>{messages[emptyReason]}</EmptyState>;
  }

  return (
    <div className="visual-editor">
      <header className="visual-properties-header">
        <div className="visual-properties-title">Visual Properties</div>
        <p className="visual-properties-hint">Changes appear in the preview automatically.</p>
      </header>
      {groups.map(({ title, widgets }) => (
        <PropertySection key={title} title={title}>
          {widgets.map((widget) => {
            const actual = localValues[widget.property] ??
              getNestedProperty<WidgetValue>(configData, widget.property);
            const resettable = widget.defaultValue !== undefined;
            return <div className="visual-properties-field" key={widget.property}>
              {renderControl(widget)}
              {(widget.description || resettable) && (
                <div className="visual-properties-field-footer">
                  {widget.description && (
                    <span className="visual-properties-description">{widget.description}</span>
                  )}
                  {resettable && (
                    <button
                      type="button" className="visual-properties-reset"
                      disabled={Object.is(actual, widget.defaultValue)}
                      aria-label={`Reset ${widget.label} to default`}
                      onClick={() => resetWidget(widget)}
                    >Reset</button>
                  )}
                </div>
              )}
            </div>;
          })}
        </PropertySection>
      ))}
    </div>
  );
};
