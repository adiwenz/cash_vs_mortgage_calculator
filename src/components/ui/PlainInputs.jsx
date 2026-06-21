import { useState } from 'react';
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

export function formatBudgetCurrency(val) {
  if (val === null || val === undefined || isNaN(val) || val === '') return '';
  const numVal = Number(val);
  const rounded = Math.round(numVal * 100) / 100;
  const hasCents = rounded % 1 !== 0;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: hasCents ? 2 : 0,
    maximumFractionDigits: hasCents ? 2 : 0
  }).format(rounded);
}

export const formatBudgetNumber = (val) => {
  if (val === null || val === undefined || isNaN(val) || val === '') return '';
  const numVal = Number(val);
  const rounded = Math.round(numVal * 100) / 100;
  const hasCents = rounded % 1 !== 0;
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: hasCents ? 2 : 0,
    maximumFractionDigits: hasCents ? 2 : 0
  }).format(rounded);
};

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
  const [prevValue, setPrevValue] = useState(value);
  const [isPasting, setIsPasting] = useState(false);

  if (value !== prevValue) {
    setPrevValue(value);
    if (!isEditing) {
      setLocalValue(value === null || value === undefined ? '' : String(value));
    } else {
      const parsedLocal = parseFloat(parseRawString(localValue));
      const parsedValue = parseFloat(value);
      if (!isNaN(parsedValue) && parsedValue !== parsedLocal) {
        setLocalValue(value === null || value === undefined ? '' : String(value));
      }
    }
  }

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
      const rounded = Math.round(parsedNum * 100) / 100;
      if (rounded % 1 === 0) {
        rawStr = rounded.toString();
      } else {
        rawStr = rounded.toFixed(2);
      }
    } else {
      rawStr = '';
    }
    setLocalValue(rawStr);
    if (onChange) {
      onChange(makeFakeEvent(rawStr, props.name));
    }
    if (props.onBlur) {
      props.onBlur(e);
    }
  };

  const handleChange = (e) => {
    const val = e.target.value;
    
    // Allow digits, a single decimal point, and at most 2 digits after the decimal point
    const isValidPattern = /^-?\d*\.?\d*$/.test(val);
    if (!isValidPattern) return;

    const hasThreeOrMoreDecimals = /\.\d{3,}$/.test(val);
    const prevHasTwoDecimals = /\.\d{2}$/.test(localValue);
    const isLengthDiffOne = Math.abs(val.length - localValue.length) === 1;
    const isTyping = isLengthDiffOne && prevHasTwoDecimals;

    if (hasThreeOrMoreDecimals && isTyping && !isPasting) {
      return;
    }

    setLocalValue(val);
    const parsed = parseRawString(val);
    if (onChange) {
      onChange(makeFakeEvent(parsed, props.name));
    }
  };

  const handlePaste = () => {
    setIsPasting(true);
    setTimeout(() => setIsPasting(false), 0);
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
        : formatBudgetCurrency(value));

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
      onPaste={handlePaste}
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
  const [prevValue, setPrevValue] = useState(value);

  if (value !== prevValue) {
    setPrevValue(value);
    if (!isEditing) {
      setLocalValue(value === null || value === undefined ? '' : String(value));
    } else {
      const parsedLocal = parseFloat(parseRawString(localValue));
      const parsedValue = parseFloat(value);
      if (!isNaN(parsedValue) && parsedValue !== parsedLocal) {
        setLocalValue(value === null || value === undefined ? '' : String(value));
      }
    }
  }

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
  const [prevValue, setPrevValue] = useState(value);
  const [isPasting, setIsPasting] = useState(false);

  if (value !== prevValue) {
    setPrevValue(value);
    if (!isEditing) {
      setLocalValue(value === null || value === undefined ? '' : String(value));
    } else {
      const parsedLocal = parseFloat(parseRawString(localValue));
      const parsedValue = parseFloat(value);
      if (!isNaN(parsedValue) && parsedValue !== parsedLocal) {
        setLocalValue(value === null || value === undefined ? '' : String(value));
      }
    }
  }

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
      const rounded = Math.round(parsedNum * 100) / 100;
      if (rounded % 1 === 0) {
        rawStr = rounded.toString();
      } else {
        rawStr = rounded.toFixed(2);
      }
    } else {
      rawStr = '';
    }
    setLocalValue(rawStr);
    if (onChange) {
      onChange(makeFakeEvent(rawStr, props.name));
    }
    if (props.onBlur) {
      props.onBlur(e);
    }
  };

  const handleChange = (e) => {
    const val = e.target.value;
    
    // Allow digits, a single decimal point, and at most 2 digits after the decimal point
    const isValidPattern = /^-?\d*\.?\d*$/.test(val);
    if (!isValidPattern) return;

    const hasThreeOrMoreDecimals = /\.\d{3,}$/.test(val);
    const prevHasTwoDecimals = /\.\d{2}$/.test(localValue);
    const isLengthDiffOne = Math.abs(val.length - localValue.length) === 1;
    const isTyping = isLengthDiffOne && prevHasTwoDecimals;

    if (hasThreeOrMoreDecimals && isTyping && !isPasting) {
      return;
    }

    setLocalValue(val);
    const parsed = parseRawString(val);
    if (onChange) {
      onChange(makeFakeEvent(parsed, props.name));
    }
  };

  const handlePaste = () => {
    setIsPasting(true);
    setTimeout(() => setIsPasting(false), 0);
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
        : formatBudgetNumber(value));

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
      onPaste={handlePaste}
      onKeyDown={handleKeyDown}
    />
  );
}
