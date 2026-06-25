// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/react';
import TimelineSnapshotTab, { ageToTimelinePercent, getTimelineBarStyle } from './TimelineSnapshotTab';
import { getLifeSnapshotAtAge } from '../../../models/lifeTimeline/lifeSnapshotSelectors.js';
import { DEFAULT_FIRE_INPUTS } from '../../../defaultInputs.js';

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

  describe('timeline bar positioning math and helpers', () => {
    it('correctly maps age to timeline percent', () => {
      expect(ageToTimelinePercent(35, 35, 85)).toBe(0);
      expect(ageToTimelinePercent(85, 35, 85)).toBe(100);
      expect(ageToTimelinePercent(60, 35, 85)).toBe(50);
      expect(ageToTimelinePercent(48, 35, 85)).toBe(26);
      expect(ageToTimelinePercent(66, 35, 85)).toBe(62);
    });

    it('returns null for invalid inputs in ageToTimelinePercent', () => {
      expect(ageToTimelinePercent(NaN, 35, 85)).toBeNull();
      expect(ageToTimelinePercent(48, null, 85)).toBeNull();
      expect(ageToTimelinePercent(48, 35, undefined)).toBeNull();
      expect(ageToTimelinePercent(48, 85, 35)).toBeNull();
      expect(ageToTimelinePercent(48, 35, 35)).toBeNull();
    });

    it('correctly calculates timeline bar style including clamping', () => {
      // Normal within range
      const style1 = getTimelineBarStyle({
        startAge: 48,
        endAge: 66,
        minAge: 35,
        maxAge: 85
      });
      expect(style1).toEqual({
        left: '26%',
        width: '36%'
      });

      // Clamped start age
      const style2 = getTimelineBarStyle({
        startAge: 30,
        endAge: 66,
        minAge: 35,
        maxAge: 85
      });
      expect(style2).toEqual({
        left: '0%',
        width: '62%'
      });

      // Clamped end age
      const style3 = getTimelineBarStyle({
        startAge: 48,
        endAge: 90,
        minAge: 35,
        maxAge: 85
      });
      expect(style3).toEqual({
        left: '26%',
        width: '74%'
      });
    });

    it('returns null for invalid inputs or zero/negative width in getTimelineBarStyle', () => {
      // Invalid ages
      expect(getTimelineBarStyle({ startAge: NaN, endAge: 66, minAge: 35, maxAge: 85 })).toBeNull();
      
      // MinAge >= MaxAge
      expect(getTimelineBarStyle({ startAge: 48, endAge: 66, minAge: 85, maxAge: 35 })).toBeNull();
      expect(getTimelineBarStyle({ startAge: 48, endAge: 66, minAge: 35, maxAge: 35 })).toBeNull();

      // endAge <= startAge
      expect(getTimelineBarStyle({ startAge: 66, endAge: 48, minAge: 35, maxAge: 85 })).toBeNull();
      expect(getTimelineBarStyle({ startAge: 48, endAge: 48, minAge: 35, maxAge: 85 })).toBeNull();

      // Out of bounds start age >= maxAge
      expect(getTimelineBarStyle({ startAge: 90, endAge: 100, minAge: 35, maxAge: 85 })).toBeNull();

      // Out of bounds end age <= minAge
      expect(getTimelineBarStyle({ startAge: 20, endAge: 30, minAge: 35, maxAge: 85 })).toBeNull();
    });
  });

  describe('Snapshot Income render verification check', () => {
    it('verifies snapshot render output at age 44, 66, and 78', () => {
      const inputs = {
        ...DEFAULT_FIRE_INPUTS,
        currentAge: 35,
        useLifeProfile: true,
        inflationRate: 3.0,
        lifeEvents: [
          { id: 'ss-1', type: 'socialSecurity', enabled: true, monthlyBenefit: 2000, claimingAge: 67 }
        ],
        lifePlan: {
          currentAge: 35,
          lifeExpectancy: 85,
          objects: [
            {
              id: 'job-1',
              type: 'job',
              name: 'Job 1',
              startAge: 35,
              endAge: 65,
              properties: {
                annualIncome: 50000,
                growthRate: 3
              }
            }
          ],
          events: [
            {
              id: 'event-ss',
              type: 'socialSecurity',
              age: 67,
              objectId: 'self-person',
              mutation: {
                claimingAge: 67,
                monthlyBenefit: 2000
              }
            }
          ],
          assumptions: {}
        }
      };

      const ages = [44, 66, 78];
      ages.forEach(age => {
        const snapshot = getLifeSnapshotAtAge(inputs, age, { displayMode: 'future' });
        render(
          <TimelineSnapshotTab
            isMobile={false}
            inputs={inputs}
            projection={defaultProjection}
            snapshot={snapshot}
            selectedAge={age}
            currentAge={35}
            lifeExpectancy={85}
            onSelectedAgeChange={onSelectedAgeChangeMock}
            expandedCategories={{}}
            setExpandedCategories={() => {}}
          />
        );
      });
    });
  });
});
