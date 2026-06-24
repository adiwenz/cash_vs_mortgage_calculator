// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import LegacyLifeProfileModal from '../LifeProfileModal';


describe('LifeProfileModal Compatibility Import', () => {
  it('renders LegacyLifeProfileModal correctly when imported from the legacy path', () => {
    const defaultInputs = {
      currentAge: 35,
      lifeExpectancy: 85,
      simpleIncome: 50000,
      targetRetirementAge: 65,
      lifeEvents: [],
      lifeProfile: null
    };

    const { queryByText } = render(
      <LegacyLifeProfileModal
        isOpen={true}
        onClose={() => {}}
        inputs={defaultInputs}
        updateInput={() => {}}
        isMobile={false}
      />
    );

    // Verify the header is rendered
    expect(queryByText(/Life Planner/i)).toBeTruthy();
  });
});
