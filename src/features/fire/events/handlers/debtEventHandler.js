import { calculateAmortizedLoanPayoffAge } from '../../../../domain/debt/debtProjection.js';
import { 
  cloneInputs, 
  createStandardResult, 
  normalizeEventAge, 
  normalizeCurrency, 
  normalizePercent 
} from './eventHandlerUtils.js';

export const debtEventHandler = {
  edit(baseEvent, inputs) {
    if (!baseEvent) return null;

    if (baseEvent.type === 'borrowing') {
      const payoff = inputs.lifeEvents?.find(e => e.type === 'payoffPlan' && e.borrowingId === baseEvent.id);
      return {
        ...baseEvent,
        interestRate: baseEvent.interestRate !== undefined ? baseEvent.interestRate : 5.0,
        minPayment: baseEvent.minPayment !== undefined ? baseEvent.minPayment : 100,
        payoffPlanEnabled: !!payoff,
        extraPayment: payoff ? payoff.extraPayment : 100,
        targetPayoffAge: payoff ? payoff.targetPayoffAge : null,
        type: 'borrowing'
      };
    }

    if (baseEvent.type === 'payoffPlan') {
      return {
        ...baseEvent,
        type: 'payoffPlan'
      };
    }

    return { ...baseEvent };
  },

  save(editingEvent, inputs) {
    const newInputs = cloneInputs(inputs);
    const type = editingEvent.type;
    
    let savedEvent = null;
    const result = createStandardResult(newInputs);

    if (type === 'borrowing') {
      const borrowId = editingEvent.id && editingEvent.id.startsWith('borrowing-') ? editingEvent.id : `borrowing-${Date.now()}`;
      
      const balance = normalizeCurrency(editingEvent.balance, 0);
      const apr = normalizePercent(editingEvent.interestRate, 5.0);
      const minPayment = normalizeCurrency(editingEvent.minPayment, 100);
      const timing = editingEvent.timing || (editingEvent.isExisting !== false ? 'current' : 'future');
      const isExisting = timing === 'current';
      const startAge = isExisting ? newInputs.currentAge : normalizeEventAge(editingEvent.startAge, newInputs.currentAge + 1);

      const newEventObj = {
        id: borrowId,
        type: 'borrowing',
        enabled: true,
        borrowingType: editingEvent.borrowingType,
        name: editingEvent.name || 'Borrowing',
        balance,
        interestRate: apr,
        minPayment,
        startAge,
        notes: editingEvent.notes || '',
        isExisting,
        timing,
        payoffPlanEnabled: !!editingEvent.payoffPlanEnabled
      };

      if (!newInputs.lifeEvents) {
        newInputs.lifeEvents = [];
      }
      newInputs.lifeEvents = newInputs.lifeEvents.filter(e => e.id !== borrowId && e.id !== editingEvent.id);

      if (newEventObj.payoffPlanEnabled) {
        const existingPayoff = newInputs.lifeEvents.find(e => e.type === 'payoffPlan' && e.borrowingId === borrowId);
        const extraPmt = existingPayoff ? (Number(existingPayoff.extraPayment) || 0) : 100;
        const linkedVal = existingPayoff ? existingPayoff.linked !== false : true;

        const startAgeForPayoff = linkedVal ? newEventObj.startAge : (existingPayoff ? Number(existingPayoff.startAge) : newEventObj.startAge);
        
        // Calculate payoff age
        const payoffAge = calculateAmortizedLoanPayoffAge(balance, apr, minPayment + extraPmt, startAgeForPayoff);

        const payoffObj = {
          id: existingPayoff ? existingPayoff.id : `payoffPlan-${Date.now()}`,
          type: 'payoffPlan',
          enabled: true,
          name: `Payoff Plan: ${newEventObj.name}`,
          borrowingId: borrowId,
          linked: linkedVal,
          extraPayment: extraPmt,
          startAge: startAgeForPayoff,
          payoffAge: payoffAge === Infinity ? null : payoffAge,
          notes: existingPayoff ? existingPayoff.notes || '' : ''
        };

        // Filter and add both objects
        newInputs.lifeEvents = newInputs.lifeEvents.filter(e => e.id !== payoffObj.id && !(e.type === 'payoffPlan' && e.borrowingId === borrowId));
        newInputs.lifeEvents.push(newEventObj, payoffObj);
        result.linkedEventsCreated.push(payoffObj);
      } else {
        // Remove payoff plans associated with this borrowing
        newInputs.lifeEvents = newInputs.lifeEvents.filter(e => !(e.type === 'payoffPlan' && e.borrowingId === borrowId));
        newInputs.lifeEvents.push(newEventObj);
      }

      savedEvent = newEventObj;
    } else if (type === 'payoffPlan') {
      const payoffId = editingEvent.id && editingEvent.id.startsWith('payoffPlan-') ? editingEvent.id : `payoffPlan-${Date.now()}`;
      const borrowing = newInputs.lifeEvents?.find(b => b.id === editingEvent.borrowingId);
      
      let startAge = Number(editingEvent.startAge);
      if (editingEvent.linked !== false && borrowing) {
        startAge = Number(borrowing.startAge);
      }

      const balance = borrowing ? Number(borrowing.balance) || 0 : 0;
      const interestRate = borrowing ? Number(borrowing.interestRate) || 0 : 0;
      const minPayment = borrowing ? Number(borrowing.minPayment) || 0 : 0;
      const extraPayment = Number(editingEvent.extraPayment) || 0;

      let payoffAge = calculateAmortizedLoanPayoffAge(balance, interestRate, minPayment + extraPayment, startAge);

      if (editingEvent.targetPayoffAge && editingEvent.targetPayoffAge > startAge) {
        payoffAge = Number(editingEvent.targetPayoffAge);
      }

      const newEventObj = {
        id: payoffId,
        type: 'payoffPlan',
        enabled: true,
        name: editingEvent.name || 'Payoff Plan',
        borrowingId: editingEvent.borrowingId,
        linked: editingEvent.linked !== false,
        extraPayment: extraPayment,
        startAge: startAge,
        payoffAge: payoffAge === Infinity ? null : payoffAge,
        targetPayoffAge: editingEvent.targetPayoffAge || null,
        notes: editingEvent.notes || ''
      };

      if (!newInputs.lifeEvents) {
        newInputs.lifeEvents = [];
      }
      newInputs.lifeEvents = newInputs.lifeEvents.filter(e => e.id !== payoffId && e.id !== editingEvent.id);
      newInputs.lifeEvents.push(newEventObj);

      savedEvent = newEventObj;
    }

    result.updatedInputs = newInputs;
    result.savedEvent = savedEvent;
    return result;
  },

  delete(matchEvent, inputs) {
    const newInputs = cloneInputs(inputs);
    const deletedEvents = [];

    if (newInputs.lifeEvents) {
      if (matchEvent.type === 'borrowing') {
        newInputs.lifeEvents = newInputs.lifeEvents.filter(e => {
          if (e.id === matchEvent.id || e.id === matchEvent.originalId) {
            deletedEvents.push(e);
            return false;
          }
          if (e.type === 'payoffPlan' && e.borrowingId === matchEvent.id) {
            deletedEvents.push(e);
            return false;
          }
          return true;
        });
      } else if (matchEvent.type === 'payoffPlan') {
        newInputs.lifeEvents = newInputs.lifeEvents.filter(e => {
          if (e.id === matchEvent.id || e.id === matchEvent.originalId) {
            deletedEvents.push(e);
            return false;
          }
          return true;
        });

        // Set parent borrowing to disable payoff plan
        newInputs.lifeEvents = newInputs.lifeEvents.map(e => {
          if (e.id === matchEvent.borrowingId && e.type === 'borrowing') {
            return { ...e, payoffPlanEnabled: false };
          }
          return e;
        });
      }
    }

    const result = createStandardResult(newInputs, null);
    result.deletedEvents = deletedEvents;
    return result;
  }
};
