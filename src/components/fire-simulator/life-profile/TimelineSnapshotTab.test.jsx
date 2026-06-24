// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/react';
import TimelineSnapshotTab from './TimelineSnapshotTab';

afterEach(cleanup);

describe('TimelineSnapshotTab', () => {
  const defaultProjection = {
    minAge: 35,
    maxAge: 85,
    currentAge: 35,
    rows: [
      { id: 'relationship', items: [] },
      { id: 'housing', items: [] },
      { id: 'children', items: [] },
      { id: 'income', items: [] },
      { id: 'assets', items: [] },
      { id: 'debt', items: [] }
    ],
    upcomingMilestones: []
  };

  const defaultSnapshot = {
    relationshipStatus: 'single',
    housingStatus: 'rent',
    children: [],
    income: { annualIncome: 50000 },
    assets: { investedAssets: 10000 },
    debts: { activeDebts: [] }
  };

  const onSelectedAgeChangeMock = vi.fn();

  it('renders default today view correctly', () => {
    const { getByText, getByRole } = render(
      <TimelineSnapshotTab
        isMobile={false}
        inputs={{}}
        projection={defaultProjection}
        snapshot={defaultSnapshot}
        selectedAge={35}
        currentAge={35}
        lifeExpectancy={85}
        onSelectedAgeChange={onSelectedAgeChangeMock}
        expandedCategories={{}}
        setExpandedCategories={() => {}}
      />
    );

    // Header has today
    expect(getByText(/Life Snapshot/i)).toBeDefined();

    // Previous arrow is disabled because selectedAge === currentAge
    const prevBtn = getByRole('button', { name: 'Previous age' });
    expect(prevBtn.disabled).toBe(true);

    // Next arrow is enabled
    const nextBtn = getByRole('button', { name: 'Next age' });
    expect(nextBtn.disabled).toBe(false);
  });

  it('handles arrow clicks correctly', () => {
    const onAgeChange = vi.fn();
    const { getByRole } = render(
      <TimelineSnapshotTab
        isMobile={false}
        inputs={{}}
        projection={defaultProjection}
        snapshot={defaultSnapshot}
        selectedAge={40}
        currentAge={35}
        lifeExpectancy={85}
        onSelectedAgeChange={onAgeChange}
        expandedCategories={{}}
        setExpandedCategories={() => {}}
      />
    );

    const prevBtn = getByRole('button', { name: 'Previous age' });
    const nextBtn = getByRole('button', { name: 'Next age' });

    // Decrement button
    fireEvent.click(prevBtn);
    expect(onAgeChange).toHaveBeenCalledWith(39);

    // Increment button
    fireEvent.click(nextBtn);
    expect(onAgeChange).toHaveBeenCalledWith(41);
  });

  it('disables next button at lifeExpectancy', () => {
    const onAgeChange = vi.fn();
    const { getByRole } = render(
      <TimelineSnapshotTab
        isMobile={false}
        inputs={{}}
        projection={defaultProjection}
        snapshot={defaultSnapshot}
        selectedAge={85}
        currentAge={35}
        lifeExpectancy={85}
        onSelectedAgeChange={onAgeChange}
        expandedCategories={{}}
        setExpandedCategories={() => {}}
      />
    );

    const nextBtn = getByRole('button', { name: 'Next age' });
    expect(nextBtn.disabled).toBe(true);
  });

  it('handles timeline row click and converts to correct age', () => {
    const onAgeChange = vi.fn();
    const { container } = render(
      <TimelineSnapshotTab
        isMobile={false}
        inputs={{}}
        projection={defaultProjection}
        snapshot={defaultSnapshot}
        selectedAge={35}
        currentAge={35}
        lifeExpectancy={85}
        onSelectedAgeChange={onAgeChange}
        expandedCategories={{}}
        setExpandedCategories={() => {}}
      />
    );

    // Find a plot column
    const plotCols = container.querySelectorAll('.timeline-row-plot-col');
    expect(plotCols.length).toBeGreaterThan(0);

    // Mock getBoundingClientRect for target element
    const plotCol = plotCols[0];
    plotCol.getBoundingClientRect = vi.fn(() => ({
      left: 100,
      width: 500,
      right: 600,
      top: 10,
      bottom: 40,
      height: 30
    }));

    // Trigger click at clientX = 300 (which is 200px from left)
    // pct = 200 / 500 = 0.4
    // age = 35 + 0.4 * (85 - 35) = 35 + 20 = 55
    fireEvent.click(plotCol, { clientX: 300 });

    expect(onAgeChange).toHaveBeenCalledWith(55);
  });
});
