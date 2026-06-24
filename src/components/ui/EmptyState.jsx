import React from 'react';

export default function EmptyState({
  title,
  description,
  icon,
  action,
  style,
  ...props
}) {
  return (
    <div
      className="empty-state-container"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2.5rem 1.5rem',
        textAlign: 'center',
        backgroundColor: 'var(--bg-secondary, #ffffff)',
        borderRadius: 'var(--radius-lg, 20px)',
        border: '1px dashed var(--border, #e5e7eb)',
        color: 'var(--text-primary, #1f2937)',
        ...style
      }}
      {...props}
    >
      {icon && (
        <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem', lineHeight: 1 }}>
          {icon}
        </div>
      )}
      <h4 style={{ fontSize: '1.1rem', fontWeight: '700', margin: '0 0 0.35rem 0', color: 'var(--text-primary, #0f172a)' }}>
        {title}
      </h4>
      {description && (
        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary, #6b7280)', margin: '0 0 1.25rem 0', maxWidth: '320px', lineHeight: '1.4' }}>
          {description}
        </p>
      )}
      {action && (
        <div className="empty-state-action">
          {action}
        </div>
      )}
    </div>
  );
}
