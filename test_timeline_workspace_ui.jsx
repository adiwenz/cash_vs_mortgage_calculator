// @vitest-environment jsdom
import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import LifeProfileModal from './src/components/fire-simulator/LifeProfileModal';
import { DEFAULT_FIRE_INPUTS } from './src/defaultInputs';

describe('Timeline Workspace UI Phase 2D Tests', () => {
  let updateInputMock;
  let onCloseMock;

  beforeEach(() => {
    cleanup();
    updateInputMock = vi.fn();
    onCloseMock = vi.fn();
  });

  test('Timeline tab renders by default with title and subtitle', () => {
    render(
      <LifeProfileModal
        isOpen={true}
        onClose={onCloseMock}
        inputs={DEFAULT_FIRE_INPUTS}
        updateInput={updateInputMock}
        isMobile={false}
      />
    );

    // Verify modal header matches "Life Planner"
    expect(screen.getByText(/Life Planner/)).toBeDefined();

    // Verify Timeline header title and subtitle render
    const titles = screen.getAllByText('Timeline');
    expect(titles.length).toBeGreaterThan(0);
    expect(screen.getByText('See how the major aspects of your life change over time.')).toBeDefined();
  });

  test('Renders rows from getTimelineProjection', () => {
    render(
      <LifeProfileModal
        isOpen={true}
        onClose={onCloseMock}
        inputs={DEFAULT_FIRE_INPUTS}
        updateInput={updateInputMock}
        isMobile={false}
      />
    );

    // Verify expected rows (use getAllByText for labels that appear in both canvas rows and snapshot rows)
    expect(screen.getAllByText('Relationship').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Housing').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Children').length).toBeGreaterThan(0);
    expect(screen.getByText('Education')).toBeDefined();
    expect(screen.getAllByText('Debt').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Income').length).toBeGreaterThan(0);
    expect(screen.getByText('Assets / Net Worth')).toBeDefined();
  });

  test('Today marker renders at currentAge', () => {
    render(
      <LifeProfileModal
        isOpen={true}
        onClose={onCloseMock}
        inputs={{
          ...DEFAULT_FIRE_INPUTS,
          currentAge: 38
        }}
        updateInput={updateInputMock}
        isMobile={false}
      />
    );

    // Verify today's age badge on the axis
    expect(screen.getByText('38')).toBeDefined();
    expect(screen.getByText('Today')).toBeDefined();
  });

  test('Life Snapshot panel renders current-age data', () => {
    render(
      <LifeProfileModal
        isOpen={true}
        onClose={onCloseMock}
        inputs={{
          ...DEFAULT_FIRE_INPUTS,
          currentAge: 35
        }}
        updateInput={updateInputMock}
        isMobile={false}
      />
    );

    expect(screen.getByText('Life Snapshot')).toBeDefined();
    expect(screen.getByText('View your life at any age.')).toBeDefined();

    // The selector-age header should show Age 35 (Today)
    expect(screen.getByText('Age 35 (Today)')).toBeDefined();

    // Snapshot fields should render
    expect(screen.getAllByText('Relationship').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Housing').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Net Worth').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Debts').length).toBeGreaterThan(0);
  });

  test('Upcoming milestones render correctly', () => {
    // Add custom milestone events in the future
    const inputsWithMilestones = {
      ...DEFAULT_FIRE_INPUTS,
      currentAge: 35,
      lifeEvents: [
        { id: 'ev-married', type: 'marriage', enabled: true, age: 40, name: 'Get Married' },
        { id: 'ev-buyhouse', type: 'buyHouse', enabled: true, purchaseAge: 45, age: 45, homePrice: 500000, name: 'Buy Home' }
      ]
    };

    render(
      <LifeProfileModal
        isOpen={true}
        onClose={onCloseMock}
        inputs={inputsWithMilestones}
        updateInput={updateInputMock}
        isMobile={false}
      />
    );

    // Verify upcoming milestones titles and age/timing text
    expect(screen.getByText('Upcoming Milestones')).toBeDefined();
    expect(screen.getAllByText('Get Married').length).toBeGreaterThan(0);
    expect(screen.getByText('Age 40 (In 5 years)')).toBeDefined();
    expect(screen.getAllByText('Buy Home').length).toBeGreaterThan(0);
    expect(screen.getByText('Age 45 (In 10 years)')).toBeDefined();
  });

  test('Timeline interactions do not mutate scenario state', () => {
    render(
      <LifeProfileModal
        isOpen={true}
        onClose={onCloseMock}
        inputs={DEFAULT_FIRE_INPUTS}
        updateInput={updateInputMock}
        isMobile={false}
      />
    );

    // Check that updateInput is NOT called when mounting/rendering
    expect(updateInputMock).not.toHaveBeenCalled();
  });
});
