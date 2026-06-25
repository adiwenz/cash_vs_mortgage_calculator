import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Trash2, 
  Edit2, 
  Briefcase, 
  Home as HomeIcon, 
  Users, 
  DollarSign, 
  Check, 
  Info, 
  ChevronRight, 
  PlusCircle, 
  TrendingUp, 
  Percent, 
  Clock,
  Target
} from 'lucide-react';
import { formatCurrency } from '../helpers';

const getAccountDisplayName = (name, type) => {
  if (type === 'cash') return '💵 Cash';
  if (type === 'brokerage') return '📈 Taxable Brokerage';
  if (type === 'trad401k') return '👵 Traditional 401(k)';
  if (type === 'tradIra') return 'Traditional IRA';
  if (type === 'rothIra') return 'Roth IRA';
  if (type === 'hsa') return '🏥 HSA';
  if (type === 'crypto') return '🪙 Crypto';
  return name;
};

const CATEGORIES = [
  { key: 'people', label: 'People & Household', icon: '👥', addTypes: ['person', 'child'] },
  { key: 'jobs', label: 'Jobs & Income', icon: '💼', addTypes: ['job'] },
  { key: 'accounts', label: 'Accounts & Assets', icon: '💳', addTypes: ['account'] },
  { key: 'property', label: 'Homes & Property', icon: '🏡', addTypes: ['property'] },
  { key: 'debts', label: 'Debts', icon: '💰', addTypes: ['debt'] },
  { key: 'insurance', label: 'Insurance', icon: '🛡', addTypes: ['insurance'] },
  { key: 'other', label: 'Other', icon: '⚙', addTypes: ['goal'] }
];

