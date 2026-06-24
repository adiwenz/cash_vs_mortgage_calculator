import React from 'react';

export default function FormRow({
  label,
  htmlFor,
  error,
  helperText,
  children,
  style,
  ...props
}) {
  const helperId = htmlFor ? `${htmlFor}-helper` : undefined;
  const errorId = htmlFor ? `${htmlFor}-error` : undefined;
  const describedBy = [
    error ? errorId : null,
    helperText ? helperId : null
  ].filter(Boolean).join(' ') || undefined;

  const renderChildren = () => {
    if (React.isValidElement(children)) {
      return React.cloneElement(children, {
        id: children.props.id || htmlFor,
        'aria-describedby': describedBy
      });
    }
    return children;
  };

  return (
    <div
      className={`form-row-container ${error ? 'has-error' : ''}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '0.35rem',
        ...style
      }}
      {...props}
    >
      {label && (
        <label
          htmlFor={htmlFor}
          className="form-row-label"
          style={{
            textAlign: 'left',
            fontSize: '0.875rem',
            fontWeight: '600',
            color: error ? 'var(--danger, #dc2626)' : 'var(--text-primary, #1f2937)'
          }}
        >
          {label}
        </label>
      )}

      {renderChildren()}

      {error && (
        <span
          id={errorId}
          className="form-row-error"
          role="alert"
          style={{
            fontSize: '0.75rem',
            color: 'var(--danger, #dc2626)',
            textAlign: 'left',
            display: 'block'
          }}
        >
          {error}
        </span>
      )}

      {helperText && (
        <span
          id={helperId}
          className="form-row-helper"
          style={{
            fontSize: '0.72rem',
            color: 'var(--text-secondary, #64748b)',
            textAlign: 'left',
            display: 'block',
            lineHeight: '1.3'
          }}
        >
          {helperText}
        </span>
      )}
    </div>
  );
}
