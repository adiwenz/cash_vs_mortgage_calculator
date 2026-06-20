import React, { useState, useEffect } from 'react';
import formatCompactCurrency from '../../utils/formatCompactCurrency';

// Helper to format currency
export const formatCurrency = (val) => {
  if (val === null || val === undefined || isNaN(val) || val === '') return '';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  }).format(val);
};

// Helper to format percent
export const formatPercent = (val) => {
  if (val === null || val === undefined || isNaN(val) || val === '') return '';
  return `${val}%`;
};

// Helper to format general number with commas
export const formatNumber = (val) => {
  if (val === null || val === undefined || isNaN(val) || val === '') return '';
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 4
  }).format(val);
};

// Helper to parse formatting back to a raw numeric string
const parseRawString = (str) => {
  if (str === null || str === undefined) return '';
  // Strip out currency signs, commas, percent signs
  return str.toString().replace(/[^\d.-]/g, '');
};

const makeFakeEvent = (value, name) => ({
  target: {
    value: value === null || value === undefined ? '' : String(value),
    name
  }
});

export function CurrencyInput({
  value,
  onChange,
  className,
  style,
  placeholder,
  useCompact,
  ...props
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [localValue, setLocalValue] = useState('');

  // Sync with value prop if not editing
  useEffect(() => {
    if (!isEditing) {
      setLocalValue(value === null || value === undefined ? '' : String(value));
    }
  }, [value, isEditing]);

  const handleFocus = (e) => {
    setIsEditing(true);
    setLocalValue(value === null || value === undefined ? '' : String(value));
    if (props.onFocus) {
      props.onFocus(e);
    }
  };

  const handleBlur = (e) => {
    setIsEditing(false);
    const parsed = parseRawString(localValue);
    if (onChange) {
      onChange(makeFakeEvent(parsed, props.name));
    }
    if (props.onBlur) {
      props.onBlur(e);
    }
  };

  const handleChange = (e) => {
    const val = e.target.value;
    setLocalValue(val);
    const parsed = parseRawString(val);
    if (onChange) {
      onChange(makeFakeEvent(parsed, props.name));
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.target.blur();
    }
    if (props.onKeyDown) {
      props.onKeyDown(e);
    }
  };

  const displayValue = isEditing 
    ? localValue 
    : (useCompact && value !== null && value !== undefined && value !== '' && Math.abs(Number(value)) >= 1000000
        ? formatCompactCurrency(value) 
        : formatCurrency(value));

  return (
    <input
      type="text"
      className={className}
      style={style}
      placeholder={placeholder}
      {...props}
      value={displayValue}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
    />
  );
}

export function PercentInput({
  value,
  onChange,
  className,
  style,
  placeholder,
  ...props
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [localValue, setLocalValue] = useState('');

  useEffect(() => {
    if (!isEditing) {
      setLocalValue(value === null || value === undefined ? '' : String(value));
    }
  }, [value, isEditing]);

  const handleFocus = (e) => {
    setIsEditing(true);
    setLocalValue(value === null || value === undefined ? '' : String(value));
    if (props.onFocus) {
      props.onFocus(e);
    }
  };

  const handleBlur = (e) => {
    setIsEditing(false);
    let rawStr = parseRawString(localValue);
    const parsedNum = parseFloat(rawStr);
    if (Number.isFinite(parsedNum)) {
      if (props.max !== undefined && parsedNum > props.max) {
        rawStr = String(props.max);
      }
      if (props.min !== undefined && parsedNum < props.min) {
        rawStr = String(props.min);
      }
    }
    if (onChange) {
      onChange(makeFakeEvent(rawStr, props.name));
    }
    if (props.onBlur) {
      props.onBlur(e);
    }
  };

  const handleChange = (e) => {
    let val = e.target.value;
    let rawStr = parseRawString(val);
    const parsedNum = parseFloat(rawStr);
    if (Number.isFinite(parsedNum)) {
      if (props.max !== undefined && parsedNum > props.max) {
        rawStr = String(props.max);
        val = String(props.max);
      }
      if (props.min !== undefined && parsedNum < props.min) {
        rawStr = String(props.min);
        val = String(props.min);
      }
    }
    setLocalValue(val);
    if (onChange) {
      onChange(makeFakeEvent(rawStr, props.name));
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.target.blur();
    }
    if (props.onKeyDown) {
      props.onKeyDown(e);
    }
  };

  const displayValue = isEditing ? localValue : formatPercent(value);

  return (
    <input
      type="text"
      className={className}
      style={style}
      placeholder={placeholder}
      {...props}
      value={displayValue}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
    />
  );
}

export function NumberInput({
  value,
  onChange,
  className,
  style,
  placeholder,
  useCompact,
  ...props
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [localValue, setLocalValue] = useState('');

  useEffect(() => {
    if (!isEditing) {
      setLocalValue(value === null || value === undefined ? '' : String(value));
    }
  }, [value, isEditing]);

  const handleFocus = (e) => {
    setIsEditing(true);
    setLocalValue(value === null || value === undefined ? '' : String(value));
    if (props.onFocus) {
      props.onFocus(e);
    }
  };

  const handleBlur = (e) => {
    setIsEditing(false);
    const parsed = parseRawString(localValue);
    if (onChange) {
      onChange(makeFakeEvent(parsed, props.name));
    }
    if (props.onBlur) {
      props.onBlur(e);
    }
  };

  const handleChange = (e) => {
    const val = e.target.value;
    setLocalValue(val);
    const parsed = parseRawString(val);
    if (onChange) {
      onChange(makeFakeEvent(parsed, props.name));
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.target.blur();
    }
    if (props.onKeyDown) {
      props.onKeyDown(e);
    }
  };

  const displayValue = isEditing 
    ? localValue 
    : (useCompact && value !== null && value !== undefined && value !== '' && Math.abs(Number(value)) >= 1000000
        ? formatCompactCurrency(value).replace('$', '') 
        : formatNumber(value));

  return (
    <input
      type="text"
      className={className}
      style={style}
      placeholder={placeholder}
      {...props}
      value={displayValue}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
    />
  );
}
