import { formatCurrency } from './helpers';

export default function ChildImpactModal({
  eventController,
  scenario,
  recommendationController,
  
  // Legacy:
  childImpactSummary: legacyChildImpactSummary,
  inputs: legacyInputs,
  setChildImpactSummary: legacySetChildImpactSummary,
  setEditingEvent: legacySetEditingEvent,
  setShowImprovementModal: legacySetShowImprovementModal
}) {
  const childImpactSummary = eventController?.childImpactSummary ?? legacyChildImpactSummary;
  const inputs = scenario?.inputs ?? legacyInputs;
  const setChildImpactSummary = eventController?.setChildImpactSummary ?? legacySetChildImpactSummary;
  const setEditingEvent = eventController?.setEditingEvent ?? legacySetEditingEvent;
  const setShowImprovementModal = recommendationController?.setShowImprovementModal ?? legacySetShowImprovementModal;
  if (!childImpactSummary) return null;
  const { beforeAge, afterAge, diffYears, annualSpending, event } = childImpactSummary;

  const targetRet = Number(inputs.targetRetirementAge) || 65;
  const isBeforeReady = beforeAge !== null && beforeAge <= targetRet;
  const isAfterReady = afterAge !== null && afterAge <= targetRet;
  const isStillReady = afterAge !== null && (diffYears <= 0 || afterAge <= targetRet);

  const startAge = event.childStartAge !== undefined ? Number(event.childStartAge) : 0;
  const includeCollege = !!event.includeCollege;
  const maxAge = includeCollege ? 22 : 18;
  const years = Math.max(0, maxAge - startAge);

  return (
    <div className="modal-backdrop" onClick={() => setChildImpactSummary(null)}>
      <div className="event-form-overlay-card modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '450px' }}>
        <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1rem', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          👶 {event.childName ? `Welcome, ${event.childName}!` : 'Child Event Added'}
        </h3>
        
        <p style={{ fontSize: '0.85rem', lineHeight: '1.5', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
          {isStillReady 
            ? "Congratulations! Your plan remains fully on track and sustainable with this child event. No further adjustments are needed."
            : "Adding child-related costs changes the timeline and may require adjustments to savings, spending, or stop working assumptions. Raising a child is a beautiful journey, and these figures help you plan with confidence. You can refine child spending details in your budget at any time."
          }
        </p>

        <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', padding: '1rem', marginBottom: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', fontWeight: 'bold' }}>Before Child:</div>
            <div style={{ fontSize: '0.9rem', fontWeight: 'bold', color: isBeforeReady ? 'var(--accent-emerald)' : 'var(--accent-orange, #f59e0b)', marginTop: '0.2rem' }}>
              {beforeAge 
                ? (beforeAge <= targetRet ? `✓ Can Stop Working at Age ${beforeAge}` : `⚠ Can Stop Working Late at Age ${beforeAge}`)
                : '⚠ Current Plan Needs Adjustment'}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', fontWeight: 'bold' }}>After Child:</div>
            <div style={{ fontSize: '0.9rem', fontWeight: 'bold', color: isAfterReady ? 'var(--accent-emerald)' : 'var(--accent-orange, #f59e0b)', marginTop: '0.2rem' }}>
              {afterAge 
                ? (afterAge <= targetRet ? `✓ Can Stop Working at Age ${afterAge}` : `⚠ Can Stop Working Late at Age ${afterAge}`)
                : '⚠ Current Plan Needs Adjustment'}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', fontWeight: 'bold' }}>Estimated Child Costs:</div>
            <div style={{ fontSize: '0.9rem', fontWeight: 'bold', color: 'var(--text-primary)', marginTop: '0.2rem' }}>
              {formatCurrency(annualSpending)}/year for {years} years
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
          <button 
            type="button"
            className="btn-secondary" 
            onClick={() => {
              setChildImpactSummary(null);
              setEditingEvent(event);
            }}
            style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
          >
            Refine Child Costs
          </button>
          <button 
            type="button"
            className={isStillReady ? "btn-primary" : "btn-secondary"} 
            onClick={() => {
              setChildImpactSummary(null);
            }}
            style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
          >
            Done
          </button>
          <button 
            type="button"
            className={isStillReady ? "btn-secondary" : "btn-primary"} 
            onClick={() => {
              setChildImpactSummary(null);
              setShowImprovementModal(true);
            }}
            style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
          >
            Adjust Plan
          </button>
        </div>
      </div>
    </div>
  );
}

