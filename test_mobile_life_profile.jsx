// @vitest-environment jsdom
import React from 'react';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
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

  test('renders mobile modal with new tabs and Life Items active', () => {
    render(
      <LifeProfileModal
        isOpen={true}
        onClose={onCloseMock}
        inputs={DEFAULT_FIRE_INPUTS}
        updateInput={updateInputMock}
        isMobile={true}
        initialTab="lifeItems"
      />
    );

    // Assert header title is rendered
    expect(screen.getAllByText('Life Items')[0]).toBeDefined();

    // Assert new tabs exist
    expect(screen.getByText('📈 Timeline')).toBeDefined();
    expect(screen.getByText('📁 Life Items')).toBeDefined();
    expect(screen.getByText('📋 Snapshot')).toBeDefined();
    expect(screen.getByText('⚙️ Settings')).toBeDefined();

    // Assert self-person card is visible
    expect(screen.getByText('You')).toBeDefined();
    expect(screen.getByText('Your Age')).toBeDefined();
    expect(screen.getByText('35')).toBeDefined();
    expect(screen.getByText('Life Expectancy')).toBeDefined();
    expect(screen.getByText('85')).toBeDefined();
  });

  test('edits You Age with auto-save on mobile', () => {
    render(
      <LifeProfileModal
        isOpen={true}
        onClose={onCloseMock}
        inputs={DEFAULT_FIRE_INPUTS}
        updateInput={updateInputMock}
        isMobile={true}
        initialTab="lifeItems"
      />
    );

    // Click Edit button on the "You" card
    const editBtn = screen.getByTitle('Edit You');
    expect(editBtn).toBeDefined();
    fireEvent.click(editBtn);

    // Find and modify Your Age input
    const ageLabel = screen.getByText('Your Age');
    const parent = ageLabel.parentElement;
    const input = parent.querySelector('input');
    expect(input).toBeDefined();
    expect(input.value).toBe('35');

    // Change to 42
    fireEvent.change(input, { target: { value: '42' } });

    // Save the item
    const saveItemBtn = screen.getByRole('button', { name: /Save Item/i });
    expect(saveItemBtn).toBeDefined();
    fireEvent.click(saveItemBtn);

    // Assert updateInput was called with new lifePlan containing currentAge: 42
    expect(updateInputMock).toHaveBeenCalledWith(
      expect.objectContaining({
        lifePlan: expect.objectContaining({
          currentAge: 42
        })
      })
    );
  });

  test('renders Life Items categories on mobile', () => {
    render(
      <LifeProfileModal
        isOpen={true}
        onClose={onCloseMock}
        inputs={DEFAULT_FIRE_INPUTS}
        updateInput={updateInputMock}
        isMobile={true}
        initialTab="lifeItems"
      />
    );

    // Check categories
    expect(screen.getByText('People & Household')).toBeDefined();
    expect(screen.getByText('Jobs & Income')).toBeDefined();
    expect(screen.getByText('Homes & Property')).toBeDefined();
    expect(screen.getByText('Accounts & Assets')).toBeDefined();
    expect(screen.getByText('Debts')).toBeDefined();
    expect(screen.getByText('Other')).toBeDefined();
  });
});
