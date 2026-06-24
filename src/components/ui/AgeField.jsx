import React, { useState } from 'react';
import FormRow from './FormRow';

export default function AgeField({
  value,
  onChange,
  min = 0,
  max = 120,
  label,
  htmlFor,
  error,
  helperText,
  style,
  containerClassName,
  ...props
}) {
  const [localValue, setLocalValue] = useState(value === null || value === undefined ? '' : String(value));
  const [prevValue, setPrevValue] = useState(value);

  if (value !== prevValue) {
    setPrevValue(value);
    setLocalValue(value === null || value === undefined ? '' : String(value));
  }

  const commitValue = (val) => {
    let num = parseInt(val, 10);
    if (isNaN(num)) {
      num = min;
    }
    const clamped = Math.min(max, Math.max(min, num));
    setLocalValue(String(clamped));
    if (onChange) {
      onChange({ target: { value: clamped } });
    }
  };

  const handleBlur = () => {
    commitValue(localValue);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      commitValue(localValue);
      e.target.blur();
    }
  };

  const handleChange = (e) => {
    const cleaned = e.target.value.replace(/\D/g, '');
    setLocalValue(cleaned);
  };

  return (
    <FormRow
      label={label}
      htmlFor={htmlFor}
      error={error}
      helperText={helperText}
      style={style}
      className={containerClassName}
    >
      <input
        id={htmlFor}
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        value={localValue}
        onChange={handleChange}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        {...props}
      />
    </FormRow>
  );
}
