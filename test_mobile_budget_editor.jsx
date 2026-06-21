// @vitest-environment jsdom
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import FireSimulator from './src/components/FireSimulator';

// Mock Recharts to avoid layout/sizable errors in jsdom
vi.mock('recharts', () => {
  return {
    ResponsiveContainer: ({ children }) => <div data-testid="ResponsiveContainer">{children}</div>,
    LineChart: ({ children }) => <div data-testid="LineChart">{children}</div>,
    Line: () => <div data-testid="Line" />,
    XAxis: () => <div data-testid="XAxis" />,
    YAxis: () => <div data-testid="YAxis" />,
    CartesianGrid: () => <div data-testid="CartesianGrid" />,
    Tooltip: () => <div data-testid="Tooltip" />,
    Legend: () => <div data-testid="Legend" />,
    ReferenceLine: () => <div data-testid="ReferenceLine" />,
    ReferenceDot: () => <div data-testid="ReferenceDot" />,
    ReferenceArea: () => <div data-testid="ReferenceArea" />,
    AreaChart: ({ children }) => <div data-testid="AreaChart">{children}</div>,
    Area: () => <div data-testid="Area" />,
  };
});

// Mock ResizeObserver
globalThis.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

describe('Mobile Budget Phase Editor', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    
    // Set window width to simulate mobile viewport
    window.innerWidth = 400;
    window.dispatchEvent(new Event('resize'));
  });

  test('Mobile Budget Modal - Shows breakdown, opens category sheet, updates live, Done/Save/Cancel', async () => {
    render(<FireSimulator />);
    
    // Click on the Standard working phase card to expand it (wait for it to render)
    const phaseCard = await screen.findByText((content, element) => {
      return element.className === 'mobile-phase-card-title' && content === 'Working';
    });
    fireEvent.click(phaseCard);

    // Open Budget Modal on mobile by clicking the Edit Budget Configuration button (wait for it to render)
    const editBtn = await screen.findByText(/Edit Budget Configuration/i);
    fireEvent.click(editBtn);
    
    // Assert Modal is Open
    expect(screen.getByRole('heading', { name: /Working Budget/i })).toBeDefined();

    // Verify copy
    expect(screen.getByText(/Tap Needs, Wants, or Savings to edit this phase./i)).toBeDefined();

    // Verify breakdown card labels and headers are visible
    // Tapping Needs opens fixed category sheet
    const needsRow = screen.getByText('Housing, food, healthcare');
    fireEvent.click(needsRow);

    // Verify the category sheet header is visible
    expect(screen.getByRole('heading', { name: /Needs Allocation/i })).toBeDefined();

    // Find an input field inside the sheet (e.g. Housing)
    const housingWrapper = screen.getByText('Housing (Rent/Mortgage)');
    const housingInput = housingWrapper.closest('div').querySelector('input');
    
    expect(housingInput).toBeDefined();
    
    // Check initial value
    expect(housingInput.value).toBe('1,500');

    // Edit value to 1800
    fireEvent.change(housingInput, { target: { value: '1800' } });
    expect(housingInput.value).toBe('1,800');

    // Tapping Done closes the sheet
    const doneBtn = screen.getByRole('button', { name: /Done/i });
    fireEvent.click(doneBtn);

    // Verify Needs Allocation sheet is closed (heading no longer visible)
    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: /Needs Allocation/i })).toBeNull();
    });

    // Check that Needs total on the main panel updated live (needsTotal = 1500 -> 1800, so +300. original needs total: 1500+300+400+400+300 = 2900. New: 3200)
    expect(screen.getAllByText('$3,200/mo')[0]).toBeDefined();

    // Tapping Wants opens Wants fixed sheet
    const wantsRow = screen.getByText('Dining, travel, fun');
    fireEvent.click(wantsRow);
    expect(screen.getByRole('heading', { name: /Wants Allocation/i })).toBeDefined();

    const leisureWrapper = screen.getByText('Leisure & Travel');
    const leisureInput = leisureWrapper.closest('div').querySelector('input');
    expect(leisureInput.value).toBe('299.84');
    fireEvent.change(leisureInput, { target: { value: '500' } });
    
    // Tap Done
    const doneBtn2 = screen.getByRole('button', { name: /Done/i });
    fireEvent.click(doneBtn2);
    
    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: /Wants Allocation/i })).toBeNull();
    });
    
    expect(screen.getAllByText('$841.83/mo')[0]).toBeDefined();

    // Tapping Savings opens Savings fixed sheet
    const savingsRow = screen.getByText('Brokerage, cash, retirement');
    fireEvent.click(savingsRow);
    expect(screen.getByRole('heading', { name: /Savings Allocation/i })).toBeDefined();

    const brokerageWrapper = screen.getByText('Taxable Brokerage');
    const brokerageRow = brokerageWrapper.closest('div').parentElement;
    const brokerageInput = brokerageRow.querySelector('input');
    expect(brokerageInput.value).toBe('625');
    fireEvent.change(brokerageInput, { target: { value: '1000' } });

    // Tap Done
    const doneBtn3 = screen.getByRole('button', { name: /Done/i });
    fireEvent.click(doneBtn3);

    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: /Savings Allocation/i })).toBeNull();
    });

    expect(screen.getAllByText('$1,000/mo')[0]).toBeDefined();

    // Save Budget persists changes
    const saveBudgetBtn = screen.getByRole('button', { name: /Save Budget/i });
    fireEvent.click(saveBudgetBtn);

    // Verify modal is closed
    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: /Working Budget/i })).toBeNull();
    });

    // Re-open budget modal to verify values persisted
    const editBtnRef = await screen.findByText(/Edit Budget Configuration/i);
    fireEvent.click(editBtnRef);

    expect(screen.getAllByText('$3,200/mo')[0]).toBeDefined();
    expect(screen.getAllByText('$841.83/mo')[0]).toBeDefined();
    expect(screen.getAllByText('$1,000/mo')[0]).toBeDefined();

    // Now test Cancel functionality
    const needsRowRef = screen.getByText('Housing, food, healthcare');
    fireEvent.click(needsRowRef);
    
    const housingWrapperRef = screen.getByText('Housing (Rent/Mortgage)');
    const housingInputRef = housingWrapperRef.closest('div').querySelector('input');
    fireEvent.change(housingInputRef, { target: { value: '2000' } });
    
    const doneBtnRef = screen.getByRole('button', { name: /Done/i });
    fireEvent.click(doneBtnRef);

    // Click Cancel to discard temporary changes
    const cancelBtn = screen.getByRole('button', { name: /Cancel/i });
    fireEvent.click(cancelBtn);

    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: /Working Budget/i })).toBeNull();
    });

    // Re-open to verify it was NOT saved (should still be 3200, not 3400)
    const editBtnRef2 = await screen.findByText(/Edit Budget Configuration/i);
    fireEvent.click(editBtnRef2);

    expect(screen.getAllByText('$3,200/mo')[0]).toBeDefined();
  });
});
