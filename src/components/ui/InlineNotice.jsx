import React from 'react';

export default function InlineNotice({
  message,
  type = 'info',
  title,
  style,
  ...props
}) {
  const getColors = () => {
    switch (type) {
      case 'success':
        return {
          border: 'var(--success, #16a34a)',
          bg: 'var(--success-light, rgba(22, 163, 74, 0.08))',
          text: 'var(--text-primary, #1f2937)',
          iconColor: 'var(--success, #16a34a)'
        };
      case 'warning':
        return {
          border: 'var(--warning, #f59e0b)',
          bg: 'var(--warning-light, rgba(245, 158, 11, 0.08))',
          text: 'var(--text-primary, #1f2937)',
          iconColor: 'var(--warning, #f59e0b)'
        };
      case 'error':
        return {
          border: 'var(--danger, #dc2626)',
          bg: 'var(--danger-light, rgba(220, 38, 38, 0.08))',
          text: 'var(--text-primary, #1f2937)',
          iconColor: 'var(--danger, #dc2626)'
        };
      case 'info':
      default:
        return {
          border: 'var(--secondary, #1e3a5f)',
          bg: 'var(--secondary-light, rgba(30, 58, 95, 0.08))',
          text: 'var(--text-primary, #1f2937)',
          iconColor: 'var(--secondary, #1e3a5f)'
        };
    }
  };

  const colors = getColors();

  const getIcon = () => {
    switch (type) {
      case 'success': return '✓';
      case 'warning': return '⚠';
      case 'error': return '✕';
      case 'info':
      default:
        return 'ℹ';
    }
  };

  return (
    <div
      className={`inline-notice inline-notice-${type}`}
      style={{
        display: 'flex',
        gap: '0.75rem',
        padding: '1rem',
        borderRadius: 'var(--radius-md, 14px)',
        borderLeft: `4px solid ${colors.border}`,
        backgroundColor: colors.bg,
        color: colors.text,
        textAlign: 'left',
        ...style
      }}
      {...props}
    >
      <span style={{ fontWeight: 'bold', color: colors.iconColor, fontSize: '1.1rem', lineHeight: 1.1 }}>
        {getIcon()}
      </span>
      <div style={{ flex: 1 }}>
        {title && (
          <div style={{ fontWeight: '700', fontSize: '0.875rem', marginBottom: '0.2rem' }}>
            {title}
          </div>
        )}
        <div style={{ fontSize: '0.8rem', lineHeight: '1.4' }}>
          {message}
        </div>
      </div>
    </div>
  );
}
