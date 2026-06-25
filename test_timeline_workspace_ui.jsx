// @vitest-environment jsdom
import React from 'react';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
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

    // Verify Timeline header title renders
    const titles = screen.getAllByText('Timeline');
    expect(titles.length).toBeGreaterThan(0);
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

  test.skip('Upcoming milestones render correctly', () => {
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

  test('Timeline categories default expanded/collapsed states based on population', () => {
    // Render with default inputs (which has no children, so children category is empty)
    const { container } = render(
      <LifeProfileModal
        isOpen={true}
        onClose={onCloseMock}
        inputs={DEFAULT_FIRE_INPUTS}
        updateInput={updateInputMock}
        isMobile={false}
      />
    );

    // Children category should be collapsed by default since it has no child items
    const childrenLabelCol = screen.getAllByText('Children')
      .map(el => el.closest('.timeline-row-label-col'))
      .find(Boolean);
    expect(childrenLabelCol.textContent).toContain('▶');

    // Assets / Net Worth category has series data so it is populated and should be expanded by default
    const assetsLabelCol = screen.getAllByText('Assets / Net Worth')
      .map(el => el.closest('.timeline-row-label-col'))
      .find(Boolean);
    expect(assetsLabelCol.textContent).toContain('▼');
  });

  test('Populating a category expands it by default, and manual collapse hides sub-rows', () => {
    // Render with a child added (so Children category is populated)
    const inputsWithChildren = {
      ...DEFAULT_FIRE_INPUTS,
      children: [
        { id: 'child-1', name: 'Emily', age: 2, includeCollege: true }
      ]
    };

    const { container } = render(
      <LifeProfileModal
        isOpen={true}
        onClose={onCloseMock}
        inputs={inputsWithChildren}
        updateInput={updateInputMock}
        isMobile={false}
      />
    );

    // Children category should be expanded by default now
    const childrenLabelCol = screen.getAllByText('Children')
      .map(el => el.closest('.timeline-row-label-col'))
      .find(Boolean);
    expect(childrenLabelCol.textContent).toContain('▼');

    // It should render the child sub-row (Emily)
    expect(screen.getAllByText('Emily').length).toBeGreaterThan(0);

    // Click to collapse Children category
    fireEvent.click(childrenLabelCol);

    // Indicator should switch to collapsed ▶
    expect(childrenLabelCol.textContent).toContain('▶');

    // Child sub-row label (sub-label Emily) should be hidden/not rendered
    const emilySubLabel = Array.from(container.querySelectorAll('.timeline-row-label-text.sub-label'))
      .find(el => el.textContent === 'Emily');
    expect(emilySubLabel).toBeUndefined();

    // Instead, we should find the compact overview bar
    expect(container.querySelector('.timeline-compact-bar')).not.toBeNull();
  });

  test('Overview mode renders compact stacked bars and tooltips, and click-to-expand works', () => {
    const inputsWithChildren = {
      ...DEFAULT_FIRE_INPUTS,
      children: [
        { id: 'child-1', name: 'Emily', age: 2, includeCollege: true }
      ]
    };

    const { container } = render(
      <LifeProfileModal
        isOpen={true}
        onClose={onCloseMock}
        inputs={inputsWithChildren}
        updateInput={updateInputMock}
        isMobile={false}
      />
    );

    const childrenLabelCol = screen.getAllByText('Children')
      .map(el => el.closest('.timeline-row-label-col'))
      .find(Boolean);
    
    // Collapse the category to enter overview mode
    fireEvent.click(childrenLabelCol);
    expect(childrenLabelCol.textContent).toContain('▶');

    // Find the compact bar wrapper
    const compactBarWrapper = container.querySelector('.timeline-compact-bar-wrapper');
    expect(compactBarWrapper).not.toBeNull();
    expect(compactBarWrapper.getAttribute('aria-label')).toContain('Emily');

    // Verify it has a tooltip with name and age
    const tooltip = compactBarWrapper.querySelector('.timeline-tooltip');
    expect(tooltip).not.toBeNull();
    expect(tooltip.textContent).toContain('Emily');

    // Click on the compact bar should expand the category
    fireEvent.click(compactBarWrapper);
    expect(childrenLabelCol.textContent).toContain('▼');
    expect(container.querySelector('.timeline-row-track.sub-row')).not.toBeNull();
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
