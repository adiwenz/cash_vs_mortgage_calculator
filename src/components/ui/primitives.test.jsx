// @vitest-environment jsdom
import React, { useState } from 'react';
import { describe, test, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import {
  AppModal,
  BottomSheet,
  FormSection,
  FormRow,
  OptionCard,
  CurrencyField,
  AgeField,
  PercentField,
  EmptyState,
  StatusBadge,
  InlineNotice
} from './index';

describe('Finley UI Primitives', () => {
  afterEach(cleanup);

  // 1. Render each primitive
  test('Renders AppModal, BottomSheet, FormSection, FormRow, EmptyState, StatusBadge, InlineNotice', () => {
    const handleClose = vi.fn();
    
    // AppModal
    const { rerender } = render(
      <AppModal isOpen={true} onClose={handleClose} title="Test Modal">
        <div>Modal Content</div>
      </AppModal>
    );
    expect(screen.getByText('Test Modal')).toBeDefined();
    expect(screen.getByText('Modal Content')).toBeDefined();
    
    const closeBtn = screen.getByLabelText('Close modal');
    fireEvent.click(closeBtn);
    expect(handleClose).toHaveBeenCalled();

    // BottomSheet
    rerender(
      <BottomSheet isOpen={true} onClose={handleClose} title="Test Sheet" emoji="💼">
        <div>Sheet Content</div>
      </BottomSheet>
    );
    expect(screen.getByText('Test Sheet')).toBeDefined();
    expect(screen.getByText('💼')).toBeDefined();

    // FormSection
    rerender(
      <FormSection title="Section Title" description="Section Desc">
        <input type="text" />
      </FormSection>
    );
    expect(screen.getByText('Section Title')).toBeDefined();
    expect(screen.getByText('Section Desc')).toBeDefined();

    // FormRow
    rerender(
      <FormRow label="Input Label" htmlFor="test-input" helperText="Helper Copy" error="Error Text">
        <input id="test-input" type="text" />
      </FormRow>
    );
    expect(screen.getByText('Input Label')).toBeDefined();
    expect(screen.getByText('Helper Copy')).toBeDefined();
    expect(screen.getByText('Error Text')).toBeDefined();
    const inputEl = screen.getByLabelText('Input Label');
    expect(inputEl).toBeDefined();
    expect(inputEl.getAttribute('aria-describedby')).toContain('test-input-error');

    // EmptyState
    rerender(
      <EmptyState title="No Data" description="No items found" icon="🔍" />
    );
    expect(screen.getByText('No Data')).toBeDefined();
    expect(screen.getByText('No items found')).toBeDefined();
    expect(screen.getByText('🔍')).toBeDefined();

    // StatusBadge
    rerender(
      <StatusBadge label="Paid" type="success" />
    );
    expect(screen.getByText('Paid')).toBeDefined();

    // InlineNotice
    rerender(
      <InlineNotice title="Warning Notice" message="Please be careful" type="warning" />
    );
    expect(screen.getByText('Warning Notice')).toBeDefined();
    expect(screen.getByText('Please be careful')).toBeDefined();
  });

  // 2. CurrencyField preserves cents
  test('CurrencyField preserves cents', () => {
    const handleChange = vi.fn();
    render(
      <CurrencyField
        label="Salary"
        htmlFor="salary-input"
        value={123.45}
        onChange={handleChange}
      />
    );
    const input = screen.getByLabelText('Salary');
    // For formatBudgetCurrency(123.45) in PlainInputs, it should display $123.45
    expect(input.value).toBe('$123.45');
  });

  // 3. AgeField clamps only on commit, not while typing
  test('AgeField clamps only on commit (blur or Enter)', () => {
    const handleChange = vi.fn();
    render(
      <AgeField
        label="Age"
        htmlFor="age-input"
        value={25}
        min={18}
        max={50}
        onChange={handleChange}
      />
    );
    const input = screen.getByLabelText('Age');
    expect(input.value).toBe('25');

    // Type an out-of-bounds value (e.g. 5)
    fireEvent.change(input, { target: { value: '5' } });
    // Local value should change to '5' (not clamped while typing)
    expect(input.value).toBe('5');
    expect(handleChange).not.toHaveBeenCalled();

    // Blur should trigger commit and clamp to min (18)
    fireEvent.blur(input);
    expect(input.value).toBe('18');
    expect(handleChange).toHaveBeenCalledWith(expect.objectContaining({
      target: expect.objectContaining({ value: 18 })
    }));

    // Type another out-of-bounds value (e.g. 60)
    fireEvent.change(input, { target: { value: '60' } });
    expect(input.value).toBe('60');

    // Enter key should trigger commit and clamp to max (50)
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(input.value).toBe('50');
    expect(handleChange).toHaveBeenLastCalledWith(expect.objectContaining({
      target: expect.objectContaining({ value: 50 })
    }));
  });

  // 4. OptionCard supports selected/unselected state and keyboard events
  test('OptionCard supports states and keyboard events', () => {
    const handleClick = vi.fn();
    const { rerender } = render(
      <OptionCard
        label="Option 1"
        description="Detail 1"
        selected={false}
        onClick={handleClick}
      />
    );
    
    let card = screen.getByRole('button');
    expect(card.getAttribute('aria-pressed')).toBe('false');

    rerender(
      <OptionCard
        label="Option 1"
        description="Detail 1"
        selected={true}
        onClick={handleClick}
      />
    );
    expect(card.getAttribute('aria-pressed')).toBe('true');

    // Keyboard trigger (Enter/Space)
    fireEvent.keyDown(card, { key: ' ' });
    expect(handleClick).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(card, { key: 'Enter' });
    expect(handleClick).toHaveBeenCalledTimes(2);
  });
});
