import { useState, useMemo } from 'react';
import { 
  calculateRetireSoonerOptions,
  applySaveMoreAdjustment,
  applyEarnMoreAdjustment,
  applyBalancedAdjustment,
  getNormalizedPhases
} from '../../fireCalculations.js';
import { calculateUSTaxForModal } from '../../simulatorMathUtils.js';
import { formatCurrency } from './helpers.js';

import { normalizeInputsStage } from '../../calculators/fire/pipeline/normalizeInputs.js';
import { deriveTimelineStage } from '../../calculators/fire/pipeline/deriveTimeline.js';
import { applyEventsStage } from '../../calculators/fire/pipeline/applyEvents.js';
import { deriveBudgetPhasesStage } from '../../calculators/fire/pipeline/deriveBudgetPhases.js';
import { projectYearlyBalancesStage } from '../../calculators/fire/pipeline/projectYearlyBalances.js';
import { computeReadinessStage } from '../../calculators/fire/pipeline/computeReadiness.js';
import { formatSimulationResultStage } from '../../calculators/fire/pipeline/formatSimulationResult.js';

function runSimulation(inputs) {
  const normalizedInputs = normalizeInputsStage(inputs);
  const timelineDetails = deriveTimelineStage(normalizedInputs);
  const { profile, events } = applyEventsStage(normalizedInputs, timelineDetails);
  const phases = deriveBudgetPhasesStage(profile, events, normalizedInputs.budgetDetails?.phases);
  const plannedProjection = projectYearlyBalancesStage(profile, phases, events, normalizedInputs.targetRetirementAge);
  const readinessResult = computeReadinessStage(profile, phases, events, plannedProjection);
  return formatSimulationResultStage(readinessResult, profile, phases, plannedProjection, normalizedInputs);
}

function getNetSavingsFromIncome(grossIncreaseAnnual, simpleIncome, filingStatus, includeTaxes) {
  if (!includeTaxes) return grossIncreaseAnnual;
  const oldTaxes = calculateUSTaxForModal(simpleIncome, 0, filingStatus);
  const newTaxes = calculateUSTaxForModal(simpleIncome + grossIncreaseAnnual, 0, filingStatus);
  return grossIncreaseAnnual - (newTaxes - oldTaxes);
}

const getPhaseMonthlySavings = (phase) => {
  if (!phase) return 0;
  const selfSavings = Object.values(phase.savings || {}).reduce((sum, v) => sum + (Number(v) || 0), 0);
  const partnerSavings = Object.values(phase.partnerSavings || {}).reduce((sum, v) => sum + (Number(v) || 0), 0);
  return selfSavings + partnerSavings;
};

// Module-level cache to keep target age calculations instant and clean of render-time Ref warnings
const retireSoonerCache = new Map();

