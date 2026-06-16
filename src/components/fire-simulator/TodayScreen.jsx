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
  setActiveStep
}) {
  const simpleSavingsRate = useMemo(() => {
    const income = Number(inputs.simpleIncome) || 0;
    const expenses = Number(inputs.simpleExpenses) || 0;
    if (income <= 0) return 0;
    return Math.round(((income - expenses) / income) * 100);
  }, [inputs.simpleIncome, inputs.simpleExpenses]);

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
              <span className="input-name" style={{ fontSize: '1.05rem', margin: 0, color: 'var(--text-secondary)', fontWeight: '600' }}>Life Expectancy</span>
              <input
                type="number"
                className="input-number-box"
                style={{ width: '160px', textAlign: 'right', fontSize: '1.2rem', padding: '0.45rem 0.65rem' }}
                value={inputs.lifeExpectancy}
                placeholder="e.g. 85"
                onChange={(e) => handleStep1Change('lifeExpectancy', parseInt(e.target.value) || 0)}
              />
            </div>
            <span className="input-desc" style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', textAlign: 'left', paddingLeft: '0.1rem' }}>
              Age you expect to live to (e.g. 85)
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

      {/* Immediate Value Display Progress Board */}
      <div className="progress-board-card" style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem', padding: '1.25rem 1.5rem', height: 'auto' }}>
        <div>
          <h3 style={{ fontSize: '1.3rem', fontWeight: '800', margin: 0, color: 'var(--text-primary)' }}>Your Financial Snapshot</h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0.15rem 0 0 0' }}>
            Your current starting point parameters:
          </p>
        </div>

        {/* Positive Metrics Deck */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', width: '100%' }}>
          <div style={{ background: 'rgba(255,255,255,0.015)', padding: '0.45rem 0.6rem', borderRadius: '8px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '0.68rem', textTransform: 'uppercase', color: 'var(--text-tertiary)', fontWeight: '700', marginBottom: '0.12rem' }}>
              Annual Income
            </span>
            <span style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--text-primary)', lineHeight: '1.15' }}>
              {formatCurrency(inputs.simpleIncome)}
            </span>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.015)', padding: '0.45rem 0.6rem', borderRadius: '8px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '0.68rem', textTransform: 'uppercase', color: 'var(--text-tertiary)', fontWeight: '700', marginBottom: '0.12rem' }}>
              Pre-Tax Savings Rate
            </span>
            <span style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--primary)', lineHeight: '1.15' }}>
              {simpleSavingsRate}%
            </span>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.015)', padding: '0.45rem 0.6rem', borderRadius: '8px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '0.68rem', textTransform: 'uppercase', color: 'var(--text-tertiary)', fontWeight: '700', marginBottom: '0.12rem' }}>
              Annual Surplus
            </span>
            <span style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--accent-emerald)', lineHeight: '1.15' }}>
              {formatCurrency(Math.max(0, inputs.simpleIncome - inputs.simpleExpenses))}
            </span>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.015)', padding: '0.45rem 0.6rem', borderRadius: '8px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '0.68rem', textTransform: 'uppercase', color: 'var(--text-tertiary)', fontWeight: '700', marginBottom: '0.12rem' }}>
              Today's Assets
            </span>
            <span style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--accent-emerald, #10b981)', lineHeight: '1.15' }}>
              {formatCurrency(todayAssets)}
            </span>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.015)', padding: '0.45rem 0.6rem', borderRadius: '8px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '0.68rem', textTransform: 'uppercase', color: 'var(--text-tertiary)', fontWeight: '700', marginBottom: '0.12rem' }}>
              Today's Debt
            </span>
            <span style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--accent-rose, #f43f5e)', lineHeight: '1.15' }}>
              {formatCurrency(todayDebt)}
            </span>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.015)', padding: '0.45rem 0.6rem', borderRadius: '8px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gridColumn: 'span 2' }}>
            <span style={{ fontSize: '0.68rem', textTransform: 'uppercase', color: 'var(--text-tertiary)', fontWeight: '700', marginBottom: '0.12rem' }}>
              Today's Net Worth
            </span>
            <span style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--primary)', lineHeight: '1.15' }}>
              {formatCurrency(todayNetWorth)}
            </span>
          </div>
        </div>

        {/* Encouraging Insights */}
        <div style={{ background: 'rgba(59, 130, 246, 0.05)', border: '1px solid rgba(59, 130, 246, 0.15)', borderRadius: '8px', padding: '0.6rem 0.8rem', display: 'flex', flexDirection: 'column', gap: '0.35rem', textAlign: 'left' }}>
          <span style={{ fontSize: '0.82rem', fontWeight: '700', color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Starting Point Insights
          </span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'flex-start' }}>
              <span>💡</span>
              <span>
                {simpleSavingsRate >= 15 
                  ? `Strong Start: You are currently saving ${simpleSavingsRate}% of your income pre-tax.`
                  : simpleSavingsRate > 0
                    ? `Good Start: You are currently saving ${simpleSavingsRate}% of your income pre-tax.`
                    : `Action Plan: Try adjusting your spending to create a surplus and start saving.`}
              </span>
            </div>
            {inputs.simpleIncome - inputs.simpleExpenses > 0 && (
              <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'flex-start' }}>
                <span>🌱</span>
                <span>
                  {`Annual Investing: You have ${formatCurrency(inputs.simpleIncome - inputs.simpleExpenses)}/yr to build wealth.`}
                </span>
              </div>
            )}
            <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'flex-start' }}>
              <span>✨</span>
              <span>
                {`Current Status: This is your starting point. Life choices can change your timeline.`}
              </span>
            </div>
          </div>
        </div>

        {/* Next Step CTA */}
        <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.45rem', marginTop: 'auto', width: '100%' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Next Step
            </span>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Now let’s see how future life choices affect your path.
            </span>
          </div>
          <button
            type="button"
            className="btn-primary"
            style={{ width: '100%', padding: '0.65rem', fontSize: '1.05rem', fontWeight: '700', borderRadius: '8px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-hover) 100%)', boxShadow: '0 4px 15px rgba(59, 130, 246, 0.3)' }}
            onClick={() => {
              setActiveStep(2);
            }}
          >
            Build My Life Plan →
          </button>
        </div>
      </div>
    </div>
  );
}
