import React from 'react';

interface CheckboxWidgetProps {
  property: string;
  label: string;
  currentValue: boolean;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

export const CheckboxWidget: React.FC<CheckboxWidgetProps> = ({
  property, label, currentValue, onChange,
}) => (
  <div className="visual-editor-checkbox">
    <div className="checkbox-header">
      <label htmlFor={property} className="checkbox-label">{label}</label>
    </div>
    <div className="checkbox-container">
      <input
        type="checkbox"
        id={property}
        className="checkbox-input"
        role="switch"
        aria-checked={currentValue}
        checked={currentValue}
        onChange={onChange}
      />
      <div className="checkbox-visual" aria-hidden="true">
        <div className={`checkbox-indicator ${currentValue ? 'checked' : ''}`} />
      </div>
    </div>
  </div>
);