export default function LifeItemsWorkspace({
  isMobile,
  inputs,
  localLifePlan,
  setLocalLifePlan,
  currentAge,
  lifeExpectancy,
  triggerSave,
  editingItemId,
  setEditingItemId
}) {
  const [editingItem, setEditingItem] = useState(null); // { mode: 'add'|'edit', type, item }
  const [editingEvent, setEditingEvent] = useState(null); // { mode: 'add'|'edit', objectId, eventType, event }
  const [activeCategory, setActiveCategory] = useState('people');
  
  const objects = localLifePlan?.objects || [];

  // Group objects based on category key
  const getCategoryObjects = (categoryKey, objectsList) => {
    switch (categoryKey) {
      case 'people':
        return objectsList.filter(o => ['person', 'child'].includes(o.type));
      case 'jobs':
        return objectsList.filter(o => o.type === 'job');
      case 'accounts':
        return objectsList.filter(o => ['account', 'business'].includes(o.type));
      case 'property':
        return objectsList.filter(o => o.type === 'property');
      case 'debts':
        return objectsList.filter(o => o.type === 'debt');
      case 'insurance':
        return objectsList.filter(o => o.type === 'insurance');
      case 'other':
        return objectsList.filter(o => !['person', 'child', 'job', 'account', 'business', 'property', 'debt', 'insurance'].includes(o.type));
      default:
        return [];
    }
  };

  useEffect(() => {
    if (editingItemId && setEditingItemId) {
      const item = objects.find(o => o.id === editingItemId);
      if (item) {
        // Prepare item copy
        const itemCopy = JSON.parse(JSON.stringify(item));
        if (itemCopy.properties?.role === 'self') {
          itemCopy.properties.lifeExpectancy = localLifePlan?.lifeExpectancy || lifeExpectancy;
        }
        setEditingItem({ mode: 'edit', type: item.type, item: itemCopy });
        
        // Auto-switch to the correct category in the sidebar
        if (['person', 'child'].includes(item.type)) {
          setActiveCategory('people');
        } else if (item.type === 'job') {
          setActiveCategory('jobs');
        } else if (['account', 'business'].includes(item.type)) {
          setActiveCategory('accounts');
        } else if (item.type === 'property') {
          setActiveCategory('property');
        } else if (item.type === 'debt') {
          setActiveCategory('debts');
        } else if (item.type === 'insurance') {
          setActiveCategory('insurance');
        } else {
          setActiveCategory('other');
        }
      }
      setEditingItemId(null);
    }
  }, [editingItemId, objects, setEditingItemId, localLifePlan, lifeExpectancy]);

  const getEventDefaultLabel = (type) => {
    switch (type) {
      case 'job.raise': return 'Salary Raise';
      case 'job.end': return 'End Job';
      case 'account.contributionChange': return 'Change Contribution';
      case 'account.allocationChange': return 'Change Allocation';
      case 'debt.payoff': return 'Payoff Debt';
      case 'property.sell': return 'Sell Property';
      case 'child.dependencyEnds': return 'Set Dependency End Age';
      case 'goal.complete': return 'Change Target Age';
      default: return 'Custom Change';
    }
  };

  const getEventInitialMutation = (type) => {
    switch (type) {
      case 'job.raise': return { annualIncome: 90000 };
      case 'account.contributionChange': return { contributionAmount: 800 };
      case 'account.allocationChange': return { allocation: '90/10' };
      case 'child.dependencyEnds': return { dependencyEndAge: 18 };
      case 'goal.complete': return { targetAge: 60 };
      default: return {};
    }
  };

  const handleStartAdd = (type) => {
    const newItem = {
      id: `${type}-${Date.now()}`,
      type,
      name: getPlaceholderName(type),
      startAge: currentAge,
      endAge: type === 'job' ? 65 : type === 'goal' ? lifeExpectancy : null,
      properties: getInitialProperties(type, currentAge)
    };
    setEditingItem({ mode: 'add', type, item: newItem });
  };

  const handleStartEdit = (item) => {
    const itemCopy = JSON.parse(JSON.stringify(item));
    if (itemCopy.properties?.role === 'self') {
      itemCopy.properties.lifeExpectancy = localLifePlan?.lifeExpectancy || lifeExpectancy;
    }
    setEditingItem({ mode: 'edit', type: item.type, item: itemCopy });
  };

  const handleDelete = (id) => {
    const nextObjects = objects.filter(o => o.id !== id);
    // If we delete a property, also delete any linked mortgage debt
    const mortgageId = `mortgage-${id}`;
    const cleanObjects = nextObjects.filter(o => o.id !== mortgageId);

    // Cascade deletion to attached events
    const cleanEvents = (localLifePlan.events || []).filter(e => e.objectId !== id && e.objectId !== mortgageId);

    const updatedPlan = {
      ...localLifePlan,
      objects: cleanObjects,
      events: cleanEvents
    };
    setLocalLifePlan(updatedPlan);
    triggerSave({ lifePlan: updatedPlan });
  };

  const handleStartAddEvent = (itemId, eventType) => {
    const defaultLabel = getEventDefaultLabel(eventType);
    const newEvent = {
      id: `event-${eventType}-${Date.now()}`,
      objectId: itemId,
      type: eventType,
      age: currentAge + 5,
      label: defaultLabel,
      description: '',
      mutation: getEventInitialMutation(eventType)
    };
    setEditingEvent({ mode: 'add', objectId: itemId, eventType, event: newEvent });
  };

  const handleStartEditEvent = (ev) => {
    setEditingEvent({ mode: 'edit', objectId: ev.objectId, eventType: ev.type, event: JSON.parse(JSON.stringify(ev)) });
  };

  const handleDeleteEvent = (eventId) => {
    const updatedPlan = {
      ...localLifePlan,
      events: (localLifePlan.events || []).filter(e => e.id !== eventId)
    };
    setLocalLifePlan(updatedPlan);
    triggerSave({ lifePlan: updatedPlan });
  };

  const handleSaveEvent = (ev) => {
    let nextEvents = localLifePlan.events || [];
    if (editingEvent.mode === 'add') {
      nextEvents = [...nextEvents, ev];
    } else {
      nextEvents = nextEvents.map(e => e.id === ev.id ? ev : e);
    }
    const updatedPlan = {
      ...localLifePlan,
      events: nextEvents
    };
    setLocalLifePlan(updatedPlan);
    setEditingEvent(null);
    triggerSave({ lifePlan: updatedPlan });
  };

  const handleSaveItem = (item) => {
    let updatedObjects;
    if (editingItem.mode === 'add') {
      updatedObjects = [...objects, item];
      // If home property with mortgage is added, automatically create mortgage debt object
      if (item.type === 'property' && Number(item.properties?.mortgageAmount || 0) > 0) {
        const mortgageId = `mortgage-${item.id}`;
        if (!updatedObjects.some(o => o.id === mortgageId)) {
          updatedObjects.push({
            id: mortgageId,
            type: 'debt',
            name: `${item.name} Mortgage`,
            startAge: item.startAge,
            properties: {
              debtType: 'mortgage',
              balance: Number(item.properties.mortgageAmount || 0),
              interestRate: Number(item.properties.interestRate || 6.5),
              monthlyPayment: Number(item.properties.monthlyPayment || 0),
              payoffPlan: 'standard',
              institution: item.properties.institution || ''
            }
          });
        }
      }
    } else {
      updatedObjects = objects.map(o => o.id === item.id ? item : o);
      // Synchronize mortgage if property mortgage values change
      if (item.type === 'property') {
        const mortgageId = `mortgage-${item.id}`;
        const mortgageIdx = updatedObjects.findIndex(o => o.id === mortgageId);
        if (mortgageIdx !== -1) {
          updatedObjects[mortgageIdx] = {
            ...updatedObjects[mortgageIdx],
            startAge: item.startAge,
            properties: {
              ...updatedObjects[mortgageIdx].properties,
              balance: Number(item.properties.mortgageAmount || 0),
              interestRate: Number(item.properties.interestRate || 6.5),
              monthlyPayment: Number(item.properties.monthlyPayment || 0),
              institution: item.properties.institution || updatedObjects[mortgageIdx].properties.institution || ''
            }
          };
        } else if (Number(item.properties?.mortgageAmount || 0) > 0) {
          updatedObjects.push({
            id: mortgageId,
            type: 'debt',
            name: `${item.name} Mortgage`,
            startAge: item.startAge,
            properties: {
              debtType: 'mortgage',
              balance: Number(item.properties.mortgageAmount || 0),
              interestRate: Number(item.properties.interestRate || 6.5),
              monthlyPayment: Number(item.properties.monthlyPayment || 0),
              payoffPlan: 'standard',
              institution: item.properties.institution || ''
            }
          });
        }
      }
    }

    const updatedPlan = {
      ...localLifePlan,
      objects: updatedObjects
    };

    if (item.properties?.role === 'self') {
      updatedPlan.currentAge = item.startAge;
      if (item.properties.lifeExpectancy !== undefined) {
        updatedPlan.lifeExpectancy = item.properties.lifeExpectancy;
      }
    }

    setLocalLifePlan(updatedPlan);
    setEditingItem(null);
    triggerSave({ lifePlan: updatedPlan });
  };

  const getPlaceholderName = (type) => {
    switch (type) {
      case 'job': return 'Current Job';
      case 'property': return 'Home';
      case 'account': return 'Brokerage Account';
      case 'debt': return 'Student Loan';
      case 'child': return 'Child';
      case 'person': return 'Partner';
      case 'goal': return 'Retirement';
      case 'business': return 'My Business';
      case 'windfall': return 'Windfall / Legacy';
      case 'insurance': return 'Life Insurance';
      default: return 'New Item';
    }
  };

  const getInitialProperties = (type, age) => {
    switch (type) {
      case 'job': return { annualIncome: 80000, growthRate: 3 };
      case 'property': return { homeValue: 350000, downPayment: 70000, mortgageAmount: 280000, interestRate: 6.5, monthlyPayment: 1770, propertyTaxes: 4000, insurance: 1200, hoa: 0, institution: '' };
      case 'account': return { accountType: 'brokerage', currentBalance: 10000, contributionAmount: 500, allocation: '80/20', institution: '' };
      case 'debt': return { debtType: 'student', balance: 25000, interestRate: 5.5, monthlyPayment: 300, payoffPlan: 'standard', institution: '' };
      case 'child': return { arrivalAge: age, childcareCost: 15000, dependencyEndAge: 18, includeCollege: false, collegeCost: 25000 };
      case 'person': return { role: 'partner', partnerIncome: 60000, partnerSavings: 10000, partnerRetirement: 25000, partnerDebts: 0, status: 'married' };
      case 'goal': return { targetAge: 65, spendingPercent: 70 };
      case 'business': return { currentBalance: 50000 };
      case 'windfall': return { amount: 50000 };
      case 'insurance': return { coverageAmount: 500000, premium: 50, insuranceType: 'term' };
      default: return {};
    }
  };

  const renderEventActions = (item) => {
    const buttons = [];
    if (item.type === 'job') {
      buttons.push({ label: '+ Raise', type: 'job.raise' });
      buttons.push({ label: '+ End Job', type: 'job.end' });
    } else if (item.type === 'account') {
      buttons.push({ label: '+ Change Contribution', type: 'account.contributionChange' });
      buttons.push({ label: '+ Change Allocation', type: 'account.allocationChange' });
    } else if (item.type === 'debt') {
      buttons.push({ label: '+ Payoff Event', type: 'debt.payoff' });
    } else if (item.type === 'property') {
      buttons.push({ label: '+ Sell Property', type: 'property.sell' });
    } else if (item.type === 'child') {
      buttons.push({ label: '+ Set Dependency End Age', type: 'child.dependencyEnds' });
    } else if (item.type === 'goal') {
      buttons.push({ label: '+ Change Target Age', type: 'goal.complete' });
    }

    if (buttons.length === 0) return null;

    return (
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '0.4rem', borderTop: '1px solid #f1f5f9', paddingTop: '0.4rem' }}>
        {buttons.map(btn => (
          <button
            key={btn.type}
            type="button"
            className="btn-secondary"
            onClick={() => handleStartAddEvent(item.id, btn.type)}
            style={{ padding: '3px 8px', fontSize: '0.68rem', borderRadius: '4px', background: '#f8fafc', color: 'var(--text-secondary)' }}
          >
            {btn.label}
          </button>
        ))}
      </div>
    );
  };

  const renderCard = (item, categoryKey) => {
    const p = item.properties || {};
    let typeLabel = item.type;
    let statusText = 'Active';
    let statusClass = 'active'; // 'active', 'completed', 'future'
    const itemEvents = (localLifePlan?.events || []).filter(e => e.objectId === item.id);
    const eventCount = itemEvents.length;

    const fields = [];

    if (item.type === 'person') {
      typeLabel = p.role === 'self' ? 'Self' : 'Partner';
      statusText = p.status ? p.status.charAt(0).toUpperCase() + p.status.slice(1) : 'Married';
      statusClass = 'active';
      
      fields.push({ label: 'Role', value: p.role === 'self' ? 'Self' : 'Partner' });
      if (p.role === 'self') {
        fields.push({ label: 'Your Age', value: `${item.startAge}` });
        fields.push({ label: 'Life Expectancy', value: `${localLifePlan?.lifeExpectancy || lifeExpectancy}` });
      } else {
        fields.push({ label: 'Start Age', value: `Age ${item.startAge}` });
        fields.push({ label: 'Salary', value: `${formatCurrency(p.partnerIncome)}/yr` });
        fields.push({ label: 'Liquid Assets', value: `${formatCurrency(Number(p.partnerSavings) + Number(p.partnerRetirement))}` });
      }
    } else if (item.type === 'child') {
      typeLabel = 'Child';
      const age = currentAge - item.startAge;
      statusText = age < p.dependencyEndAge ? 'Dependent' : 'Independent';
      statusClass = age < p.dependencyEndAge ? 'active' : 'completed';

      fields.push({ label: 'Current Age', value: `${age} yrs` });
      fields.push({ label: 'Dependency Ends', value: `Age ${p.dependencyEndAge}` });
      fields.push({ label: 'Childcare Cost', value: `${formatCurrency(p.childcareCost)}/yr` });
      fields.push({ label: 'College Tuition', value: p.includeCollege ? `${formatCurrency(p.collegeCost)}/yr` : 'None' });
    } else if (item.type === 'job') {
      typeLabel = 'Job';
      const isActive = currentAge >= item.startAge && (!item.endAge || currentAge <= item.endAge);
      statusText = isActive ? 'Active' : (currentAge < item.startAge ? 'Future' : 'Completed');
      statusClass = isActive ? 'active' : (currentAge < item.startAge ? 'future' : 'completed');

      fields.push({ label: 'Annual Salary', value: `${formatCurrency(p.annualIncome)}/yr` });
      fields.push({ label: 'Growth Rate', value: `${p.growthRate}%` });
      fields.push({ label: 'Duration', value: `Ages ${item.startAge} - ${item.endAge || 'Retirement'}` });
    } else if (item.type === 'property') {
      typeLabel = 'Property';
      statusText = 'Owned';
      statusClass = 'active';

      fields.push({ label: 'Home Value', value: formatCurrency(p.homeValue) });
      fields.push({ label: 'Down Payment', value: formatCurrency(p.downPayment) });
      fields.push({ label: 'Mortgage Principal', value: p.mortgageAmount > 0 ? `${formatCurrency(p.mortgageAmount)} @ ${p.interestRate}%` : 'None' });
      if (p.mortgageAmount > 0) {
        fields.push({ label: 'Mortgage Payment', value: `${formatCurrency(p.monthlyPayment)}/mo` });
      }
    } else if (item.type === 'account' || item.type === 'business') {
      typeLabel = item.type === 'business' ? 'Business' : (p.accountType ? p.accountType.toUpperCase() : 'Account');
      statusText = 'Active';
      statusClass = 'active';

      if (p.institution) {
        fields.push({ label: 'Institution', value: p.institution });
      }
      fields.push({ label: 'Balance', value: formatCurrency(item.type === 'business' ? p.currentBalance : p.currentBalance) });
      if (item.type !== 'business') {
        fields.push({ label: 'Contribution', value: `${formatCurrency(p.contributionAmount)}/mo` });
        fields.push({ label: 'Allocation', value: p.allocation || 'N/A' });
      }
    } else if (item.type === 'debt') {
      typeLabel = p.debtType ? p.debtType.toUpperCase() : 'Debt';
      const isActive = p.balance > 0;
      statusText = isActive ? 'Active' : 'Paid Off';
      statusClass = isActive ? 'active' : 'completed';

      if (p.institution) {
        fields.push({ label: 'Institution', value: p.institution });
      }
      fields.push({ label: 'Remaining Balance', value: formatCurrency(p.balance) });
      fields.push({ label: 'Interest Rate', value: `${p.interestRate}%` });
      fields.push({ label: 'Payment', value: `${formatCurrency(p.monthlyPayment)}/mo` });
    } else if (item.type === 'insurance') {
      typeLabel = p.insuranceType ? p.insuranceType.toUpperCase() : 'Insurance';
      statusText = 'Active';
      statusClass = 'active';

      fields.push({ label: 'Coverage Amount', value: formatCurrency(p.coverageAmount) });
      fields.push({ label: 'Premium', value: `${formatCurrency(p.premium)}/mo` });
    } else if (item.type === 'goal') {
      typeLabel = 'Goal';
      statusText = 'Target';
      statusClass = 'active';

      fields.push({ label: 'Target Age', value: `Age ${p.targetAge}` });
      fields.push({ label: 'Spending Need', value: `${p.spendingPercent}% of Expenses` });
    } else {
      typeLabel = item.type;
      statusText = 'Active';
      statusClass = 'active';
      Object.entries(p).forEach(([key, val]) => {
        if (typeof val !== 'object') {
          fields.push({ label: key, value: String(val) });
        }
      });
    }

    return (
      <div key={item.id} className="life-object-card life-profile-list-item">
        <div className="life-object-card-header">
          <span className="life-object-card-title">
            {item.type === 'account' ? getAccountDisplayName(item.name, p.accountType) : item.name}
          </span>
          <span className={`life-object-card-badge badge-${categoryKey}`}>
            {typeLabel}
          </span>
        </div>
        
        <div className="life-object-card-grid">
          {fields.map((f, idx) => (
            <div key={idx} className="life-object-card-field">
              <span className="life-object-card-label">{f.label}</span>
              <span className="life-object-card-value">{f.value}</span>
            </div>
          ))}
        </div>

        <div className="life-object-card-footer">
          <div className="life-object-card-status">
            <span className={`status-dot ${statusClass}`}></span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{statusText}</span>
          </div>
          <span className="life-object-card-events-count">
            {eventCount} {eventCount === 1 ? 'event' : 'events'}
          </span>
          <div className="life-object-card-actions">
            <button type="button" className="btn-card-action" onClick={() => handleStartEdit(item)} title="Edit Item">
              <Edit2 size={12} />
            </button>
            {item.properties?.role !== 'self' && (
              <button type="button" className="btn-card-action delete" onClick={() => handleDelete(item.id)} title="Delete Item">
                <Trash2 size={12} />
              </button>
            )}
          </div>
        </div>

        {/* Attached Events List */}
        {itemEvents.length > 0 && (
          <div style={{ borderTop: '1px dashed var(--border-color)', paddingTop: '0.5rem', marginTop: '0.25rem', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontSize: '0.68rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-tertiary)', letterSpacing: '0.5px' }}>Changes / Events</span>
            {itemEvents.map(ev => {
              let evDetail = '';
              if (ev.type === 'job.raise') evDetail = `Salary to ${formatCurrency(ev.mutation?.annualIncome)}`;
              else if (ev.type === 'job.end') evDetail = 'Job Ends';
              else if (ev.type === 'account.contributionChange') evDetail = `Contribution to ${formatCurrency(ev.mutation?.contributionAmount)}/mo`;
              else if (ev.type === 'account.allocationChange') evDetail = `Allocation to ${ev.mutation?.allocation}`;
              else if (ev.type === 'debt.payoff') evDetail = 'Paid Off';
              else if (ev.type === 'property.sell') evDetail = 'Property Sold';
              else if (ev.type === 'child.dependencyEnds') evDetail = `Dependency ends at age ${ev.mutation?.dependencyEndAge || ev.age}`;
              else if (ev.type === 'goal.complete') evDetail = `Target age to ${ev.mutation?.targetAge || ev.age}`;

              return (
                <div key={ev.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', padding: '4px 8px', borderRadius: '4px', border: '1px solid #f1f5f9' }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                    <strong>Age {ev.age}:</strong> {ev.label || ev.type} {evDetail && `· ${evDetail}`}
                  </span>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button type="button" onClick={() => handleStartEditEvent(ev)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '2px' }} title="Edit Event">
                      <Edit2 size={10} />
                    </button>
                    <button type="button" onClick={() => handleDeleteEvent(ev.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '2px' }} title="Delete Event">
                      <Trash2 size={10} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Event actions row */}
        {renderEventActions(item)}
      </div>
    );
  };

  const renderAddButtons = (categoryKey) => {
    switch (categoryKey) {
      case 'people':
        return (
          <div style={{ display: 'flex', gap: '8px' }}>
            <button 
              type="button" 
              className="btn-primary" 
              onClick={() => handleStartAdd('person')}
              style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem', display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              <Plus size={14} /> Add Person
            </button>
            <button 
              type="button" 
              className="btn-primary" 
              onClick={() => handleStartAdd('child')}
              style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem', display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              <Plus size={14} /> Add Child
            </button>
          </div>
        );
      case 'jobs':
        return (
          <button 
            type="button" 
            className="btn-primary" 
            onClick={() => handleStartAdd('job')}
            style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem', display: 'flex', alignItems: 'center', gap: '4px' }}
          >
            <Plus size={14} /> Add Job
          </button>
        );
      case 'accounts':
        return (
          <button 
            type="button" 
            className="btn-primary" 
            onClick={() => handleStartAdd('account')}
            style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem', display: 'flex', alignItems: 'center', gap: '4px' }}
          >
            <Plus size={14} /> Add Account
          </button>
        );
      case 'property':
        return (
          <button 
            type="button" 
            className="btn-primary" 
            onClick={() => handleStartAdd('property')}
            style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem', display: 'flex', alignItems: 'center', gap: '4px' }}
          >
            <Plus size={14} /> Add Property
          </button>
        );
      case 'debts':
        return (
          <button 
            type="button" 
            className="btn-primary" 
            onClick={() => handleStartAdd('debt')}
            style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem', display: 'flex', alignItems: 'center', gap: '4px' }}
          >
            <Plus size={14} /> Add Debt
          </button>
        );
      case 'insurance':
        return (
          <button 
            type="button" 
            className="btn-primary" 
            onClick={() => handleStartAdd('insurance')}
            style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem', display: 'flex', alignItems: 'center', gap: '4px' }}
          >
            <Plus size={14} /> Add Insurance
          </button>
        );
      case 'other':
        return (
          <button 
            type="button" 
            className="btn-primary" 
            onClick={() => handleStartAdd('goal')}
            style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem', display: 'flex', alignItems: 'center', gap: '4px' }}
          >
            <Plus size={14} /> Add Goal
          </button>
        );
      default:
        return null;
    }
  };

  const renderWorkspaceContent = () => {
    if (editingItem) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
            <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: '800' }}>
              {editingItem.mode === 'add' ? 'Add' : 'Edit'} {editingItem.type.charAt(0).toUpperCase() + editingItem.type.slice(1)} Item
            </h4>
            <button type="button" className="btn-secondary" onClick={() => setEditingItem(null)} style={{ fontSize: '0.75rem', padding: '0.25rem 0.6rem' }}>
              Back to List
            </button>
          </div>
          {renderEditorForm(editingItem.item, (updated) => {
            setEditingItem({ ...editingItem, item: updated });
          }, () => handleSaveItem(editingItem.item))}
        </div>
      );
    }

    if (editingEvent) {
      const ev = editingEvent.event;
      const item = objects.find(o => o.id === editingEvent.objectId);

      const updateEvField = (field, val) => {
        setEditingEvent({
          ...editingEvent,
          event: {
            ...ev,
            [field]: val
          }
        });
      };

      const updateMutation = (key, val) => {
        setEditingEvent({
          ...editingEvent,
          event: {
            ...ev,
            mutation: {
              ...ev.mutation,
              [key]: val
            }
          }
        });
      };

      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
            <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: '800' }}>
              {editingEvent.mode === 'add' ? 'Add' : 'Edit'} Event: {getEventDefaultLabel(editingEvent.eventType)}
            </h4>
            <button type="button" className="btn-secondary" onClick={() => setEditingEvent(null)} style={{ fontSize: '0.75rem', padding: '0.25rem 0.6rem' }}>
              Cancel
            </button>
          </div>
          
          <form onSubmit={(e) => { e.preventDefault(); handleSaveEvent(ev); }} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div className="life-profile-form-group">
              <label className="life-profile-label-small">Event Label</label>
              <input
                type="text"
                className="life-profile-input-field"
                value={ev.label || ''}
                onChange={(e) => updateEvField('label', e.target.value)}
                required
                style={{ width: '100%' }}
              />
            </div>

            <div className="life-profile-form-group">
              <label className="life-profile-label-small">Event Age</label>
              <input
                type="number"
                className="life-profile-input-field"
                value={ev.age !== null && ev.age !== undefined ? ev.age : ''}
                onChange={(e) => updateEvField('age', Number(e.target.value))}
                min={item ? item.startAge : currentAge}
                max={lifeExpectancy}
                required
                style={{ width: '100%' }}
              />
            </div>

            <div className="life-profile-form-group">
              <label className="life-profile-label-small">Description (Optional)</label>
              <input
                type="text"
                className="life-profile-input-field"
                value={ev.description || ''}
                onChange={(e) => updateEvField('description', e.target.value)}
                style={{ width: '100%' }}
              />
            </div>

            {/* Mutation Fields */}
            {editingEvent.eventType === 'job.raise' && (
              <div className="life-profile-form-group">
                <label className="life-profile-label-small">New Annual Salary</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <input
                    type="number"
                    className="life-profile-input-field"
                    value={ev.mutation?.annualIncome !== undefined ? ev.mutation.annualIncome : ''}
                    onChange={(e) => updateMutation('annualIncome', Number(e.target.value))}
                    required
                    style={{ width: '100%' }}
                  />
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>/ yr</span>
                </div>
              </div>
            )}

            {editingEvent.eventType === 'account.contributionChange' && (
              <div className="life-profile-form-group">
                <label className="life-profile-label-small">New Monthly Contribution</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <input
                    type="number"
                    className="life-profile-input-field"
                    value={ev.mutation?.contributionAmount !== undefined ? ev.mutation.contributionAmount : ''}
                    onChange={(e) => updateMutation('contributionAmount', Number(e.target.value))}
                    required
                    style={{ width: '100%' }}
                  />
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>/ mo</span>
                </div>
              </div>
            )}

            {editingEvent.eventType === 'account.allocationChange' && (
              <div className="life-profile-form-group">
                <label className="life-profile-label-small">New Allocation (Stocks/Bonds)</label>
                <input
                  type="text"
                  className="life-profile-input-field"
                  value={ev.mutation?.allocation || ''}
                  onChange={(e) => updateMutation('allocation', e.target.value)}
                  placeholder="e.g. 90/10"
                  required
                  style={{ width: '100%' }}
                />
              </div>
            )}

            {editingEvent.eventType === 'child.dependencyEnds' && (
              <div className="life-profile-form-group">
                <label className="life-profile-label-small">New Dependency End Age</label>
                <input
                  type="number"
                  className="life-profile-input-field"
                  value={ev.mutation?.dependencyEndAge !== undefined ? ev.mutation.dependencyEndAge : ''}
                  onChange={(e) => updateMutation('dependencyEndAge', Number(e.target.value))}
                  required
                  style={{ width: '100%' }}
                />
              </div>
            )}

            {editingEvent.eventType === 'goal.complete' && (
              <div className="life-profile-form-group">
                <label className="life-profile-label-small">New Target Age</label>
                <input
                  type="number"
                  className="life-profile-input-field"
                  value={ev.mutation?.targetAge !== undefined ? ev.mutation.targetAge : ''}
                  onChange={(e) => updateMutation('targetAge', Number(e.target.value))}
                  required
                  style={{ width: '100%' }}
                />
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
              <button type="submit" className="btn-primary" style={{ fontSize: '0.8rem', padding: '0.4rem 1rem' }}>
                Save Event
              </button>
            </div>
          </form>
        </div>
      );
    }

    return CATEGORIES.map(cat => {
      const catObjects = getCategoryObjects(cat.key, objects);
      const isVisible = activeCategory === cat.key;
      return (
        <div key={cat.key} style={{ display: isVisible ? 'flex' : 'none', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
            <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: '800' }}>
              {cat.label}
            </h4>
            {renderAddButtons(cat.key)}
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {catObjects.map(item => renderCard(item, cat.key))}
            {catObjects.length === 0 && (
              <div style={{
                textAlign: 'center',
                padding: '2.5rem 1rem',
                border: '1px dashed var(--border-color)',
                borderRadius: '8px',
                color: 'var(--text-tertiary)',
                fontSize: '0.8rem'
              }}>
                No {cat.label.toLowerCase()} configured
              </div>
            )}
          </div>
        </div>
      );
    });
  };

  return (
    <div className="life-profile-tab-content-panel" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: '800' }}>Life Items</h4>
          <p style={{ margin: '2px 0 0 0', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Configure all the durable aspects of your life clock in one place.</p>
        </div>
      </div>

      {/* Mobile Segments vs. Desktop Sidebar */}
      {isMobile ? (
        <div className="life-items-mobile-nav">
          {CATEGORIES.map(cat => {
            const count = getCategoryObjects(cat.key, objects).length;
            const isActive = activeCategory === cat.key;
            return (
              <button
                key={cat.key}
                type="button"
                className={`life-items-mobile-nav-btn ${isActive ? 'active' : ''}`}
                onClick={() => setActiveCategory(cat.key)}
              >
                {cat.icon} {cat.label} ({count})
              </button>
            );
          })}
        </div>
      ) : null}

      <div className="life-items-container">
        {!isMobile && (
          <div className="life-items-sidebar">
            {CATEGORIES.map(cat => {
              const count = getCategoryObjects(cat.key, objects).length;
              const isActive = activeCategory === cat.key;
              return (
                <button
                  key={cat.key}
                  type="button"
                  className={`life-items-sidebar-btn ${isActive ? 'active' : ''}`}
                  onClick={() => setActiveCategory(cat.key)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '1.05rem' }}>{cat.icon}</span>
                    <span>{cat.label}</span>
                  </div>
                  <span className="life-items-sidebar-count">
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        <div className="life-items-workspace-pane">
          {renderWorkspaceContent()}
        </div>
      </div>
    </div>
  );
}

// Editor rendering helper
function renderEditorForm(item, onChange, onSave) {
  const p = item.properties || {};

  const updateProp = (key, val) => {
    onChange({
      ...item,
      properties: {
        ...p,
        [key]: val
      }
    });
  };

  const renderField = (label, key, type = 'text', suffix = '') => (
    <div className="life-profile-form-group" style={{ marginBottom: '0.75rem' }}>
      <label className="life-profile-label-small">{label}</label>
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        <input 
          type={type} 
          className="life-profile-input-field" 
          value={p[key] !== undefined ? p[key] : ''} 
          onChange={(e) => updateProp(key, type === 'number' ? Number(e.target.value) : e.target.value)} 
          style={{ width: '100%' }}
        />
        {suffix && <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{suffix}</span>}
      </div>
    </div>
  );

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave(); }} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <div className="life-profile-form-group">
        <label className="life-profile-label-small">Item Name</label>
        <input 
          type="text" 
          className="life-profile-input-field" 
          value={item.name} 
          onChange={(e) => onChange({ ...item, name: e.target.value })} 
          required 
          style={{ width: '100%' }}
          disabled={p.role === 'self'}
        />
      </div>

      <div className="life-profile-row-two-col" style={{ display: 'flex', gap: '0.75rem' }}>
        <div className="life-profile-form-group" style={{ flex: 1 }}>
          <label className="life-profile-label-small">
            {p.role === 'self' ? 'Your Age' : 'Start Age'}
          </label>
          <input 
            type="number" 
            className="life-profile-input-field" 
            value={item.startAge !== null ? item.startAge : ''} 
            onChange={(e) => onChange({ ...item, startAge: Number(e.target.value) })} 
            required 
            style={{ width: '100%' }}
          />
        </div>
        {item.type === 'job' && (
          <div className="life-profile-form-group" style={{ flex: 1 }}>
            <label className="life-profile-label-small">End Age</label>
            <input 
              type="number" 
              className="life-profile-input-field" 
              value={item.endAge !== null ? item.endAge : ''} 
              onChange={(e) => onChange({ ...item, endAge: Number(e.target.value) })} 
              style={{ width: '100%' }}
            />
          </div>
        )}
      </div>

      {item.type === 'job' && (
        <>
          {renderField('Annual Salary', 'annualIncome', 'number', '/ yr')}
          {renderField('Annual Growth', 'growthRate', 'number', '%')}
        </>
      )}

      {item.type === 'account' && (
        <>
          <div className="life-profile-form-group">
            <label className="life-profile-label-small">Account Type</label>
            <select 
              className="life-profile-select-field" 
              value={p.accountType || 'brokerage'} 
              onChange={(e) => updateProp('accountType', e.target.value)}
              style={{ width: '100%' }}
            >
              <option value="cash">Cash / HYSA</option>
              <option value="brokerage">Taxable Brokerage</option>
              <option value="trad401k">Traditional 401(k)</option>
              <option value="tradIra">Traditional IRA</option>
              <option value="rothIra">Roth IRA</option>
              <option value="hsa">HSA (Health Savings Account)</option>
              <option value="crypto">Crypto</option>
              <option value="businessEquity">Business Equity</option>
            </select>
          </div>
          {renderField('Institution', 'institution', 'text')}
          {renderField('Current Balance', 'currentBalance', 'number', '$')}
          {renderField('Monthly Contribution', 'contributionAmount', 'number', '/ mo')}
          {renderField('Allocation (Stocks/Bonds)', 'allocation', 'text')}
        </>
      )}

      {item.type === 'debt' && (
        <>
          <div className="life-profile-form-group">
            <label className="life-profile-label-small">Debt Type</label>
            <select 
              className="life-profile-select-field" 
              value={p.debtType || 'student'} 
              onChange={(e) => updateProp('debtType', e.target.value)}
              style={{ width: '100%' }}
            >
              <option value="student">Student Loan</option>
              <option value="credit">Credit Card</option>
              <option value="car">Car Loan</option>
              <option value="mortgage">Mortgage</option>
              <option value="other">Other</option>
            </select>
          </div>
          {renderField('Institution', 'institution', 'text')}
          {renderField('Current Balance', 'balance', 'number', '$')}
          {renderField('Interest Rate', 'interestRate', 'number', '%')}
          {renderField('Monthly Payment', 'monthlyPayment', 'number', '/ mo')}
        </>
      )}

      {item.type === 'property' && (
        <>
          {renderField('Home Value', 'homeValue', 'number', '$')}
          {renderField('Down Payment', 'downPayment', 'number', '$')}
          {renderField('Mortgage Amount', 'mortgageAmount', 'number', '$')}
          {renderField('Mortgage Rate', 'interestRate', 'number', '%')}
          {renderField('Monthly Mortgage Payment', 'monthlyPayment', 'number', '/ mo')}
          {renderField('Monthly HOA Costs', 'hoa', 'number', '/ mo')}
          {renderField('Annual Property Taxes', 'propertyTaxes', 'number', '/ yr')}
          {renderField('Annual Home Insurance', 'insurance', 'number', '/ yr')}
          {renderField('Institution (Mortgage provider)', 'institution', 'text')}
        </>
      )}

      {item.type === 'child' && (
        <>
          {renderField('Annual Childcare Cost', 'childcareCost', 'number', '/ yr')}
          {renderField('Dependency End Age', 'dependencyEndAge', 'number')}
          <div className="life-profile-form-group" style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '0.5rem 0' }}>
            <input 
              type="checkbox" 
              checked={!!p.includeCollege} 
              onChange={(e) => updateProp('includeCollege', e.target.checked)} 
              id="include-college-checkbox"
            />
            <label htmlFor="include-college-checkbox" className="life-profile-label-small" style={{ margin: 0, cursor: 'pointer' }}>Plan for College costs?</label>
          </div>
          {p.includeCollege && renderField('Annual College Tuition', 'collegeCost', 'number', '/ yr')}
        </>
      )}

      {item.type === 'person' && (
        <>
          {p.role === 'self' ? (
            <>
              <div className="life-profile-form-group" style={{ marginBottom: '0.75rem' }}>
                <label className="life-profile-label-small">Life Expectancy</label>
                <input 
                  type="number" 
                  className="life-profile-input-field" 
                  value={p.lifeExpectancy !== undefined ? p.lifeExpectancy : 85} 
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    updateProp('lifeExpectancy', val);
                  }} 
                  required 
                  style={{ width: '100%' }}
                />
              </div>
            </>
          ) : (
            <>
              <div className="life-profile-form-group">
                <label className="life-profile-label-small">Filing / Household status</label>
                <select 
                  className="life-profile-select-field" 
                  value={p.status || 'married'} 
                  onChange={(e) => updateProp('status', e.target.value)}
                  style={{ width: '100%' }}
                >
                  <option value="married">Married</option>
                  <option value="partnered">Partnered</option>
                </select>
              </div>
              {renderField('Partner Income', 'partnerIncome', 'number', '/ yr')}
              {renderField('Partner Extra Savings', 'partnerSavings', 'number', '$')}
              {renderField('Partner Retirement Balance', 'partnerRetirement', 'number', '$')}
              {renderField('Partner Debts', 'partnerDebts', 'number', '$')}
            </>
          )}
        </>
      )}

      {item.type === 'insurance' && (
        <>
          <div className="life-profile-form-group">
            <label className="life-profile-label-small">Insurance Type</label>
            <select 
              className="life-profile-select-field" 
              value={p.insuranceType || 'term'} 
              onChange={(e) => updateProp('insuranceType', e.target.value)}
              style={{ width: '100%' }}
            >
              <option value="term">Term Life</option>
              <option value="whole">Whole Life</option>
              <option value="health">Private Health</option>
              <option value="other">Other</option>
            </select>
          </div>
          {renderField('Coverage Amount', 'coverageAmount', 'number', '$')}
          {renderField('Monthly Premium', 'premium', 'number', '$')}
        </>
      )}

      {item.type === 'goal' && (
        <>
          {renderField('Target Age', 'targetAge', 'number')}
          {renderField('Retirement Spending Need (Percentage)', 'spendingPercent', 'number', '%')}
        </>
      )}

      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
        <button type="submit" className="btn-primary" style={{ fontSize: '0.8rem', padding: '0.4rem 1rem' }}>
          Save Item
        </button>
      </div>
    </form>
  );
}
