import React, { useEffect, useRef, useState } from 'react';
import { renderSliderBackground } from './utils';
import { normalizeOpaqueColorToHex } from './colorUtils';

const PRESETS = [
  '#6366f1', '#0891b2', '#16a34a', '#e11d48',
  '#f59e0b', '#111827', '#ffffff', '#000000',
];

interface ColorWidgetProps {
  property: string;
  label: string;
  currentHex: string;
  currentH: number;
  currentC: number;
  currentL: number;
  onColorChange: (
    property: string,
    lchComponent: 'l' | 'c' | 'h',
  ) => (event: React.ChangeEvent<HTMLInputElement>) => void;
  onHexChange: (property: string, hex: string) => void;
}

export const ColorWidget: React.FC<ColorWidgetProps> = ({
  property, label, currentHex, currentH, currentC, currentL,
  onColorChange, onHexChange,
}) => {
  const [open, setOpen] = useState(false);
  const [advanced, setAdvanced] = useState(false);
  const [draft, setDraft] = useState(currentHex);
  const root = useRef<HTMLDivElement>(null);
  const canvasRefs = useRef<Record<string, HTMLCanvasElement | null>>({});

  const normalizedHex = normalizeOpaqueColorToHex(currentHex) ?? '#000000';

  useEffect(() => { setDraft(currentHex); }, [currentHex]);
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (!open || !advanced) return;
    const channels = { h: currentH, c: currentC, l: currentL };
    for (const component of ['h', 'c', 'l'] as const) {
      renderSliderBackground(canvasRefs.current[component], component, channels);
    }
  }, [open, advanced, currentH, currentC, currentL]);

  const commitDraft = () => {
    const next = normalizeOpaqueColorToHex(draft);
    if (next) onHexChange(property, next);
    else setDraft(currentHex);
  };

  return (
    <div className="visual-editor-color" ref={root}>
      <div className="color-header">
        <label className="color-label">{label}</label>
        <button
          type="button"
          className="color-picker-trigger"
          aria-label={`Choose ${label} color`}
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          <span className="color-picker-swatch" style={{ backgroundColor: normalizedHex }} />
          <span className="color-picker-hex">{normalizedHex.toUpperCase()}</span>
          <span aria-hidden="true">▾</span>
        </button>
      </div>
      {open && (
        <div className="color-picker-popover" role="group" aria-label={`${label} color picker`}>
          <label className="color-picker-field">
            <span>Pick a color</span>
            <input
              type="color"
              className="color-picker-native"
              value={normalizedHex}
              onChange={(event) => onHexChange(property, event.currentTarget.value)}
            />
          </label>
          <label className="color-picker-field">
            <span>HEX / CSS color</span>
            <input
              className="color-picker-hex-input"
              type="text"
              spellCheck={false}
              value={draft}
              onChange={(event) => setDraft(event.currentTarget.value)}
              onBlur={commitDraft}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  commitDraft();
                  event.currentTarget.blur();
                } else if (event.key === 'Escape') {
                  setDraft(currentHex);
                }
              }}
              aria-label={`${label} hexadecimal color`}
            />
          </label>
          <div className="color-picker-preset-label">Presets</div>
          <div className="color-picker-presets">
            {PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                className="color-picker-preset"
                style={{ backgroundColor: preset }}
                aria-label={`Use color ${preset}`}
                aria-pressed={preset === normalizedHex}
                onClick={() => onHexChange(property, preset)}
              />
            ))}
          </div>
          <button
            type="button"
            className="color-picker-advanced-toggle"
            aria-expanded={advanced}
            onClick={() => setAdvanced((value) => !value)}
          >
            Advanced HCL controls {advanced ? '▴' : '▾'}
          </button>
          {advanced && (
            <div className="lch-sliders">
              {([
                ['l', 'Lightness', currentL, 100, ''],
                ['c', 'Chroma', currentC, 100, ''],
                ['h', 'Hue', currentH, 360, '°'],
              ] as const).map(([component, name, value, max, suffix]) => (
                <div key={component} className="lch-slider">
                  <div className="slider-header">
                    <label className="slider-label" htmlFor={`${property}-${component}`}>{name}</label>
                    <span className="slider-value">{Math.round(value)}{suffix}</span>
                  </div>
                  <div className="slider-container">
                    <canvas
                      ref={(canvas) => { canvasRefs.current[component] = canvas; }}
                      className="slider-bg-canvas" width={200} height={12}
                      aria-hidden="true"
                    />
                    <input
                      id={`${property}-${component}`}
                      type="range" className="slider-input" min={0} max={max} step={1}
                      value={value} onChange={onColorChange(property, component)}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
