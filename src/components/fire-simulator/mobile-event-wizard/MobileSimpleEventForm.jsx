import React from 'react';
import { X, Info } from 'lucide-react';
import { getEventIcon } from './mobileWizardUtils';

const getMockupTitle = (type) => {
  const titles = {
    move: "Move / Relocate",
    windfall: "Windfall / Inheritance",
    pension: "Add Pension",
    rentalIncome: "Add Rental Income",
    annuity: "Add Annuity",
    otherRetirementIncome: "Add Other Non-Work Income",
    college: "College Tuition",
    debtPayoff: "Debt Payoff Plan"
  };
  return titles[type] || "Add Event";
};

const getEventSubtitle = (type) => {
  const subtitles = {
    move: "Add a move or relocation to your life plan.",
    windfall: "Add a windfall or inheritance to your plan.",
    pension: "Add a pension income to your plan.",
    rentalIncome: "Add a rental income stream to your plan.",
    annuity: "Add an annuity income to your plan.",
    otherRetirementIncome: "Add other non-work income to your plan.",
    college: "Add college tuition expense to your plan.",
    debtPayoff: "Add a debt payoff plan to your plan."
  };
  return subtitles[type] || "";
};

const getEventInfoCallout = (type, inflationAdjusted) => {
  if (type === 'annuity') {
    return inflationAdjusted === false
      ? "Keep unchecked if the payout is fixed and does not increase."
      : "Income will increase with inflation over time.";
  }
  const infoMap = {
    move: "This will update your location and expected spending.",
    windfall: "After-tax amount will be added to your cash flow.",
    pension: "Income will increase with inflation over time.",
    rentalIncome: "Income will increase with inflation over time.",
    otherRetirementIncome: "Income will increase with inflation over time.",
    college: "Tuition will be applied annually for the selected duration.",
    debtPayoff: "This will remove or reduce your debt at the selected age."
  };
  return infoMap[type] || "";
};

const getBadgeBgColor = (type) => {
  const colors = {
    move: "#f0f9ff", // Soft Blue
    windfall: "#f5f3ff", // Soft Purple
    pension: "#fffbeb", // Soft Orange
    rentalIncome: "#fffbeb",
    annuity: "#fffbeb",
    otherRetirementIncome: "#fffbeb",
    college: "#f5f3ff",
    debtPayoff: "#fef2f2" // Soft Red
  };
  return colors[type] || "#f9fafb";
};

