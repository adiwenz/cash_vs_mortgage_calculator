// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import useLifeProfileDraft from './useLifeProfileDraft';


describe('useLifeProfileDraft', () => {
  const defaultInputs = {
    currentAge: 35,
    lifeExpectancy: 85,
    simpleIncome: 50000,
    targetRetirementAge: 65,
    lifeEvents: [],
    lifeProfile: null
  };

  const updateInputMock = vi.fn();
  const onCloseMock = vi.fn();

  it('initializes default state correctly', () => {
    const { result } = renderHook(() =>
      useLifeProfileDraft({
        isOpen: true,
        onClose: onCloseMock,
        inputs: defaultInputs,
        updateInput: updateInputMock,
        initialTab: 'timeline',
        isMobile: false
      })
    );

    expect(result.current.localAge).toBe(35);
    expect(result.current.activeTab).toBe('timeline');
    expect(result.current.localProfile.household.status).toBe('single');
  });

  it('updates household field and does not auto-save on desktop', () => {
    const { result } = renderHook(() =>
      useLifeProfileDraft({
        isOpen: true,
        onClose: onCloseMock,
        inputs: defaultInputs,
        updateInput: updateInputMock,
        initialTab: 'household',
        isMobile: false
      })
    );

    act(() => {
      result.current.updateHouseholdField('status', 'married');
    });

    expect(result.current.localProfile.household.status).toBe('married');
    // On desktop, changing household status should not trigger auto-save immediately
    expect(updateInputMock).not.toHaveBeenCalled();
  });

  it('updates household status and triggers save on mobile', () => {
    const updateInputMobile = vi.fn();
    const { result } = renderHook(() =>
      useLifeProfileDraft({
        isOpen: true,
        onClose: onCloseMock,
        inputs: defaultInputs,
        updateInput: updateInputMobile,
        initialTab: 'household',
        isMobile: true
      })
    );

    act(() => {
      result.current.updateHouseholdField('status', 'married');
    });

    expect(result.current.localProfile.household.status).toBe('married');
    expect(updateInputMobile).toHaveBeenCalled();
  });

  it('adds and updates children', () => {
    const { result } = renderHook(() =>
      useLifeProfileDraft({
        isOpen: true,
        onClose: onCloseMock,
        inputs: defaultInputs,
        updateInput: updateInputMock,
        isMobile: false
      })
    );

    let childId;
    act(() => {
      childId = result.current.addChild();
    });

    expect(childId).toBeDefined();
    expect(result.current.localProfile.children.length).toBe(1);

    act(() => {
      result.current.updateChild(childId, 'name', 'Bobby');
    });

    expect(result.current.localProfile.children[0].name).toBe('Bobby');
  });

  it('clamps selectedAge when lifeExpectancy changes', () => {
    const { result } = renderHook(() =>
      useLifeProfileDraft({
        isOpen: true,
        inputs: {
          currentAge: 35,
          lifeExpectancy: 85,
          simpleIncome: 50000,
          targetRetirementAge: 65,
          lifeEvents: [],
          lifeProfile: null
        },
        onClose: () => {},
        updateInput: () => {}
      })
    );

    act(() => {
      result.current.setSelectedAge(80);
    });
    expect(result.current.selectedAge).toBe(80);

    act(() => {
      result.current.setLocalLifeExpectancy(70);
    });
    expect(result.current.selectedAge).toBe(70);
  });

  it('resets selectedAge to currentAge when currentAge increases past selectedAge', () => {
    const { result } = renderHook(() =>
      useLifeProfileDraft({
        isOpen: true,
        inputs: {
          currentAge: 35,
          lifeExpectancy: 85,
          simpleIncome: 50000,
          targetRetirementAge: 65,
          lifeEvents: [],
          lifeProfile: null
        },
        onClose: () => {},
        updateInput: () => {}
      })
    );

    act(() => {
      result.current.setSelectedAge(40);
    });
    expect(result.current.selectedAge).toBe(40);

    act(() => {
      result.current.setLocalAge(45);
    });
    expect(result.current.selectedAge).toBe(45);
  });

  it('keeps selectedAge unchanged when currentAge changes but selectedAge remains valid', () => {
    const { result } = renderHook(() =>
      useLifeProfileDraft({
        isOpen: true,
        inputs: {
          currentAge: 35,
          lifeExpectancy: 85,
          simpleIncome: 50000,
          targetRetirementAge: 65,
          lifeEvents: [],
          lifeProfile: null
        },
        onClose: () => {},
        updateInput: () => {}
      })
    );

    act(() => {
      result.current.setSelectedAge(45);
    });
    expect(result.current.selectedAge).toBe(45);

    act(() => {
      result.current.setLocalAge(40);
    });
    expect(result.current.selectedAge).toBe(45);
  });
});
