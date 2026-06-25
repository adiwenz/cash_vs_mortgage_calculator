import React from 'react';
import { formatCurrency } from '../helpers';
import { 
  ChevronLeft,
  ChevronRight,
  TrendingUp
} from 'lucide-react';

export default function LifeSnapshotPanel({
  isMobile,
  projection,
  snapshot,
  selectedAge,
  currentAge,
  lifeExpectancy,
  onSelectedAgeChange,
  onEditObject
}) {
  const clampSelectedAge = (age) => {
    const min = Number(currentAge);
    const max = Number(lifeExpectancy);
    const numericAge = Number(age);

    if (!Number.isFinite(numericAge)) return min;
    return Math.min(max, Math.max(min, Math.round(numericAge)));
  };

  const handleDecrementAge = () => {
    onSelectedAgeChange(clampSelectedAge(selectedAge - 1));
  };

  const handleIncrementAge = () => {
    onSelectedAgeChange(clampSelectedAge(selectedAge + 1));
  };

  const isDecrementDisabled = selectedAge <= Number(currentAge);
  const isIncrementDisabled = selectedAge >= Number(lifeExpectancy);

  // Derivations
  const relStatus = snapshot?.relationshipStatus || 'single';
  const relationshipValue = relStatus === 'married' ? 'Married' : (relStatus === 'partnered' ? 'Partnered' : 'Single');

  const properties = snapshot?.properties || [];
  const housingValue = properties.length > 0 ? `Owns (${properties[0].name})` : 'Renting';

  const childrenCount = snapshot?.children?.length || 0;
  const childrenValue = childrenCount === 0 ? 'None' : (childrenCount === 1 ? '1 Child' : `${childrenCount} Children`);

  const annualIncomeVal = snapshot?.income?.annualIncome || 0;
  const annualIncomeValue = `${formatCurrency(annualIncomeVal)} / yr`;

  const netWorthVal = snapshot?.financialSummary?.netWorth || 0;
  const netWorthValue = formatCurrency(netWorthVal);

  const debts = snapshot?.debts?.activeDebts || [];
  const totalDebtBalance = debts.reduce((sum, d) => sum + (d.balance || 0), 0);
  const debtsValue = totalDebtBalance === 0 ? 'None' : formatCurrency(totalDebtBalance);

  const rows = [
    { label: 'Relationship', icon: '❤️', value: relationshipValue },
    { label: 'Housing', icon: '🏠', value: housingValue },
    { label: 'Children', icon: '👶', value: childrenValue },
    { label: 'Annual Income', icon: '💼', value: annualIncomeValue },
    {
      label: 'Net Worth',
      icon: <TrendingUp size={16} color="#ef4444" style={{ transform: 'translateY(1px)' }} />,
      value: netWorthValue
    },
    { label: 'Debts', icon: '💸', value: debtsValue }
  ];

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      background: '#ffffff',
      border: '1px solid #e5e7eb',
      borderRadius: '16px',
      padding: '1.5rem',
      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)',
      maxWidth: '420px',
      margin: '0 auto',
      boxSizing: 'border-box'
    }}>
      {/* Header */}
      <div style={{ marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.35rem', marginBottom: '0.25rem' }}>
          <h3 style={{ fontSize: '1.25rem', fontWeight: '800', color: '#111827', margin: 0 }}>Life Snapshot</h3>
          <span style={{ fontSize: '1rem', color: '#6b7280', fontWeight: '500' }}>- {selectedAge === Number(currentAge) ? 'Today' : `Age ${selectedAge}`}</span>
        </div>
        <p style={{ fontSize: '0.85rem', color: '#6b7280', margin: 0 }}>View your life at any age.</p>
      </div>

      {/* Age Selector */}
      <div style={{ marginBottom: '1.25rem' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          border: '1px solid #e5e7eb',
          borderRadius: '12px',
          padding: '0.5rem 0.75rem',
          background: '#ffffff'
        }}>
          <button 
            type="button" 
            onClick={handleDecrementAge}
            disabled={isDecrementDisabled}
            aria-label="Previous age"
            style={{
              background: 'none',
              border: 'none',
              cursor: isDecrementDisabled ? 'not-allowed' : 'pointer',
              color: isDecrementDisabled ? '#d1d5db' : '#6b7280',
              padding: '0.25rem 0.5rem',
              display: 'flex',
              alignItems: 'center',
              fontSize: '1.2rem',
              fontWeight: 'bold',
              transition: 'opacity 0.2s'
            }}
          >
            ←
          </button>
          <span style={{ fontSize: '0.9rem', fontWeight: '700', color: '#1f2937' }}>
            Age {selectedAge} {selectedAge === Number(currentAge) ? '(Today)' : ''}
          </span>
          <button 
            type="button" 
            onClick={handleIncrementAge}
            disabled={isIncrementDisabled}
            aria-label="Next age"
            style={{
              background: 'none',
              border: 'none',
              cursor: isIncrementDisabled ? 'not-allowed' : 'pointer',
              color: isIncrementDisabled ? '#d1d5db' : '#6b7280',
              padding: '0.25rem 0.5rem',
              display: 'flex',
              alignItems: 'center',
              fontSize: '1.2rem',
              fontWeight: 'bold',
              transition: 'opacity 0.2s'
            }}
          >
            →
          </button>
        </div>
      </div>

      {/* Snapshot List Rows */}
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {rows.map((row, index) => (
          <div 
            key={row.label} 
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0.85rem 0',
              borderTop: index === 0 ? '1px solid #f3f4f6' : 'none',
              borderBottom: '1px solid #f3f4f6'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                background: '#f9fafb',
                border: '1px solid #f3f4f6',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.1rem'
              }}>
                {row.icon}
              </div>
              <span style={{ fontSize: '0.9rem', fontWeight: '600', color: '#4b5563' }}>{row.label}</span>
            </div>
            <span style={{ fontSize: '0.9rem', fontWeight: '700', color: '#111827', textAlign: 'right' }}>{row.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