export function ChildCostsBuckets({
  inputs,
  handleEditRoadmapEvent
}) {
  const childEvents = inputs.lifeEvents.filter(e => e.type === 'haveChild');
  if (childEvents.length === 0) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.75rem' }}>
      {childEvents.map((ev, idx) => {
        const startAge = ev.childStartAge !== undefined ? ev.childStartAge : 0;
        const birthAge = ev.birthAge !== undefined ? ev.birthAge : inputs.currentAge;
        const childName = ev.childName || `Child #${idx + 1}`;
        
        const maxAge = ev.includeCollege ? 22 : 18;
        const parentStartAge = birthAge + startAge;
        const parentEndAge = birthAge + maxAge;
        
        const currentChildAge = Math.max(0, inputs.currentAge - birthAge);
        
        let currentAnnualCost = 0;
        const ages0to4 = ev.costMethod === 'custom' ? (ev.customAges0to4 !== undefined ? Number(ev.customAges0to4) : 15000) : (inputs.childCosts?.ages0to4 !== undefined ? Number(inputs.childCosts.ages0to4) : 15000);
        const ages5to12 = ev.costMethod === 'custom' ? (ev.customAges5to12 !== undefined ? Number(ev.customAges5to12) : 15000) : (inputs.childCosts?.ages5to12 !== undefined ? Number(inputs.childCosts.ages5to12) : 15000);
        const ages13to18 = ev.costMethod === 'custom' ? (ev.customAges13to18 !== undefined ? Number(ev.customAges13to18) : 15000) : (inputs.childCosts?.ages13to18 !== undefined ? Number(inputs.childCosts.ages13to18) : 15000);
        const ages19to22 = ev.costMethod === 'custom' ? (ev.customAges19to22 !== undefined ? Number(ev.customAges19to22) : 15000) : (inputs.childCosts?.ages19to22 !== undefined ? Number(inputs.childCosts.ages19to22) : 15000);

        if (currentChildAge >= 0 && currentChildAge <= 4) currentAnnualCost = ages0to4;
        else if (currentChildAge >= 5 && currentChildAge <= 12) currentAnnualCost = ages5to12;
        else if (currentChildAge >= 13 && currentChildAge <= 18) currentAnnualCost = ages13to18;
        else if (currentChildAge >= 19 && currentChildAge <= 22) currentAnnualCost = ages19to22;

        const monthlyCost = Math.round(currentAnnualCost / 12);

        return (
          <div className="glass-card" key={ev.id || idx} style={{ padding: '1.25rem 1.5rem', border: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <h4 style={{ fontSize: '0.95rem', fontWeight: '800', margin: 0, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                👶 {childName} Spending Bucket
              </h4>
              <button
                type="button"
                className="btn-secondary"
                style={{ padding: '0.2rem 0.6rem', fontSize: '0.7rem', margin: 0 }}
                onClick={() => handleEditRoadmapEvent({
                  ...ev,
                  age: birthAge
                })}
              >
                Adjust
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.5rem' }}>
              <div>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', display: 'block' }}>Current Monthly Cost</span>
                <strong style={{ fontSize: '1rem', color: 'var(--text-primary)' }}>{formatCurrency(monthlyCost)}/mo</strong>
              </div>
              <div>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', display: 'block' }}>Current Annual Cost</span>
                <strong style={{ fontSize: '1rem', color: 'var(--text-primary)' }}>{formatCurrency(currentAnnualCost)}/yr</strong>
              </div>
            </div>

            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', borderTop: '1px solid var(--border-color)', paddingTop: '0.5rem', marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
              <div>
                Active Years: <strong>Parent Age {parentStartAge} to {parentEndAge}</strong> (Child Age {startAge} to {maxAge})
              </div>
              <div>
                College Support: <strong>{ev.includeCollege ? 'Enabled (Ages 19-22)' : 'Disabled'}</strong>
              </div>
              <div>
                Cost Method: <strong>{ev.costMethod === 'custom' ? 'Custom Brackets' : ev.costMethod === 'budget' ? 'Budget Builder' : 'Default Assumptions'}</strong>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
