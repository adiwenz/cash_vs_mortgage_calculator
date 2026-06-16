import { useMemo } from 'react';
import { formatCurrency } from './helpers';

export default function TodayScreen({
  inputs,
  handleStep1Change,
  handleSetBudgetClick,
  handleOpenSavingsDetails,
  lastNonZeroSavingsRateRef,
  todayAssets,
  todayDebt,
  todayNetWorth,
  setActiveStep,
  displayedResults
}) {
  const simpleSavingsRate = useMemo(() => {
    const income = Number(inputs.simpleIncome) || 0;
    const expenses = Number(inputs.simpleExpenses) || 0;
    if (income <= 0) return 0;
    return Math.round(((income - expenses) / income) * 100);
  }, [inputs.simpleIncome, inputs.simpleExpenses]);

  const hasUserEvents = useMemo(() => {
    const list = inputs.lifeEvents || [];
    const excludedTypes = ['socialSecurity', 'retire'];
    return list.some(e => e.enabled && !excludedTypes.includes(e.type));
  }, [inputs.lifeEvents]);

  return (
    <div className="today-screen-layout" style={{ alignItems: 'stretch' }}>
      {/* Inputs Grid */}
      <div className="glass-card" style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column' }}>
        <h2 className="card-title" style={{ fontSize: '1.3rem', marginBottom: '0.25rem' }}>Your Life Today</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1.0rem', lineHeight: '1.45' }}>
          Let's estimate your path to financial independence. Fill in your current numbers to see your baseline projection instantly.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
            <div className="input-wrapper" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: '1.5rem' }}>
              <span className="input-name" style={{ fontSize: '1.05rem', margin: 0, color: 'var(--text-secondary)', fontWeight: '600' }}>Current Age</span>
              <input
                type="number"
                className="input-number-box"
                style={{ width: '160px', textAlign: 'right', fontSize: '1.2rem', padding: '0.45rem 0.65rem' }}
                value={inputs.currentAge}
                placeholder="e.g. 35"
                onChange={(e) => handleStep1Change('currentAge', parseInt(e.target.value) || 0)}
              />
            </div>
            <span className="input-desc" style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', textAlign: 'left', paddingLeft: '0.1rem' }}>
              Your current age today (e.g. 35)
            </span>
          </div>



          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
            <div className="input-wrapper" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: '1.5rem' }}>
              <span className="input-name" style={{ fontSize: '1.05rem', margin: 0, color: 'var(--text-secondary)', fontWeight: '600' }}>Annual Income ($)</span>
              <input
                type="number"
                className="input-number-box"
                style={{ width: '160px', textAlign: 'right', fontSize: '1.2rem', padding: '0.45rem 0.65rem' }}
                value={inputs.simpleIncome}
                placeholder="e.g. 120000"
                onChange={(e) => handleStep1Change('simpleIncome', parseFloat(e.target.value) || 0)}
              />
            </div>
            <span className="input-desc" style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', textAlign: 'left', paddingLeft: '0.1rem' }}>
              Your total yearly gross income (e.g. $120,000)
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
            <div className="input-wrapper" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span className="input-name" style={{ fontSize: '1.05rem', margin: 0, color: 'var(--text-secondary)', fontWeight: '600' }}>Pre-Tax Savings Rate (%)</span>
                <button
                  type="button"
                  onClick={handleSetBudgetClick}
                  className="list-builder-edit-btn"
                  style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem', height: '24px', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                >
                  📊 Calculate from budget
                </button>
              </div>
              <input
                type="number"
                min="0"
                max="100"
                className="input-number-box"
                style={{ width: '160px', textAlign: 'right', fontSize: '1.2rem', padding: '0.45rem 0.65rem' }}
                value={simpleSavingsRate}
                placeholder="e.g. 20"
                onChange={(e) => {
                  const rate = parseFloat(e.target.value) || 0;
                  const clampedRate = Math.min(100, Math.max(0, rate));
                  if (lastNonZeroSavingsRateRef) {
                    lastNonZeroSavingsRateRef.current = clampedRate;
                  }
                  const income = Number(inputs.simpleIncome) || 0;
                  const newExpenses = Math.round(income * (1 - clampedRate / 100));
                  handleStep1Change('simpleExpenses', newExpenses);
                }}
              />
            </div>
            <span className="input-desc" style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', textAlign: 'left', paddingLeft: '0.1rem' }}>
              Percent of income saved pre-tax (e.g. 20%)
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
            <div className="input-wrapper" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span className="input-name" style={{ fontSize: '1.05rem', margin: 0, color: 'var(--text-secondary)', fontWeight: '600' }}>Current Savings ($)</span>
                <button
                  type="button"
                  onClick={handleOpenSavingsDetails}
                  className="list-builder-edit-btn"
                  style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem', height: '24px', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                >
                  ✏️ Details
                </button>
              </div>
              <input
                type="number"
                className="input-number-box"
                style={{ width: '160px', textAlign: 'right', fontSize: '1.2rem', padding: '0.45rem 0.65rem' }}
                value={inputs.simpleInvestments}
                placeholder="e.g. 250000"
                onChange={(e) => handleStep1Change('simpleInvestments', parseFloat(e.target.value) || 0)}
              />
            </div>
            <span className="input-desc" style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', textAlign: 'left', paddingLeft: '0.1rem' }}>
              Your total savings, retirement, and investment accounts combined (e.g. $250,000)
            </span>
          </div>
        </div>
      </div>

      {/* Right Column: Mountain Peak Concept */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', height: 'auto', flex: 1, minWidth: 0 }}>
        <div className="glass-card" style={{
          padding: '2.5rem 2.0rem',
          background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.03) 0%, rgba(147, 51, 234, 0.03) 100%)',
          border: '1px solid rgba(99, 102, 241, 0.15)',
          borderRadius: '16px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '1.5rem',
          position: 'relative',
          overflow: 'hidden',
          boxShadow: '0 8px 32px 0 rgba(99, 102, 241, 0.05)',
          textAlign: 'center',
          minHeight: '450px'
        }}>
          {/* Subtle background glow */}
          <div style={{
            position: 'absolute',
            top: '-30%',
            right: '-30%',
            width: '200px',
            height: '200px',
            borderRadius: '50%',
            background: 'var(--primary)',
            filter: 'blur(75px)',
            opacity: 0.12,
            pointerEvents: 'none'
          }} />

          {/* Mountain Peak Illustration */}
          <div style={{ display: 'flex', justifyContent: 'center', width: '100%', margin: '0 0 0.5rem 0' }}>
            <svg
              width="100%"
              height="200px"
              viewBox="0 0 320 200"
              style={{ overflow: 'visible' }}
            >
              <defs>
                <radialGradient id="mountain-glow" cx="50%" cy="30%" r="60%">
                  <stop offset="0%" stopColor="rgba(147, 51, 234, 0.25)" />
                  <stop offset="100%" stopColor="rgba(99, 102, 241, 0)" />
                </radialGradient>
                <linearGradient id="mountain-grad-left" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="rgba(99, 102, 241, 0.45)" />
                  <stop offset="100%" stopColor="rgba(79, 70, 229, 0.15)" />
                </linearGradient>
                <linearGradient id="mountain-grad-right" x1="100%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="rgba(167, 139, 250, 0.55)" />
                  <stop offset="100%" stopColor="rgba(99, 102, 241, 0.2)" />
                </linearGradient>
                <linearGradient id="back-peak-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="rgba(139, 92, 246, 0.25)" />
                  <stop offset="100%" stopColor="rgba(79, 70, 229, 0.05)" />
                </linearGradient>
                <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur stdDeviation="6" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
              </defs>

              {/* Ambient Glow behind the summit */}
              <circle cx="160" cy="50" r="100" fill="url(#mountain-glow)" />

              {/* Background Peak 1 (Left) */}
              <polygon points="20,180 90,80 160,180" fill="url(#back-peak-grad)" />

              {/* Background Peak 2 (Right) */}
              <polygon points="160,180 230,90 300,180" fill="url(#back-peak-grad)" />

              {/* Main Central Foreground Peak - Shaded Shards (Geometric look) */}
              {/* Left shaded face */}
              <polygon points="60,180 160,40 160,180" fill="url(#mountain-grad-left)" />
              {/* Right shaded face */}
              <polygon points="160,40 260,180 160,180" fill="url(#mountain-grad-right)" />

              {/* Glowing Flag / Destination Pin at the summit (160, 40) */}
              {/* Flagpole */}
              <line x1="160" y1="40" x2="160" y2="20" stroke="rgba(255, 255, 255, 0.85)" strokeWidth="1.5" />
              {/* Flag (facing right) */}
              <polygon points="160,20 174,25 160,30" fill="var(--primary)" />
              {/* Glowing Light at Flag tip */}
              <circle cx="160" cy="19" r="6" fill="rgba(167, 139, 250, 0.8)" filter="url(#glow)" />
              <circle cx="160" cy="19" r="2.5" fill="#ffffff" />
            </svg>
          </div>

          <div style={{ maxWidth: '280px', margin: '0 0 0.5rem 0' }}>
            <h3 style={{
              fontSize: '1.6rem',
              fontWeight: '800',
              margin: 0,
              color: 'var(--text-primary)',
              fontFamily: 'var(--font-heading)',
              letterSpacing: '-0.02em',
              lineHeight: '1.25'
            }}>
              Imagine Your Future
            </h3>
          </div>

          {/* Action button */}
          <button
            type="button"
            className="btn-primary"
            style={{
              width: '100%',
              maxWidth: '240px',
              padding: '0.9rem',
              fontSize: '1.05rem',
              fontWeight: '700',
              borderRadius: '10px',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              gap: '0.5rem',
              background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-hover) 100%)',
              boxShadow: '0 4px 20px rgba(99, 102, 241, 0.25)',
              border: 'none',
              cursor: 'pointer',
              color: '#fff',
              marginTop: '0.5rem'
            }}
            onClick={() => setActiveStep(2)}
          >
            {hasUserEvents ? "Continue Planning →" : "Start Planning →"}
          </button>
        </div>
      </div>
    </div>
  );
}
