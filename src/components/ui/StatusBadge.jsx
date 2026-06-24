import React from 'react';

export default function StatusBadge({
  label,
  type = 'neutral',
  size = 'md',
  style,
  ...props
}) {
  const getColors = () => {
    switch (type) {
      case 'success':
        return {
          bg: 'var(--success-light, rgba(22, 163, 74, 0.08))',
          text: 'var(--success, #16a34a)'
        };
      case 'warning':
        return {
          bg: 'var(--warning-light, rgba(245, 158, 11, 0.08))',
          text: 'var(--warning, #f59e0b)'
        };
      case 'danger':
        return {
          bg: 'var(--danger-light, rgba(220, 38, 38, 0.08))',
          text: 'var(--danger, #dc2626)'
        };
      case 'info':
        return {
          bg: 'var(--secondary-light, rgba(30, 58, 95, 0.08))',
          text: 'var(--secondary, #1e3a5f)'
        };
      case 'neutral':
      default:
        return {
          bg: 'var(--bg-tertiary, #f3f4f6)',
          text: 'var(--text-secondary, #6b7280)'
        };
    }
  };

  const colors = getColors();

  return (
    <span
      className={`status-badge status-badge-${type} status-badge-${size}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: size === 'sm' ? '0.15rem 0.5rem' : '0.25rem 0.75rem',
        fontSize: size === 'sm' ? '0.72rem' : '0.8rem',
        fontWeight: '700',
        borderRadius: '50px',
        backgroundColor: colors.bg,
        color: colors.text,
        lineHeight: 1,
        width: 'fit-content',
        ...style
      }}
      {...props}
    >
      {label}
    </span>
  );
}
