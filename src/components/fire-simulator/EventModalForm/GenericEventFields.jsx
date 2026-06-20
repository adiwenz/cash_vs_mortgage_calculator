import React from 'react';
import { CurrencyInput, PercentInput } from '../../ui/PlainInputs';

export default function GenericEventFields({
  type,
  editingEvent,
  setEditingEvent
}) {
  return (
    <>
      {/* MOVE FIELDS */}
      {type === 'move' && (
        <>
          <div className="input-wrapper">
            <span className="input-name">Where? (Location Name)</span>
            <input
              type="text"
              className="input-number-box"
              style={{ width: '100%', textAlign: 'left' }}
              value={editingEvent.location}
              placeholder="e.g. Dominican Republic"
              onChange={(e) => setEditingEvent({ ...editingEvent, location: e.target.value })}
            />
          </div>
          <div className="input-wrapper">
            <span className="input-name">Moving Age</span>
            <input
              type="number"
              className="input-number-box"
              style={{ width: '100%' }}
              value={editingEvent.moveAge}
              onChange={(e) => setEditingEvent({ ...editingEvent, moveAge: parseInt(e.target.value) || 30 })}
            />
          </div>
           <div className="input-wrapper">
            <span className="input-name">New Annual Spending ($)</span>
            <CurrencyInput
              className="input-number-box"
              style={{ width: '100%' }}
              value={editingEvent.newSpending}
              onChange={(e) => setEditingEvent({ ...editingEvent, newSpending: parseFloat(e.target.value) || 0 })}
            />
          </div>
          <div className="input-wrapper">
            <span className="input-name">One-time Moving Cost ($)</span>
            <CurrencyInput
              className="input-number-box"
              style={{ width: '100%' }}
              value={editingEvent.movingCost !== undefined ? editingEvent.movingCost : 0}
              onChange={(e) => setEditingEvent({ ...editingEvent, movingCost: parseFloat(e.target.value) || 0 })}
            />
          </div>
        </>
      )}

      {/* WINDFALL FIELDS */}
      {type === 'windfall' && (
        <>
          <div className="input-wrapper">
            <span className="input-name">Age Received</span>
            <input
              type="number"
              className="input-number-box"
              style={{ width: '100%' }}
              value={editingEvent.ageReceived}
              onChange={(e) => setEditingEvent({ ...editingEvent, ageReceived: parseInt(e.target.value) || 30 })}
            />
          </div>
          <div className="input-wrapper">
            <span className="input-name">Amount ($)</span>
            <CurrencyInput
              className="input-number-box"
              style={{ width: '100%' }}
              value={editingEvent.amount}
              onChange={(e) => setEditingEvent({ ...editingEvent, amount: parseFloat(e.target.value) || 0 })}
            />
          </div>
          <div className="input-wrapper">
            <span className="input-name">Tax Rate (%)</span>
            <PercentInput
              className="input-number-box"
              style={{ width: '100%' }}
              value={editingEvent.taxRate}
              onChange={(e) => setEditingEvent({ ...editingEvent, taxRate: parseFloat(e.target.value) || 0 })}
            />
          </div>
        </>
      )}

      {/* COLLEGE FIELDS */}
      {type === 'college' && (
        <>
          <div className="input-wrapper">
            <span className="input-name">Start Age</span>
            <input
              type="number"
              className="input-number-box"
              style={{ width: '100%' }}
              value={editingEvent.startAge}
              onChange={(e) => setEditingEvent({ ...editingEvent, startAge: parseInt(e.target.value) || 30 })}
            />
          </div>
          <div className="input-wrapper">
            <span className="input-name">Annual Tuition Cost ($)</span>
            <CurrencyInput
              className="input-number-box"
              style={{ width: '100%' }}
              value={editingEvent.tuitionCost}
              onChange={(e) => setEditingEvent({ ...editingEvent, tuitionCost: parseFloat(e.target.value) || 0 })}
            />
          </div>
          <div className="input-wrapper">
            <span className="input-name">Duration (years)</span>
            <input
              type="number"
              className="input-number-box"
              style={{ width: '100%' }}
              value={editingEvent.duration}
              onChange={(e) => setEditingEvent({ ...editingEvent, duration: parseInt(e.target.value) || 4 })}
            />
          </div>
        </>
      )}

      {/* CUSTOM FIELDS */}
      {type === 'custom' && (
        <>
          <div className="input-wrapper">
            <span className="input-name">Event Name</span>
            <input
              type="text"
              className="input-number-box"
              style={{ width: '100%', textAlign: 'left' }}
              value={editingEvent.name}
              onChange={(e) => setEditingEvent({ ...editingEvent, name: e.target.value })}
            />
          </div>
          <div className="input-wrapper">
            <span className="input-name">Age</span>
            <input
              type="number"
              className="input-number-box"
              style={{ width: '100%' }}
              value={editingEvent.age}
              onChange={(e) => setEditingEvent({ ...editingEvent, age: parseInt(e.target.value) || 30 })}
            />
          </div>
          <div className="input-wrapper">
            <span className="input-name">Cash Flow ($: negative for cost)</span>
            <CurrencyInput
              className="input-number-box"
              style={{ width: '100%' }}
              value={editingEvent.amount}
              onChange={(e) => setEditingEvent({ ...editingEvent, amount: parseFloat(e.target.value) || 0 })}
            />
          </div>
        </>
      )}
    </>
  );
}
