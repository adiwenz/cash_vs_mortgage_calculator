import React, { useState } from 'react';
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

export default function LifeItemsWorkspace({
  isMobile,
  inputs,
  localLifePlan,
  setLocalLifePlan,
  currentAge,
  lifeExpectancy,
  triggerSave
}) {
  const [editingItem, setEditingItem] = useState(null); // { mode: 'add'|'edit', type, item }
  const [showTypeSelect, setShowTypeSelect] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null); // { mode: 'add'|'edit', objectId, eventType, event }
  
  const objects = localLifePlan?.objects || [];

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

  // Group objects
  const grouped = {
    household: objects.filter(o => ['person', 'child'].includes(o.type)),
    income: objects.filter(o => o.type === 'job'),
    property: objects.filter(o => o.type === 'property'),
    assets: objects.filter(o => o.type === 'account' || o.type === 'business'),
    debts: objects.filter(o => o.type === 'debt'),
    goals: objects.filter(o => o.type === 'goal')
  };

  const handleStartAdd = (type) => {
    setShowTypeSelect(false);
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
    setEditingItem({ mode: 'edit', type: item.type, item: JSON.parse(JSON.stringify(item)) });
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
              payoffPlan: 'standard'
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
              monthlyPayment: Number(item.properties.monthlyPayment || 0)
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
              payoffPlan: 'standard'
            }
          });
        }
      }
    }

    const updatedPlan = {
      ...localLifePlan,
      objects: updatedObjects
    };
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
      default: return 'New Item';
    }
  };

  const getInitialProperties = (type, age) => {
    switch (type) {
      case 'job': return { annualIncome: 80000, growthRate: 3 };
      case 'property': return { homeValue: 350000, downPayment: 70000, mortgageAmount: 280000, interestRate: 6.5, monthlyPayment: 1770, propertyTaxes: 4000, insurance: 1200, hoa: 0 };
      case 'account': return { accountType: 'brokerage', currentBalance: 10000, contributionAmount: 500, allocation: '80/20' };
      case 'debt': return { debtType: 'student', balance: 25000, interestRate: 5.5, monthlyPayment: 300, payoffPlan: 'standard' };
      case 'child': return { arrivalAge: age, childcareCost: 15000, dependencyEndAge: 18, includeCollege: false, collegeCost: 25000 };
      case 'person': return { role: 'partner', partnerIncome: 60000, partnerSavings: 10000, partnerRetirement: 25000, partnerDebts: 0, status: 'married' };
      case 'goal': return { targetAge: 65, spendingPercent: 70 };
      case 'business': return { currentBalance: 50000 };
      case 'windfall': return { amount: 50000 };
      default: return {};
    }
  };

  const renderSectionHeader = (title, emoji) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '1.25rem 0 0.5rem 0', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.25rem' }}>
      <span style={{ fontSize: '1.1rem' }}>{emoji}</span>
      <h5 style={{ margin: 0, fontSize: '0.95rem', fontWeight: '800', color: 'var(--text-primary)' }}>{title}</h5>
    </div>
  );

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

  const renderCard = (item) => {
    const p = item.properties || {};
    let subtitle = '';
    let details = '';

    if (item.type === 'person') {
      subtitle = `${item.properties?.role === 'self' ? 'You' : 'Partner'} · Age ${item.startAge}`;
      details = item.properties?.role === 'partner' ? `Salary: ${formatCurrency(p.partnerIncome)}/yr · Assets: ${formatCurrency(Number(p.partnerSavings) + Number(p.partnerRetirement))}` : 'Self clock basics';
    } else if (item.type === 'child') {
      subtitle = `Child · Age ${currentAge - item.startAge}`;
      details = `Arrival Age: ${item.startAge} · childcare Cost: ${formatCurrency(p.childcareCost)}/yr ${p.includeCollege ? '· 🎓 College planned' : ''}`;
    } else if (item.type === 'job') {
      subtitle = `Job · Age ${item.startAge} to ${item.endAge || 'Retirement'}`;
      details = `Income: ${formatCurrency(p.annualIncome)}/yr · Growth: ${p.growthRate}%`;
    } else if (item.type === 'property') {
      subtitle = `Property · Purchased Age ${item.startAge}`;
      details = `Value: ${formatCurrency(p.homeValue)} · Mortgage: ${p.mortgageAmount > 0 ? formatCurrency(p.mortgageAmount) : 'None'}`;
    } else if (item.type === 'account') {
      subtitle = `Account · ${p.accountType?.toUpperCase()}`;
      details = `Balance: ${formatCurrency(p.currentBalance)} · Save: ${formatCurrency(p.contributionAmount)}/mo · Allocation: ${p.allocation}`;
    } else if (item.type === 'debt') {
      subtitle = `Debt · ${p.debtType?.toUpperCase()}`;
      details = `Balance: ${formatCurrency(p.balance)} · Interest: ${p.interestRate}% · Payment: ${formatCurrency(p.monthlyPayment)}/mo`;
    } else if (item.type === 'goal') {
      subtitle = `Goal · Target Age ${p.targetAge}`;
      details = `Retirement spending: ${p.spendingPercent}% of pre-retirement expenses`;
    } else {
      subtitle = item.type;
      details = JSON.stringify(p);
    }

    // Get events attached to this object
    const itemEvents = (localLifePlan?.events || []).filter(e => e.objectId === item.id);

    return (
      <div key={item.id} className="life-profile-list-item-card life-profile-list-item" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '0.75rem', marginBottom: '0.5rem', background: 'var(--card-bg, #fff)', border: '1px solid var(--border-color)', borderRadius: '6px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <span style={{ fontWeight: '700', fontSize: '0.85rem', color: 'var(--text-primary)' }}>
              {item.type === 'account' ? getAccountDisplayName(item.name, p.accountType) : item.name}
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{subtitle}</span>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>{details}</span>
          </div>
          <div style={{ display: 'flex', gap: '0.4rem' }}>
            {item.properties?.role !== 'self' && (
              <>
                <button type="button" className="btn-secondary" onClick={() => handleStartEdit(item)} style={{ padding: '0.3rem 0.5rem', fontSize: '0.7rem' }}>
                  <Edit2 size={12} />
                </button>
                <button type="button" className="btn-secondary text-danger" onClick={() => handleDelete(item.id)} style={{ padding: '0.3rem 0.5rem', fontSize: '0.7rem', color: '#ef4444' }}>
                  <Trash2 size={12} />
                </button>
              </>
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

  if (editingItem) {
    return (
      <div className="life-profile-tab-content-panel" style={{ padding: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
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
      <div className="life-profile-tab-content-panel" style={{ padding: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
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

  return (
    <div className="life-profile-tab-content-panel" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: '800' }}>Life Items</h4>
          <p style={{ margin: '2px 0 0 0', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Configure all the durable aspects of your life clock in one place.</p>
        </div>
        <div style={{ position: 'relative' }}>
          <button 
            type="button" 
            className="btn-primary" 
            onClick={() => setShowTypeSelect(!showTypeSelect)}
            style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem', display: 'flex', alignItems: 'center', gap: '4px' }}
          >
            <Plus size={14} /> Add Life Item
          </button>
          {showTypeSelect && (
            <div style={{ position: 'absolute', right: 0, top: '100%', marginTop: '4px', background: 'var(--card-bg, #fff)', border: '1px solid var(--border-color)', borderRadius: '6px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', zIndex: 100, width: '200px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              {['job', 'property', 'account', 'debt', 'child', 'person', 'goal'].map(t => (
                <button 
                  key={t}
                  type="button" 
                  onClick={() => handleStartAdd(t)}
                  style={{ background: 'none', border: 'none', padding: '0.5rem 0.75rem', textAlign: 'left', fontSize: '0.78rem', cursor: 'pointer', hover: 'background: var(--border-color)', width: '100%' }}
                  className="type-select-btn"
                >
                  + {t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Basics Section */}
      <div className="life-profile-basics-section" style={{ background: 'var(--card-bg, #fff)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '1rem', display: 'flex', gap: '1rem' }}>
        <div className="life-profile-form-group" style={{ flex: 1, marginBottom: 0 }}>
          <label className="life-profile-label-small" style={{ fontWeight: '700', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Your Age</label>
          <input 
            type="number" 
            className="life-profile-input-field" 
            value={localLifePlan?.currentAge !== undefined ? localLifePlan.currentAge : currentAge} 
            onChange={(e) => {
              const val = Number(e.target.value);
              const updated = {
                ...localLifePlan,
                currentAge: val
              };
              setLocalLifePlan(updated);
              triggerSave({ lifePlan: updated });
            }} 
            style={{ width: '100%', marginTop: '4px' }}
          />
        </div>
        <div className="life-profile-form-group" style={{ flex: 1, marginBottom: 0 }}>
          <label className="life-profile-label-small" style={{ fontWeight: '700', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Life Expectancy</label>
          <input 
            type="number" 
            className="life-profile-input-field" 
            value={localLifePlan?.lifeExpectancy !== undefined ? localLifePlan.lifeExpectancy : lifeExpectancy} 
            onChange={(e) => {
              const val = Number(e.target.value);
              const updated = {
                ...localLifePlan,
                lifeExpectancy: val
              };
              setLocalLifePlan(updated);
              triggerSave({ lifePlan: updated });
            }} 
            style={{ width: '100%', marginTop: '4px' }}
          />
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {renderSectionHeader('People & Household', '👥')}
        {grouped.household.map(renderCard)}
        {grouped.household.length === 0 && <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', fontStyle: 'italic' }}>No household members</span>}

        {renderSectionHeader('Jobs & Income', '💼')}
        {grouped.income.map(renderCard)}
        {grouped.income.length === 0 && <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', fontStyle: 'italic' }}>No jobs configured</span>}

        {renderSectionHeader('Homes & Property', '🏠')}
        {grouped.property.map(renderCard)}
        {grouped.property.length === 0 && <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', fontStyle: 'italic' }}>No properties owned</span>}

        {renderSectionHeader('Accounts & Assets', '🏦')}
        {grouped.assets.map(renderCard)}

        {renderSectionHeader('Debts', '💸')}
        {grouped.debts.map(renderCard)}
        {grouped.debts.length === 0 && <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', fontStyle: 'italic' }}>No debts</span>}

        {renderSectionHeader('Goals', '🎯')}
        {grouped.goals.map(renderCard)}
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
        />
      </div>

      <div className="life-profile-row-two-col" style={{ display: 'flex', gap: '0.75rem' }}>
        <div className="life-profile-form-group" style={{ flex: 1 }}>
          <label className="life-profile-label-small">Start Age</label>
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
