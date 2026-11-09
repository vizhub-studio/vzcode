import React, { useEffect, useState } from 'react';
import { calculatePercentage } from './utils';

interface SliderWidgetProps {
  property: string;
  label: string;
  min: number;
  max: number;
  step?: number;
  currentValue: number;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onNumberChange: (value: number) => void;
}

export const SliderWidget: React.FC<SliderWidgetProps> = ({
  property, label, min, max, step = 1, currentValue, onChange, onNumberChange,
}) => {
  const [draft, setDraft] = useState(String(currentValue));
  useEffect(() => setDraft(String(currentValue)), [currentValue]);
  const percent = Math.max(0, Math.min(100, calculatePercentage(currentValue, min, max)));

  const commitNumber = () => {
    const parsed = Number(draft);
    if (draft.trim() === '' || !Number.isFinite(parsed)) {
      setDraft(String(currentValue));
      return;
    }
    const clamped = Math.max(min, Math.min(max, parsed));
    onNumberChange(clamped);
    setDraft(String(clamped));
  };

  return (
    <div className="visual-editor-slider">
      <div className="slider-header">
        <label htmlFor={property} className="slider-label">{label}</label>
        <input
          type="number"
          className="slider-number-input"
          aria-label={`${label} value`}
          min={min}
          max={max}
          step={step}
          value={draft}
          onChange={(event) => setDraft(event.currentTarget.value)}
          onBlur={commitNumber}
          onKeyDown={(event) => {
            if (event.key === 'Enter') { commitNumber(); event.currentTarget.blur(); }
            if (event.key === 'Escape') setDraft(String(currentValue));
          }}
        />
      </div>
      <div className="slider-container">
        <input
          type="range"
          id={property}
          aria-label={label}
          className="slider-input"
          min={min} max={max} step={step}
          value={currentValue}
          onChange={onChange}
        />
        <div className="slider-track-fill" style={{ width: `${percent}%` }} />
      </div>
      <div className="slider-bounds">
        <span className="min-value">{min}</span>
        <span className="max-value">{max}</span>
      </div>
    </div>
  );
};