export default function RetireSoonerModal({
  scenario,
  simulation,
  uiState,
  onClose
}) {
  const { inputs, setScenarios, currentScenarioId } = scenario;
  const { activeResults } = simulation;
  const { setNotification } = uiState;

  const currentWorkOptionalAge = activeResults.retirementReadyAge;
  const currentAge = Number(inputs.currentAge) || 35;

  const alreadyWorkOptional = currentWorkOptionalAge !== null && currentWorkOptionalAge <= currentAge;

  const initialTargetAge = useMemo(() => {
    if (currentWorkOptionalAge && currentWorkOptionalAge > currentAge) {
      return Math.min(85, Math.max(currentAge, currentWorkOptionalAge - 3));
    }
    return Math.min(85, Math.max(currentAge, 60));
  }, [currentWorkOptionalAge, currentAge]);

  const [targetAge, setTargetAge] = useState(initialTargetAge);

  const options = useMemo(() => {
    if (alreadyWorkOptional || targetAge >= currentWorkOptionalAge) {
      return {
        maxAvailableSavingsIncrease: 0,
        requiredSaveMoreMonthly: null,
        requiredEarnMoreAnnual: null,
        wantsReductionBalanced: 0,
        requiredBalancedIncomeAnnual: null
      };
    }

    // Construct a unique cache key based on inputs and target age
    const cacheKey = `${inputs.currentAge}-${inputs.simpleIncome}-${inputs.simpleExpenses}-${targetAge}`;
    if (retireSoonerCache.has(cacheKey)) {
      return retireSoonerCache.get(cacheKey);
    }

    const calculated = calculateRetireSoonerOptions(inputs, targetAge);
    retireSoonerCache.set(cacheKey, calculated);
    return calculated;
  }, [targetAge, inputs, currentWorkOptionalAge, alreadyWorkOptional]);

  const minAge = currentAge;
  const maxAge = 85;
  const getPct = (age) => ((age - minAge) / Math.max(1, maxAge - minAge)) * 100;

  // Compute baseline metrics
  const currentAgeVal = Number(inputs.currentAge) || 35;
  const normPhases = getNormalizedPhases(inputs);
  const currentPhase = normPhases.find(p => currentAgeVal >= p.startAge && currentAgeVal < p.endAge) || normPhases[0];
  const currentAnnualSavings = (currentPhase ? getPhaseMonthlySavings(currentPhase) : 0) * 12;
  const currentSavingsRate = Math.round((currentAnnualSavings / (Number(inputs.simpleIncome) || 1)) * 100);

  const saveMoreActive = options.requiredSaveMoreMonthly !== null && options.requiredSaveMoreMonthly <= options.maxAvailableSavingsIncrease;

  const handleApply = (optionType) => {
    let updatedInputs;
    if (optionType === 'saveMore') {
      updatedInputs = applySaveMoreAdjustment(inputs, options.requiredSaveMoreMonthly);
    } else if (optionType === 'earnMore') {
      updatedInputs = applyEarnMoreAdjustment(inputs, options.requiredEarnMoreAnnual);
    } else if (optionType === 'balanced') {
      updatedInputs = applyBalancedAdjustment(inputs, options.wantsReductionBalanced, options.requiredBalancedIncomeAnnual);
    }

    if (setScenarios) {
      setScenarios(prev => prev.map(s => {
        if (s.id !== currentScenarioId) return s;
        return { ...s, inputs: updatedInputs };
      }));
    }

    onClose();

    const testRes = runSimulation(updatedInputs);
    const newAge = testRes.retirementReadyAge || 'N/A';
    if (setNotification) {
      setNotification(`✓ Plan updated. New Work Optional Age: Age ${newAge}.`);
      setTimeout(() => setNotification(null), 4000);
    }
  };

  // SVGs for Icons
  const piggyBankIcon = (color) => (
    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 5c-1.5 0-2.8 1.4-3 3-0.1-1.6-1.5-3-3-3H5C3.3 5 2 6.3 2 8v3c0 2.2 1.8 4 4 4h1v3a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1v-3h2v3a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1v-3h1c2.2 0 4-1.8 4-4V8c0-1.7-1.3-3-3-3z"/>
      <path d="M12 5v3"/>
      <path d="M7.5 9.5h.01"/>
      <circle cx="8" cy="9.5" r="1" fill={color}/>
    </svg>
  );

  const briefcaseIcon = (color) => (
    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/>
      <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
    </svg>
  );

  const scaleIcon = (color) => (
    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="2" x2="12" y2="22"/>
      <line x1="5" y1="7" x2="19" y2="7"/>
      <path d="M5 7v3a3 3 0 0 0 6 0V7"/>
      <path d="M13 7v3a3 3 0 0 0 6 0V7"/>
    </svg>
  );

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div 
        className="event-form-overlay-card modal-content" 
        onClick={(e) => e.stopPropagation()} 
        style={{ maxWidth: '800px', width: '95%', padding: '1.75rem', borderRadius: '24px', display: 'flex', flexDirection: 'column', gap: '1.25rem', border: '1px solid var(--border-color)', background: 'var(--bg-card)' }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h2 style={{ fontSize: '1.45rem', fontWeight: '800', margin: 0, color: 'var(--text-primary)' }}>
              {alreadyWorkOptional ? 'Model a Different Age' : 'Retire Sooner'}
            </h2>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: '0.2rem 0 0 0' }}>
              {alreadyWorkOptional 
                ? 'See how different retirement ages affect your plan.' 
                : "Choose a target age and we'll show ways to get there."}
            </p>
          </div>
          <button 
            type="button" 
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '1.5rem', cursor: 'pointer', padding: '0 0.5rem', lineHeight: '1' }}
          >
            &times;
          </button>
        </div>

        {/* Current Projection Badge */}
        {currentWorkOptionalAge !== null && (
          <div style={{ display: 'flex', alignSelf: 'flex-start', alignItems: 'center', gap: '0.4rem', padding: '0.35rem 0.75rem', borderRadius: '12px', background: 'rgba(255, 255, 255, 0.04)', border: '1px solid var(--border-color)', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
            <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--text-tertiary)' }} />
            <span>Current projection: <strong>Age {currentWorkOptionalAge}</strong></span>
          </div>
        )}

        {/* Slider Block */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', gap: '0.25rem', margin: '0.5rem 0' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Target age</div>
          <div style={{ fontSize: '2.5rem', fontWeight: '900', color: 'var(--accent-emerald)', lineHeight: '1' }}>{targetAge}</div>

          {/* Slider track container */}
          <div style={{ position: 'relative', width: '100%', height: '12px', margin: '0.8rem 0 0.4rem 0' }}>
            <div style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: '4px',
              height: '4px',
              borderRadius: '2px',
              background: `linear-gradient(to right, var(--accent-emerald) 0%, var(--accent-emerald) ${getPct(targetAge)}%, var(--border-color) ${getPct(targetAge)}%, var(--border-color) 100%)`
            }} />

            {/* Current work-optional age gray marker */}
            {currentWorkOptionalAge !== null && currentWorkOptionalAge >= minAge && currentWorkOptionalAge <= maxAge && (
              <div 
                style={{
                  position: 'absolute',
                  left: `${getPct(currentWorkOptionalAge)}%`,
                  top: '0px',
                  width: '12px',
                  height: '12px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--text-tertiary, #9ca3af)',
                  transform: 'translateX(-50%)',
                  zIndex: 1
                }}
              />
            )}

            {/* Target age green thumb marker */}
            <div 
              style={{
                position: 'absolute',
                left: `${getPct(targetAge)}%`,
                top: '0px',
                width: '12px',
                height: '12px',
                borderRadius: '50%',
                backgroundColor: 'var(--accent-emerald, #10b981)',
                transform: 'translateX(-50%)',
                zIndex: 2
              }}
            />

            <input
              type="range"
              min={minAge}
              max={maxAge}
              value={targetAge}
              onChange={(e) => setTargetAge(Number(e.target.value))}
              style={{
                position: 'absolute',
                left: 0,
                width: '100%',
                top: '-4px',
                height: '20px',
                opacity: 0,
                cursor: 'pointer',
                zIndex: 3
              }}
            />
          </div>

          {/* Slider Labels */}
          <div style={{ position: 'relative', width: '100%', height: '30px' }}>
            <div style={{ position: 'absolute', left: 0, textAlign: 'left', fontSize: '0.72rem', color: 'var(--text-secondary)', lineHeight: '1.2' }}>
              <strong>{minAge}</strong>
              <div style={{ fontSize: '0.62rem', color: 'var(--text-tertiary)' }}>Current age</div>
            </div>

            {targetAge > minAge && targetAge < maxAge && (
              <div style={{ position: 'absolute', left: `${getPct(targetAge)}%`, transform: 'translateX(-50%)', textAlign: 'center', fontSize: '0.72rem', color: 'var(--accent-emerald)', fontWeight: 'bold' }}>
                <strong>{targetAge}</strong>
              </div>
            )}

            {currentWorkOptionalAge !== null && currentWorkOptionalAge > minAge && currentWorkOptionalAge < maxAge && currentWorkOptionalAge !== targetAge && (
              <div style={{ position: 'absolute', left: `${getPct(currentWorkOptionalAge)}%`, transform: 'translateX(-50%)', textAlign: 'center', fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>
                <strong>{currentWorkOptionalAge}</strong>
              </div>
            )}

            <div style={{ position: 'absolute', right: 0, textAlign: 'right', fontSize: '0.72rem', color: 'var(--text-secondary)', lineHeight: '1.2' }}>
              <strong>{maxAge}</strong>
              <div style={{ fontSize: '0.62rem', color: 'var(--text-tertiary)' }}>Life expectancy</div>
            </div>
          </div>

          {/* Slider Legend */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: '1.5rem', fontSize: '0.72rem', margin: '0.2rem 0 0 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--accent-emerald)' }} />
              <span style={{ color: 'var(--text-secondary)' }}>Selected target</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--text-tertiary)' }} />
              <span style={{ color: 'var(--text-secondary)' }}>Current projection</span>
            </div>
          </div>
        </div>

        {/* Content Block */}
        <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1.25rem' }}>
          {currentWorkOptionalAge !== null && targetAge >= currentWorkOptionalAge ? (
            <div style={{ textAlign: 'center', padding: '2rem 1rem', background: 'rgba(255,255,255,0.01)', border: '1px dashed var(--border-color)', borderRadius: '16px' }}>
              <span style={{ fontSize: '2.5rem', display: 'block', marginBottom: '0.5rem' }}>🎉</span>
              <h3 style={{ fontSize: '1.05rem', fontWeight: '800', margin: 0, color: 'var(--accent-emerald)' }}>
                You’re already on track.
              </h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '0.25rem 0 0 0' }}>
                Your current plan supports becoming work optional by Age {currentWorkOptionalAge}.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <h3 style={{ fontSize: '0.98rem', fontWeight: '800', margin: 0, color: 'var(--text-primary)' }}>
                To become work optional by <span style={{ color: 'var(--accent-emerald)' }}>{targetAge}</span>
              </h3>

              {/* Cards Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
                
                {/* 1. Save More Card */}
                <div style={{
                  background: saveMoreActive ? 'linear-gradient(to bottom, rgba(22, 163, 74, 0.02), rgba(22, 163, 74, 0.05))' : 'rgba(255, 255, 255, 0.01)',
                  border: saveMoreActive ? '1px solid rgba(22, 163, 74, 0.25)' : '1px solid var(--border-color)',
                  opacity: saveMoreActive ? 1 : 0.65,
                  borderRadius: '20px',
                  padding: '1.25rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.85rem',
                  justifyContent: 'space-between',
                  boxShadow: 'var(--shadow-sm)'
                }}>
                  <div>
                    {/* Icon & Title */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                      <div style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '12px',
                        background: saveMoreActive ? 'rgba(22, 163, 74, 0.1)' : 'rgba(255,255,255,0.05)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        {piggyBankIcon(saveMoreActive ? 'var(--accent-emerald)' : 'var(--text-secondary)')}
                      </div>
                      <div style={{ textAlign: 'left' }}>
                        <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', fontWeight: '600' }}>Save More</div>
                        <h4 style={{ fontSize: '1.05rem', fontWeight: '800', margin: 0, color: saveMoreActive ? 'var(--accent-emerald)' : 'var(--text-primary)' }}>
                          {saveMoreActive ? `+$${options.requiredSaveMoreMonthly}/mo` : 'Maxed for now'}
                        </h4>
                        {!saveMoreActive && (
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: '500', marginTop: '0.1rem' }}>
                            Up to +${options.maxAvailableSavingsIncrease}/mo available
                          </div>
                        )}
                      </div>
                    </div>

                    <div style={{ height: '1px', background: 'var(--border-color)', margin: '0.85rem 0' }} />

                    {/* Details Table */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                      <div style={{ textAlign: 'left' }}>
                        <div style={{ fontWeight: '600', color: 'var(--text-tertiary)' }}>Savings</div>
                        <div style={{ fontWeight: '700', color: 'var(--text-primary)', marginTop: '0.1rem' }}>
                          {formatCurrency(currentAnnualSavings)} &rarr; {formatCurrency(currentAnnualSavings + (saveMoreActive ? options.requiredSaveMoreMonthly : options.maxAvailableSavingsIncrease) * 12)}
                          <span style={{ fontSize: '0.62rem', color: 'var(--text-tertiary)', fontWeight: 'normal', display: 'block' }}>/yr</span>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontWeight: '600', color: 'var(--text-tertiary)' }}>Rate</div>
                        <div style={{ fontWeight: '700', color: 'var(--accent-emerald)', marginTop: '0.1rem' }}>
                          {currentSavingsRate}% &rarr; {Math.round(((currentAnnualSavings + (saveMoreActive ? options.requiredSaveMoreMonthly : options.maxAvailableSavingsIncrease) * 12) / (Number(inputs.simpleIncome) || 1)) * 100)}%
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* CTA & Helper */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.5rem' }}>
                    <button
                      type="button"
                      disabled={!saveMoreActive}
                      onClick={() => handleApply('saveMore')}
                      style={{
                        width: '100%',
                        padding: '0.55rem',
                        borderRadius: '12px',
                        border: 'none',
                        background: saveMoreActive ? 'var(--accent-emerald)' : 'rgba(255,255,255,0.06)',
                        color: saveMoreActive ? '#ffffff' : 'var(--text-secondary)',
                        fontWeight: '700',
                        fontSize: '0.8rem',
                        cursor: saveMoreActive ? 'pointer' : 'not-allowed',
                        transition: 'background var(--transition-fast)'
                      }}
                    >
                      {saveMoreActive ? 'Apply' : 'Maxed Out'}
                    </button>
                    {!saveMoreActive && (
                      <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', fontStyle: 'italic', textAlign: 'center' }}>
                        💡 Try Earn More or Balanced instead.
                      </div>
                    )}
                  </div>
                </div>

                {/* 2. Earn More Card */}
                {options.requiredEarnMoreAnnual !== null && (
                  <div style={{
                    background: 'linear-gradient(to bottom, rgba(99, 102, 241, 0.02), rgba(99, 102, 241, 0.05))',
                    border: '1px solid rgba(99, 102, 241, 0.25)',
                    borderRadius: '20px',
                    padding: '1.25rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.85rem',
                    justifyContent: 'space-between',
                    boxShadow: 'var(--shadow-sm)'
                  }}>
                    <div>
                      {/* Icon & Title */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        <div style={{
                          width: '40px',
                          height: '40px',
                          borderRadius: '12px',
                          background: 'rgba(99, 102, 241, 0.1)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}>
                          {briefcaseIcon('var(--primary)')}
                        </div>
                        <div style={{ textAlign: 'left' }}>
                          <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', fontWeight: '600' }}>Earn More</div>
                          <h4 style={{ fontSize: '1.05rem', fontWeight: '800', margin: 0, color: 'var(--primary)' }}>
                            +{formatCurrency(options.requiredEarnMoreAnnual)}
                            <span style={{ fontSize: '0.78rem', fontWeight: 'normal', color: 'var(--text-secondary)' }}> / yr</span>
                          </h4>
                        </div>
                      </div>

                      <div style={{ height: '1px', background: 'var(--border-color)', margin: '0.85rem 0' }} />

                      {/* Details */}
                      <div style={{ textAlign: 'left', fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                        <div style={{ fontWeight: '600', color: 'var(--text-tertiary)' }}>Income</div>
                        <div style={{ fontWeight: '700', color: 'var(--text-primary)', marginTop: '0.1rem' }}>
                          {formatCurrency(inputs.simpleIncome)} &rarr; {formatCurrency(inputs.simpleIncome + options.requiredEarnMoreAnnual)}
                          <span style={{ fontSize: '0.62rem', color: 'var(--text-tertiary)', fontWeight: 'normal', display: 'block' }}>/yr</span>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleApply('earnMore')}
                      style={{
                        width: '100%',
                        padding: '0.55rem',
                        borderRadius: '12px',
                        border: 'none',
                        background: 'var(--primary)',
                        color: '#ffffff',
                        fontWeight: '700',
                        fontSize: '0.8rem',
                        cursor: 'pointer',
                        marginTop: '0.5rem',
                        transition: 'background var(--transition-fast)'
                      }}
                    >
                      Apply
                    </button>
                  </div>
                )}

                {/* 3. Balanced Card */}
                {options.requiredBalancedIncomeAnnual !== null && (
                  <div style={{
                    background: 'linear-gradient(to bottom, rgba(217, 119, 6, 0.02), rgba(217, 119, 6, 0.05))',
                    border: '1px solid rgba(217, 119, 6, 0.25)',
                    borderRadius: '20px',
                    padding: '1.25rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.85rem',
                    justifyContent: 'space-between',
                    boxShadow: 'var(--shadow-sm)'
                  }}>
                    <div>
                      {/* Icon & Title */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        <div style={{
                          width: '40px',
                          height: '40px',
                          borderRadius: '12px',
                          background: 'rgba(217, 119, 6, 0.1)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}>
                          {scaleIcon('var(--warning)')}
                        </div>
                        <div style={{ textAlign: 'left' }}>
                          <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', fontWeight: '600' }}>Balanced</div>
                          {options.wantsReductionBalanced > 0 && (
                            <h4 style={{ fontSize: '0.98rem', fontWeight: '800', margin: 0, color: 'var(--warning)', lineHeight: '1.2' }}>
                              +{formatCurrency(options.wantsReductionBalanced)}
                              <span style={{ fontSize: '0.72rem', fontWeight: 'normal', color: 'var(--text-secondary)' }}> / mo</span>
                            </h4>
                          )}
                          <h4 style={{ fontSize: '0.98rem', fontWeight: '800', margin: 0, color: 'var(--warning)', lineHeight: '1.2' }}>
                            +{formatCurrency(options.requiredBalancedIncomeAnnual)}
                            <span style={{ fontSize: '0.72rem', fontWeight: 'normal', color: 'var(--text-secondary)' }}> / yr</span>
                          </h4>
                        </div>
                      </div>

                      <div style={{ height: '1px', background: 'var(--border-color)', margin: '0.85rem 0' }} />

                      {/* Details Table */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                        <div style={{ textAlign: 'left' }}>
                          <div style={{ fontWeight: '600', color: 'var(--text-tertiary)' }}>Savings</div>
                          <div style={{ fontWeight: '700', color: 'var(--text-primary)', marginTop: '0.1rem' }}>
                            {formatCurrency(currentAnnualSavings)} &rarr; {(() => {
                              const netInc = getNetSavingsFromIncome(options.requiredBalancedIncomeAnnual, inputs.simpleIncome, inputs.filingStatus || 'single', inputs.includeTaxes);
                              const newSavingsVal = currentAnnualSavings + options.wantsReductionBalanced * 12 + netInc;
                              return (
                                <>
                                  {formatCurrency(newSavingsVal)}
                                  <span style={{ fontSize: '0.62rem', color: 'var(--text-tertiary)', fontWeight: 'normal', display: 'block' }}>
                                    /yr ({currentSavingsRate}% &rarr; {Math.round((newSavingsVal / (inputs.simpleIncome + options.requiredBalancedIncomeAnnual)) * 100)}%)
                                  </span>
                                </>
                              );
                            })()}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontWeight: '600', color: 'var(--text-tertiary)' }}>Income</div>
                          <div style={{ fontWeight: '700', color: 'var(--text-primary)', marginTop: '0.1rem' }}>
                            {formatCurrency(inputs.simpleIncome)} &rarr; {formatCurrency(inputs.simpleIncome + options.requiredBalancedIncomeAnnual)}
                            <span style={{ fontSize: '0.62rem', color: 'var(--text-tertiary)', fontWeight: 'normal', display: 'block' }}>/yr</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleApply('balanced')}
                      style={{
                        width: '100%',
                        padding: '0.55rem',
                        borderRadius: '12px',
                        border: 'none',
                        background: 'var(--warning)',
                        color: '#ffffff',
                        fontWeight: '700',
                        fontSize: '0.8rem',
                        cursor: 'pointer',
                        marginTop: '0.5rem',
                        transition: 'background var(--transition-fast)'
                      }}
                    >
                      Apply
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer info banner */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem', padding: '0.55rem', borderRadius: '12px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-color)', fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
          <span style={{ fontSize: '0.9rem' }}>🛡️</span>
          <span>We'll update your plan and results.</span>
        </div>
      </div>
    </div>
  );
}