export default function MobileSimpleEventForm({
  draftEvent,
  setDraftEvent,
  onCancel,
  onSave,
  onDelete,
  isNew
}) {
  const type = draftEvent.type;
  const icon = getEventIcon(type);
  const mockupTitle = getMockupTitle(type);
  const subtitle = getEventSubtitle(type);
  const infoCallout = getEventInfoCallout(type, draftEvent.inflationAdjusted);
  const badgeBgColor = getBadgeBgColor(type);

  const handleFieldChange = (key, val) => {
    setDraftEvent(prev => {
      const updated = { ...prev, [key]: val };

      // Sync rules for schema compatibility
      if (['pension', 'rentalIncome', 'annuity', 'otherRetirementIncome'].includes(type)) {
        if (key === 'claimingAge') {
          updated.startAge = val;
          updated.age = val;
        }
      }
      if (type === 'move') {
        if (key === 'moveAge') {
          updated.startAge = val;
          updated.age = val;
        }
      }
      if (type === 'windfall') {
        if (key === 'ageReceived') {
          updated.startAge = val;
          updated.age = val;
        }
      }
      if (type === 'debtPayoff') {
        if (key === 'payoffAge') {
          updated.startAge = val;
          updated.age = val;
        }
      }
      if (type === 'college') {
        if (key === 'startAge') {
          updated.age = val;
        }
      }

      return updated;
    });
  };

  // Define inputs configuration
  const fields = React.useMemo(() => {
    const configs = {
      move: [
        { key: 'location', label: 'Where? (Location Name)', type: 'text', placeholder: 'Dominican Republic' },
        { key: 'moveAge', label: 'Moving Age', type: 'number' },
        { key: 'newSpending', label: 'New Annual Spending ($)', type: 'currency', placeholder: '40000' },
        { key: 'movingCost', label: 'One-time Moving Cost ($)', type: 'currency', placeholder: '0' }
      ],
      windfall: [
        { key: 'ageReceived', label: 'Age Received', type: 'number' },
        { key: 'amount', label: 'Amount ($)', type: 'currency', placeholder: '100000' },
        { key: 'taxRate', label: 'Tax Rate (%)', type: 'percent' }
      ],
      pension: [
        { key: 'name', label: 'Income Name', type: 'text', placeholder: 'Pension' },
        { key: 'claimingAge', label: 'Start Age', type: 'number' },
        { key: 'monthlyBenefit', label: 'Monthly Amount ($)', type: 'currency', placeholder: '1000' },
        { key: 'inflationAdjusted', label: 'Inflation Adjusted (increases with cost of living)', type: 'checkbox' }
      ],
      rentalIncome: [
        { key: 'name', label: 'Income Name', type: 'text', placeholder: 'Rental Income' },
        { key: 'claimingAge', label: 'Start Age', type: 'number' },
        { key: 'monthlyBenefit', label: 'Monthly Amount ($)', type: 'currency', placeholder: '1500' },
        { key: 'inflationAdjusted', label: 'Inflation Adjusted (increases with cost of living)', type: 'checkbox' }
      ],
      annuity: [
        { key: 'name', label: 'Income Name', type: 'text', placeholder: 'Annuity' },
        { key: 'claimingAge', label: 'Start Age', type: 'number' },
        { key: 'monthlyBenefit', label: 'Monthly Amount ($)', type: 'currency', placeholder: '500' },
        { key: 'inflationAdjusted', label: 'Inflation Adjusted (increases with cost of living)', type: 'checkbox' }
      ],
      otherRetirementIncome: [
        { key: 'name', label: 'Income Name', type: 'text', placeholder: 'Other Income' },
        { key: 'claimingAge', label: 'Start Age', type: 'number' },
        { key: 'monthlyBenefit', label: 'Monthly Amount ($)', type: 'currency', placeholder: '800' },
        { key: 'inflationAdjusted', label: 'Inflation Adjusted (increases with cost of living)', type: 'checkbox' }
      ],
      college: [
        { key: 'startAge', label: 'Start Age', type: 'number' },
        { key: 'tuitionCost', label: 'Annual Tuition Cost ($)', type: 'currency', placeholder: '30000' },
        { key: 'duration', label: 'Duration (years)', type: 'number' }
      ],
      debtPayoff: [
        { key: 'payoffAge', label: 'Payoff Age', type: 'number' },
        { key: 'amount', label: 'Payoff Amount ($)', type: 'currency', placeholder: '5000' }
      ]
    };
    return configs[type] || [];
  }, [type]);

  return (
    <div className="mobile-simple-form-backdrop">
      <div className="mobile-simple-form-card">
        <div className="mobile-simple-form-handle" />
        
        <button type="button" className="mobile-simple-form-close" onClick={onCancel}>
          <X size={20} />
        </button>

        <div className="mobile-simple-form-icon-badge" style={{ backgroundColor: badgeBgColor }}>
          {icon}
        </div>

        <h3 className="mobile-simple-form-title">
          {mockupTitle}
        </h3>
        
        <p className="mobile-simple-form-subtitle">
          {subtitle}
        </p>

        <div className="mobile-simple-form-body">
          {fields.map(field => {
            const val = draftEvent[field.key];

            if (field.type === 'checkbox') {
              return (
                <div key={field.key} className="mobile-simple-form-checkbox-row">
                  <span className="mobile-simple-form-label" style={{ margin: 0 }}>
                    {field.label}
                  </span>
                  <input
                    type="checkbox"
                    checked={val !== false}
                    onChange={(e) => handleFieldChange(field.key, e.target.checked)}
                  />
                </div>
              );
            }

            return (
              <div key={field.key} className="mobile-simple-form-field">
                <span className="mobile-simple-form-label">
                  {field.label}
                </span>
                
                <input
                  type={field.type === 'text' ? 'text' : 'number'}
                  className="mobile-simple-form-input"
                  placeholder={field.placeholder || ''}
                  value={val !== undefined && val !== null ? val : ''}
                  onChange={(e) => {
                    let nextVal = e.target.value;
                    if (field.type !== 'text') {
                      nextVal = nextVal === '' ? '' : (field.type === 'currency' ? parseFloat(nextVal) : parseInt(nextVal));
                      if (isNaN(nextVal)) nextVal = '';
                    }
                    handleFieldChange(field.key, nextVal);
                  }}
                />
              </div>
            );
          })}

          {infoCallout && (
            <div className="mobile-simple-form-info">
              <Info size={16} />
              <span>{infoCallout}</span>
            </div>
          )}
        </div>

        <div className="mobile-simple-form-footer">
          <button type="button" className="mobile-simple-form-save" onClick={onSave}>
            Save Event
          </button>
          
          <button type="button" className="mobile-simple-form-cancel" onClick={onCancel}>
            Cancel
          </button>

          {!isNew && onDelete && (
            <button 
              type="button" 
              className="mobile-simple-form-delete" 
              onClick={() => {
                if (window.confirm("Are you sure you want to delete this event? This will immediately remove it from your roadmap and recalculate your projection.")) {
                  onDelete();
                }
              }}
            >
              Delete Event
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
