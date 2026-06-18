// @vitest-environment jsdom
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import DesktopResults from './src/components/fire-simulator/DesktopResults';
import MobileFireSimulatorView from './src/components/fire-simulator/MobileFireSimulatorView';

// Mock Recharts
vi.mock('recharts', () => {
  return {
    ResponsiveContainer: ({ children }) => <div data-testid="ResponsiveContainer">{children}</div>,
    LineChart: ({ children }) => <div data-testid="LineChart">{children}</div>,
    Line: () => <div data-testid="Line" />,
    XAxis: () => <div data-testid="XAxis" />,
    YAxis: () => <div data-testid="YAxis" />,
    CartesianGrid: () => <div data-testid="CartesianGrid" />,
    Tooltip: () => <div data-testid="Tooltip" />,
    ReferenceLine: () => <div data-testid="ReferenceLine" />,
    ReferenceDot: () => <div data-testid="ReferenceDot" />
  };
});

describe('Net Worth Ledger UI Collapse/Expand', () => {
  beforeEach(() => {
    cleanup();
  });

  const mockYearData = {
    age: 35,
    netWorth: 15772,
    assets: 25079,
    debt: 9307,
    income: 80000,
    expenses: 40000,
    savings: 25079,
    withdrawals: 0,
    netWorthLedger: {
      startingNetWorth: 5000,
      endingNetWorth: 15772,
      rows: [
        { section: 'incomeInvesting', label: 'Savings', value: 25079, type: 'positive' },
        { section: 'lifeEvents', label: 'Wedding Cost', value: -20000, type: 'negative', expandable: true, details: { paidFromSavings: 10000, financed: 10000, currentDebtBalance: 9307 } },
        { section: 'debtActivity', label: 'Debt Paydown', value: 693, type: 'positive' }
      ]
    }
  };

  const desktopProps = {
    inputs: {
      currentAge: 35,
      incomeList: [],
      spendingPhases: [],
      lifeEvents: [],
      debtList: []
    },
    displayedResults: { data: [mockYearData] },
    chartData: [mockYearData],
    validation: { errors: [] },
    selectedYear: 35,
    setSelectedYear: vi.fn(),
    showAssets: true,
    setShowAssets: vi.fn(),
    showDebt: true,
    setShowDebt: vi.fn(),
    showNetWorth: true,
    setShowNetWorth: vi.fn(),
    handleEditRoadmapEvent: vi.fn()
  };

  const mobileProps = {
    inputs: {
      currentAge: 35,
      incomeList: [],
      spendingPhases: [],
      lifeEvents: [],
      debtList: []
    },
    updateInput: vi.fn(),
    displayMode: 'nominal',
    setDisplayMode: vi.fn(),
    activeResults: { data: [mockYearData] },
    displayedResults: { data: [mockYearData], targetRetirementAge: 65 },
    selectedYear: 35,
    setSelectedYear: vi.fn(),
    chartData: [mockYearData],
    validation: { errors: [] },
    handleCreateEvent: vi.fn(),
    handleEditRoadmapEvent: vi.fn(),
    handleSetBudgetClick: vi.fn(),
    handleOpenSavingsDetails: vi.fn(),
    isMobile: true,
    totalNetWorth: 15772,
    activeStep: 1,
    setActiveStep: vi.fn(),
    timelineEvents: [],
    editingEvent: null,
    setEditingEvent: vi.fn(),
    dragOccurredRef: { current: false },
    isFullPartnerProfileOpen: false,
    setIsFullPartnerProfileOpen: vi.fn(),
    isZeroSpendingConfirmed: false,
    setIsZeroSpendingConfirmed: vi.fn(),
    isPartnerZeroSpendingConfirmed: false,
    setIsPartnerZeroSpendingConfirmed: vi.fn(),
    handleDeleteEvent: vi.fn(),
    handleSaveEvent: vi.fn(),
    getInputsWithEvent: vi.fn(),
    handleApplyMobileRecommendation: vi.fn(),
    setIsBudgetOpenFromMarriageWizard: vi.fn(),
    isBudgetOpenFromMarriageWizard: false,
    tempSocialSecurityDetails: {},
    childImpactSummary: null,
    setChildImpactSummary: vi.fn(),
    isBudgetModalOpen: false,
    handleCloseBudgetModal: vi.fn(),
    budgetMonthlyIncome: 5000,
    setBudgetMonthlyIncome: vi.fn(),
    budgetExpenses: {},
    activeTab: 'Results' // Ensure we render Results tab
  };

  test('Desktop Ledger starts collapsed and expands on click', () => {
    render(<DesktopResults {...desktopProps} />);

    // Header is rendered
    expect(screen.getByText(/Net Worth Change This Year/i)).toBeDefined();

    // Toggle button should initially say "Show details"
    const toggleBtn = screen.getByRole('button', { name: /Show details/i });
    expect(toggleBtn).toBeDefined();

    // Details/sections (like "Income & Investing") should NOT be visible when collapsed
    expect(screen.queryByText('Income & Investing')).toBeNull();

    // Click to expand
    fireEvent.click(toggleBtn);

    // Toggle button text should change to "Hide details"
    expect(screen.getByRole('button', { name: /Hide details/i })).toBeDefined();

    // Details/sections should now be visible
    expect(screen.getByText('Income & Investing')).toBeDefined();
    expect(screen.getByText('Life Events')).toBeDefined();
    expect(screen.getByText('Debt Activity')).toBeDefined();

    // Individual rows should be visible
    expect(screen.getByText(/\+\s*Savings/)).toBeDefined();
    expect(screen.getByText(/\+\s*Debt Paydown/)).toBeDefined();

    // Click to collapse again
    const hideBtn = screen.getByRole('button', { name: /Hide details/i });
    fireEvent.click(hideBtn);

    // Details should be hidden again
    expect(screen.queryByText('Income & Investing')).toBeNull();
  });

  test('Mobile Ledger starts collapsed and expands on click', () => {
    render(<MobileFireSimulatorView {...mobileProps} />);

    // Switch to Results tab
    const resultsTabBtn = screen.getByRole('button', { name: /^Results$/i });
    fireEvent.click(resultsTabBtn);

    // Header is rendered
    expect(screen.getByText(/Net Worth Change/i)).toBeDefined();

    // Toggle button should initially say "Show details"
    const toggleBtn = screen.getByRole('button', { name: /Show details/i });
    expect(toggleBtn).toBeDefined();

    // Details/sections should NOT be visible when collapsed
    expect(screen.queryByText('Income & Investing')).toBeNull();

    // Click to expand
    fireEvent.click(toggleBtn);

    // Toggle button text should change to "Hide details"
    expect(screen.getByRole('button', { name: /Hide details/i })).toBeDefined();

    // Details/sections should now be visible
    expect(screen.getByText('Income & Investing')).toBeDefined();

    // Click to collapse again
    const hideBtn = screen.getByRole('button', { name: /Hide details/i });
    fireEvent.click(hideBtn);

    // Details should be hidden again
    expect(screen.queryByText('Income & Investing')).toBeNull();
  });
});
