// @vitest-environment jsdom
import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import LifeItemsWorkspace from './src/components/fire-simulator/life-profile/LifeItemsWorkspace';

describe('LifeItemsWorkspace Scoped Sidebar', () => {
  beforeEach(() => {
    cleanup();
  });

  const defaultProps = {
    isMobile: false,
    inputs: { currentAge: 35, lifeExpectancy: 85 },
    localLifePlan: {
      objects: [
        {
          id: 'self-person',
          type: 'person',
          properties: { role: 'self' },
          name: 'Me',
          startAge: 35,
          endAge: 85
        }
      ],
      events: []
    },
    setLocalLifePlan: vi.fn(),
    currentAge: 35,
    lifeExpectancy: 85,
    triggerSave: vi.fn(),
    editingItemId: null,
    setEditingItemId: vi.fn(),
    initialTab: null,
    handleCreateEvent: vi.fn()
  };

  test('1. Empty partner sidebar card/invite appears when no partner exists', () => {
    render(<LifeItemsWorkspace {...defaultProps} />);
    
    // Header for Partner collapsible section exists
    expect(screen.getByText('Partner')).toBeDefined();
    // Inner text showing no partner exists is rendered
    expect(screen.getByText('No partner added yet')).toBeDefined();
    // Add Partner button is present
    expect(screen.getAllByText('Add Partner').length).toBeGreaterThan(0);
  });

  test('2. Clicking + Add Partner calls handleCreateEvent("marriage")', () => {
    const handleCreateEventMock = vi.fn();
    render(
      <LifeItemsWorkspace 
        {...defaultProps} 
        handleCreateEvent={handleCreateEventMock} 
      />
    );

    // Find and click the Add Partner button
    const addPartnerBtns = screen.getAllByText('Add Partner');
    fireEvent.click(addPartnerBtns[0]);

    expect(handleCreateEventMock).toHaveBeenCalledWith('marriage');
  });

  test('3. Existing partner appears as Partner (Sarah)', () => {
    const planWithPartner = {
      objects: [
        ...defaultProps.localLifePlan.objects,
        {
          id: 'spouse-partner',
          type: 'person',
          name: 'Sarah',
          properties: { role: 'partner' },
          startAge: 35,
          endAge: 85
        }
      ]
    };

    render(
      <LifeItemsWorkspace 
        {...defaultProps} 
        localLifePlan={planWithPartner} 
      />
    );

    expect(screen.getByText('Partner (Sarah)')).toBeDefined();
  });

  test('4. Scoped categories correctly count and display items', () => {
    const planWithScopedItems = {
      objects: [
        ...defaultProps.localLifePlan.objects,
        {
          id: 'job-self',
          type: 'job',
          name: 'My Job',
          properties: { owner: 'self' },
          startAge: 35,
          endAge: 65
        },
        {
          id: 'spouse-partner',
          type: 'person',
          name: 'Sarah',
          properties: { role: 'partner' },
          startAge: 35,
          endAge: 85
        },
        {
          id: 'job-partner',
          type: 'job',
          name: 'Sarah Job',
          properties: { owner: 'partner' },
          startAge: 35,
          endAge: 65
        }
      ]
    };

    render(
      <LifeItemsWorkspace 
        {...defaultProps} 
        localLifePlan={planWithScopedItems} 
      />
    );

    // Under You (Self), count for Jobs & Income is 1
    // Under Sarah (Partner), count for Jobs & Income is also 1
    const counts = screen.getAllByText('1');
    expect(counts.length).toBeGreaterThanOrEqual(2);
  });

  test('5. Selecting Partner > Jobs shows only partner-owned jobs', () => {
    const planWithScopedItems = {
      objects: [
        ...defaultProps.localLifePlan.objects,
        {
          id: 'job-self',
          type: 'job',
          name: 'My Job',
          properties: { owner: 'self' },
          startAge: 35,
          endAge: 65
        },
        {
          id: 'spouse-partner',
          type: 'person',
          name: 'Sarah',
          properties: { role: 'partner' },
          startAge: 35,
          endAge: 85
        },
        {
          id: 'job-partner',
          type: 'job',
          name: 'Sarah Job',
          properties: { owner: 'partner' },
          startAge: 35,
          endAge: 65
        }
      ]
    };

    render(
      <LifeItemsWorkspace 
        {...defaultProps} 
        localLifePlan={planWithScopedItems} 
      />
    );

    // Expand partner if needed (already true by default)
    // Click on "Jobs & Income" category under Partner
    const partnerSection = screen.getByText('Partner (Sarah)');
    expect(partnerSection).toBeDefined();

    // Since both "Jobs & Income" buttons are rendered, let's find the one under Partner
    const jobButtons = screen.getAllByText('Jobs & Income');
    // Clicking the second one (under partner)
    fireEvent.click(jobButtons[1]);

    // Now the right content panel should display "Sarah Job" but NOT "My Job"
    expect(screen.getByText('Sarah Job')).toBeDefined();
    expect(screen.queryByText('My Job')).toBeNull();
  });

  test('6. Selecting Household > Accounts shows only shared/household accounts', () => {
    const planWithScopedItems = {
      objects: [
        ...defaultProps.localLifePlan.objects,
        {
          id: 'account-self',
          type: 'account',
          name: 'My Brokerage',
          properties: { owner: 'self', accountType: 'custom', currentBalance: 5000, allocation: '100/0' },
          startAge: 35,
          endAge: 85
        },
        {
          id: 'account-joint',
          type: 'account',
          name: 'Joint HYSA',
          properties: { owner: 'joint', accountType: 'custom', currentBalance: 10000, allocation: '100/0' },
          startAge: 35,
          endAge: 85
        }
      ]
    };

    render(
      <LifeItemsWorkspace 
        {...defaultProps} 
        localLifePlan={planWithScopedItems} 
      />
    );

    // Expand joint section
    const jointHeader = screen.getAllByText('Joint / Household')[0];
    fireEvent.click(jointHeader);

    // Click "Accounts & Assets" under Joint / Household
    const accountsButtons = screen.getAllByText('Accounts & Assets');
    fireEvent.click(accountsButtons[1]); // The second one (under Joint)

    // Should render "Joint HYSA" but NOT "My Brokerage"
    expect(screen.getByText('Joint HYSA')).toBeDefined();
    expect(screen.queryByText('My Brokerage')).toBeNull();
  });

  test('7. Creating a new item defaults ownership based on the active scope', () => {
    const planWithPartner = {
      objects: [
        ...defaultProps.localLifePlan.objects,
        {
          id: 'spouse-partner',
          type: 'person',
          name: 'Sarah',
          properties: { role: 'partner' },
          startAge: 35,
          endAge: 85
        }
      ]
    };

    const setLocalLifePlanMock = vi.fn();
    render(
      <LifeItemsWorkspace 
        {...defaultProps} 
        localLifePlan={planWithPartner} 
        setLocalLifePlan={setLocalLifePlanMock}
      />
    );

    // Select Partner -> Jobs & Income
    const jobButtons = screen.getAllByText('Jobs & Income');
    fireEvent.click(jobButtons[1]); // Under Sarah

    // Click "Add Job"
    const addJobBtn = screen.getByText('Add Job');
    fireEvent.click(addJobBtn);

    // Now look at the item editor's Owner dropdown. It should default to Partner
    const ownerSelect = screen.getByLabelText('Owner / Scope');
    expect(ownerSelect.value).toBe('partner');
  });
});
