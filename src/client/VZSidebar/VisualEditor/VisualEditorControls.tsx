/** Same widget UI as VZCode's live editor, with injected persistence. */
import React, { useEffect, useMemo, useState } from 'react';
import { VisualEditorConfigEntry, VisualEditorEmptyReason } from '../../../types';
import { getVisualEditorEmptyReason } from './status';
import { getNestedProperty } from './utils';
import { SliderWidget } from './SliderWidget';
import { CheckboxWidget } from './CheckboxWidget';
import { TextInputWidget } from './TextInputWidget';
import { DropdownWidget } from './DropdownWidget';
import { ColorWidget } from './ColorWidget';
import { toHclChannels, coerceChannelNumber, hclChannelsToHex } from './colorUtils';

type EditableValue = string | number | boolean;
export interface VisualEditorControlsProps {
  /** The original VZCode config.json format; component never saves it. */
  configText: string | null;
  /** Caller decides whether to write ShareDB or update temporary review state. */
  onChange: (property: string, value: EditableValue) => void;
  renderEmptyState?: (reason: VisualEditorEmptyReason) => React.ReactNode;
}

export function VisualEditorControls({ configText, onChange, renderEmptyState }: VisualEditorControlsProps) {
  const [local, setLocal] = useState<Record<string, EditableValue>>({});
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const invalid = getVisualEditorEmptyReason(configText);
  const config = useMemo<Record<string, any> | null>(() => {
    if (!configText || getVisualEditorEmptyReason(configText)) return null;
    return JSON.parse(configText) as Record<string, any>;
  }, [configText]);
  const widgets = useMemo<VisualEditorConfigEntry[]>(() =>
    Array.isArray(config?.visualEditorWidgets) ? config.visualEditorWidgets : [], [config]);

  useEffect(() => {
    setLocal({});
    setOpenDropdown(null);
  }, [configText]);

  useEffect(() => {
    if (!openDropdown) return;
    const outside = (event: MouseEvent) => {
      if (!(event.target as Element).closest('.visual-editor-dropdown')) setOpenDropdown(null);
    };
    document.addEventListener('mousedown', outside);
    return () => document.removeEventListener('mousedown', outside);
  }, [openDropdown]);

  const value = <T extends EditableValue,>(property: string, fallback: T): T =>
    (local[property] ?? getNestedProperty<T>(config, property) ?? fallback) as T;
  const change = (property: string, next: EditableValue) => {
    setLocal((prev) => ({ ...prev, [property]: next }));
    onChange(property, next);
  };

  if (invalid) {
    const override = renderEmptyState?.(invalid);
    if (override != null) return <>{override}</>;
    return <div className="visual-editor" role="status">Visual editor is not configured ({invalid}).</div>;
  }

  return <div className="visual-editor">
    {widgets.map(widget => {
      const property = widget.property;
      if (widget.type === 'slider') return <SliderWidget
        key={property} property={property} label={widget.label}
        min={widget.min} max={widget.max} step={widget.step ?? 1}
        currentValue={value(property, widget.min)}
        onChange={event => change(property, Number(event.currentTarget.value))}
      />;
      if (widget.type === 'checkbox') return <CheckboxWidget
        key={property} property={property} label={widget.label}
        currentValue={value(property, false)}
        onChange={event => change(property, event.currentTarget.checked)}
      />;
      if (widget.type === 'textInput') return <TextInputWidget
        key={property} property={property} label={widget.label}
        currentValue={value(property, '')}
        onChange={event => change(property, event.currentTarget.value)}
      />;
      if (widget.type === 'dropdown') return <DropdownWidget
        key={property} property={property} label={widget.label}
        options={widget.options} currentValue={value(property, widget.options[0] ?? '')}
        isOpen={openDropdown === property}
        onToggle={() => setOpenDropdown(current => current === property ? null : property)}
        onOptionClick={next => { change(property, next); setOpenDropdown(null); }}
      />;
      if (widget.type === 'color') {
        const hex = value(property, '#000000');
        const channels = toHclChannels(hex);
        return <ColorWidget
          key={property} property={property} label={widget.label} currentHex={hex}
          currentH={coerceChannelNumber(local[property + '_h'], channels.h)}
          currentC={coerceChannelNumber(local[property + '_c'], channels.c)}
          currentL={coerceChannelNumber(local[property + '_l'], channels.l)}
          onColorChange={(p, channel) => event => {
            const nextChannels = {
              h: coerceChannelNumber(local[p + '_h'], channels.h),
              c: coerceChannelNumber(local[p + '_c'], channels.c),
              l: coerceChannelNumber(local[p + '_l'], channels.l),
            };
            nextChannels[channel] = Number(event.currentTarget.value);
            setLocal(prev => ({...prev, [p + '_' + channel]: nextChannels[channel]}));
            change(p, hclChannelsToHex(nextChannels, hex));
          }}
        />;
      }
      return null;
    })}
  </div>;
}
