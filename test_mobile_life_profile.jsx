// @vitest-environment jsdom
import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import LifeProfileModal from './src/components/fire-simulator/LifeProfileModal';
import { DEFAULT_FIRE_INPUTS } from './src/defaultInputs';

describe('Mobile Life Profile Modal Redesign', () => {
  let updateInputMock;
  let onCloseMock;

  beforeEach(() => {
    cleanup();
    updateInputMock = vi.fn();
    onCloseMock = vi.fn();
  });

  test('renders mobile root hub screen with 4 category cards', () => {
    render(
      <LifeProfileModal
        isOpen={true}
        onClose={onCloseMock}
        inputs={DEFAULT_FIRE_INPUTS}
        updateInput={updateInputMock}
        isMobile={true}
      />
    );

    // Assert header title and subtitle are rendered
    expect(screen.getByText('Life Profile')).toBeDefined();
    expect(screen.getByText('Tell us about your life so we can personalize your plan.')).toBeDefined();

    // Assert the 4 category cards exist
    expect(screen.getByText('Household')).toBeDefined();
    expect(screen.getByText('You, partner, children')).toBeDefined();
    
    expect(screen.getByText('Home')).toBeDefined();
    expect(screen.getByText('Where you live')).toBeDefined();
    
    expect(screen.getByText('Finances')).toBeDefined();
    expect(screen.getByText('Income, assets, debts')).toBeDefined();
    
    expect(screen.getByText('Work & Retirement')).toBeDefined();
    expect(screen.getByText('Career and retirement plans')).toBeDefined();
  });

  test('navigates to Household screen and edits You Age with blur auto-save', () => {
    render(
      <LifeProfileModal
        isOpen={true}
        onClose={onCloseMock}
        inputs={DEFAULT_FIRE_INPUTS}
        updateInput={updateInputMock}
        isMobile={true}
      />
    );

    // Tap Household card
    fireEvent.click(screen.getByText('You, partner, children'));

    // Verify Household section titles are shown
    expect(screen.getByText('You')).toBeDefined();
    expect(screen.getByText('Partner (Optional)')).toBeDefined();

    // Verify age input exists (default is 35)
    const ageInput = screen.getByLabelText('Age');
    expect(ageInput.value).toBe('35');

    // Change age and blur to trigger auto-save
    fireEvent.change(ageInput, { target: { value: '42' } });
    fireEvent.blur(ageInput);

    // Assert updateInput was called with new currentAge
    expect(updateInputMock).toHaveBeenCalledWith('currentAge', 42);
  });

  test('toggling partner updates relationship status immediately', () => {
    render(
      <LifeProfileModal
        isOpen={true}
        onClose={onCloseMock}
        inputs={DEFAULT_FIRE_INPUTS}
        updateInput={updateInputMock}
        isMobile={true}
      />
    );

    // Tap Household card
    fireEvent.click(screen.getByText('You, partner, children'));

    // Toggle partner switch (off to on)
    const toggle = screen.getByRole('checkbox');
    expect(toggle.checked).toBe(false);

    fireEvent.click(toggle);

    // Assert updateInput was called immediately for relationship status
    expect(updateInputMock).toHaveBeenCalledWith(
      'lifeProfile',
      expect.objectContaining({
        household: expect.objectContaining({
          status: 'married'
        })
      })
    );
  });

  test('navigates to Finances sub-menu and Income screen', () => {
    render(
      <LifeProfileModal
        isOpen={true}
        onClose={onCloseMock}
        inputs={DEFAULT_FIRE_INPUTS}
        updateInput={updateInputMock}
        isMobile={true}
      />
    );

    // Tap Finances card
    fireEvent.click(screen.getByText('Income, assets, debts'));

    // Verify Finances sub-menu links exist
    expect(screen.getByText('Income')).toBeDefined();
    expect(screen.getByText('Salary and extra income')).toBeDefined();
    expect(screen.getByText('Assets')).toBeDefined();
    expect(screen.getByText('Debts')).toBeDefined();

    // Tap Income link
    fireEvent.click(screen.getByText('Salary and extra income'));

    // Verify Income screen renders primary annual salary
    expect(screen.getByText('Primary Annual Income')).toBeDefined();
    const salaryLabel = screen.getByText('Salary');
    expect(salaryLabel).toBeDefined();
  });
});
