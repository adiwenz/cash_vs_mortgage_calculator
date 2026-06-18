import React from 'react';

export default function MobileWorkOptionalHero({
  workOptionalAge,
  trackPercent,
  isPlanOnTrack
}) {
  return (
    <div className="mobile-work-optional-hero" style={{ textAlign: 'center', padding: '1.25rem 0 0.75rem 0' }}>
      <h2 style={{ 
        fontFamily: 'var(--font-heading)', 
        fontSize: '1.4rem', 
        fontWeight: '800', 
        color: '#ffffff', 
        marginBottom: '0.15rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.35rem'
      }}>
        Can Stop Working Age <span style={{ color: '#fbbf24' }}>✨</span>
      </h2>
      <p style={{ 
        fontSize: '0.8rem', 
        color: 'var(--text-secondary)', 
        marginBottom: '0.75rem' 
      }}>
        Your freedom, on your terms.
      </p>
      
      {/* Huge age metric */}
      <div style={{ 
        fontSize: '5.5rem', 
        fontWeight: '900', 
        fontFamily: 'var(--font-heading)',
        background: 'linear-gradient(135deg, #3b82f6 30%, #10b981 100%)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        lineHeight: '1',
        letterSpacing: '-0.02em',
        margin: '0.25rem 0'
      }}>
        {workOptionalAge || 'N/A'}
      </div>

      <div style={{ 
        fontSize: '0.85rem', 
        color: 'var(--text-secondary)', 
        marginBottom: '0.75rem',
        fontWeight: '500'
      }}>
        Based on your current plan
      </div>

      {/* Status Pill */}
      <div style={{ display: 'inline-flex', justifyContent: 'center', marginBottom: '1rem' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.4rem',
          padding: '0.4rem 1rem',
          borderRadius: '999px',
          fontSize: '0.75rem',
          fontWeight: '700',
          background: isPlanOnTrack ? 'rgba(16, 185, 129, 0.12)' : 'rgba(245, 158, 11, 0.12)',
          border: isPlanOnTrack ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(245, 158, 11, 0.3)',
          color: isPlanOnTrack ? 'var(--accent-emerald)' : 'var(--accent-amber)',
          boxShadow: isPlanOnTrack ? '0 0 12px rgba(16, 185, 129, 0.1)' : '0 0 12px rgba(245, 158, 11, 0.1)'
        }}>
          {isPlanOnTrack ? (
            <>
              <span>✓</span> On Track to Stop Working
            </>
          ) : (
            <>
              <span>⚠</span> Needs Adjustments
            </>
          )}
        </div>
      </div>
    </div>
  );
}
