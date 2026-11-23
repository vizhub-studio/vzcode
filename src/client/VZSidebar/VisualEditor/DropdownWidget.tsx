import React from 'react';

interface DropdownWidgetProps {
  property: string;
  label: string;
  options: string[];
  currentValue: string;
  onChange: (value: string) => void;
}

/** Native select preserves keyboard, touch, type-ahead and screen-reader behavior. */
export const DropdownWidget: React.FC<DropdownWidgetProps> = ({
  property, label, options, currentValue, onChange,
}) => (
  <div className="visual-editor-dropdown">
    <div className="dropdown-header">
      <label htmlFor={property} className="dropdown-label">{label}</label>
    </div>
    <select
      id={property}
      className="visual-properties-select"
      value={currentValue}
      onChange={(event) => onChange(event.currentTarget.value)}
    >
      {options.map((option) => <option key={option} value={option}>{option}</option>)}
    </select>
  </div>
);
