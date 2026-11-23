import React from 'react';

interface SegmentedWidgetProps {
  label: string;
  options: string[];
  currentValue: string;
  onChange: (value: string) => void;
}

/** Small discrete sets are faster to scan as a compact row than a menu. */
export const SegmentedWidget: React.FC<SegmentedWidgetProps> = ({
  label, options, currentValue, onChange,
}) => (
  <div className="visual-editor-segmented">
    <div className="segmented-label">{label}</div>
    <div className="segmented-options" role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={option}
          type="button"
          className="segmented-option"
          aria-pressed={currentValue === option}
          onClick={() => onChange(option)}
        >
          {option}
        </button>
      ))}
    </div>
  </div>
);
