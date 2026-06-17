import { useState, useMemo, useEffect } from 'react';
import { runFireSimulation, validateFireInputs } from '../fireCalculations';
import { DEFAULT_FIRE_INPUTS } from '../defaultInputs';

export function useFireSimulation() {
  const [scenarios, setScenarios] = useState([
    {
      id: 'baseline',
      name: 'Baseline Plan',
      inputs: JSON.parse(JSON.stringify(DEFAULT_FIRE_INPUTS))
    },
    {
      id: 'compare1',
      name: 'Retire Early (Age 50)',
      inputs: (() => {
        const cloned = JSON.parse(JSON.stringify(DEFAULT_FIRE_INPUTS));
        cloned.targetRetirementAge = 50;
        cloned.lifeEvents = cloned.lifeEvents.map(e => e.type === 'retire' ? { ...e, age: 50 } : e);
        return cloned;
      })()
    }
  ]);

  const [currentScenarioId, setCurrentScenarioId] = useState('baseline');
  const [displayMode, setDisplayMode] = useState('future'); // 'future' | 'today'
  const [selectedYear, setSelectedYear] = useState(null);
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth < 768 : false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Get active inputs
  const activeScenario = useMemo(() => {
    return scenarios.find(s => s.id === currentScenarioId) || scenarios[0];
  }, [scenarios, currentScenarioId]);

  const inputs = activeScenario.inputs;

  // Run financial calculations
  const baselineResults = useMemo(() => {
    return runFireSimulation(scenarios.find(s => s.id === 'baseline')?.inputs || DEFAULT_FIRE_INPUTS);
  }, [scenarios]);

  const activeResults = useMemo(() => {
    const res = runFireSimulation(inputs);
    console.log('[FIRE Debug] RAW INPUTS:', inputs);
    const inf = (Number(inputs.inflationRate) || 3) / 100;
    const curAge = Number(inputs.currentAge) || 35;
    const logLines = [];
    res.data.forEach(d => {
      const factor = Math.pow(1 + inf, d.age - curAge);
      logLines.push(
        `Age ${d.age}: ` +
        `Income=${Math.round(d.income * factor)}, ` +
        `ChildCosts=${Math.round(d.childCosts * factor)}, ` +
        `Expenses=${Math.round(d.expenses * factor)}, ` +
        `Savings=${Math.round(d.savings * factor)}, ` +
        `Taxes=${Math.round(d.taxes * factor)}, ` +
        `Portfolio=${Math.round(d.portfolio * factor)}, ` +
        `NetWorth=${Math.round(d.netWorth * factor)}`
      );
    });
    console.log('[FIRE Debug] YEAR-BY-YEAR LOGS:\n' + logLines.join('\n'));
    return res;
  }, [inputs]);

  const displayedResults = useMemo(() => {
    const isNominal = displayMode === 'future';
    return {
      ...activeResults,
      data: isNominal ? activeResults.nominalData : activeResults.deflatedData,
      retirementReadyTarget: isNominal ? activeResults.nominalRetirementReadyTarget : activeResults.deflatedRetirementReadyTarget,
      retirementReadyTargetNoSS: isNominal ? activeResults.nominalRetirementReadyTargetNoSS : activeResults.deflatedRetirementReadyTargetNoSS,
      retirementReadyTargetComfortable: isNominal ? activeResults.retirementReadyTargetComfortable : activeResults.deflatedRetirementReadyTargetComfortable,
      retirementReadyTargetSurvival: isNominal ? activeResults.retirementReadyTargetSurvival : activeResults.deflatedRetirementReadyTargetSurvival,
      portfolioAtRetirement: isNominal ? activeResults.nominalPortfolioAtRetirement : activeResults.deflatedPortfolioAtRetirement,
      netWorthAtRetirement: isNominal ? activeResults.nominalNetWorthAtRetirement : activeResults.deflatedNetWorthAtRetirement,
      annualRetirementSpending: isNominal ? activeResults.nominalAnnualRetirementSpending : activeResults.deflatedAnnualRetirementSpending,
      endingSurplusShortfall: isNominal ? activeResults.nominalEndingSurplusShortfall : activeResults.deflatedEndingSurplusShortfall,
      retirementIncomeSources: isNominal ? activeResults.nominalRetirementIncomeSources : activeResults.deflatedRetirementIncomeSources,
      fiNumber: isNominal ? activeResults.nominalRetirementReadyTarget : activeResults.deflatedRetirementReadyTarget,
      retireTodayTarget: activeResults.retireTodayTarget
    };
  }, [activeResults, displayMode]);

  const displayedBaselineResults = useMemo(() => {
    const isNominal = displayMode === 'future';
    return {
      ...baselineResults,
      data: isNominal ? baselineResults.nominalData : baselineResults.deflatedData,
      retirementReadyTarget: isNominal ? baselineResults.nominalRetirementReadyTarget : baselineResults.deflatedRetirementReadyTarget,
      retirementReadyTargetNoSS: isNominal ? baselineResults.nominalRetirementReadyTargetNoSS : baselineResults.deflatedRetirementReadyTargetNoSS,
      retirementReadyTargetComfortable: isNominal ? baselineResults.retirementReadyTargetComfortable : baselineResults.deflatedRetirementReadyTargetComfortable,
      retirementReadyTargetSurvival: isNominal ? baselineResults.retirementReadyTargetSurvival : baselineResults.deflatedRetirementReadyTargetSurvival,
      portfolioAtRetirement: isNominal ? baselineResults.nominalPortfolioAtRetirement : baselineResults.deflatedPortfolioAtRetirement,
      netWorthAtRetirement: isNominal ? baselineResults.nominalNetWorthAtRetirement : baselineResults.deflatedNetWorthAtRetirement,
      annualRetirementSpending: isNominal ? baselineResults.nominalAnnualRetirementSpending : baselineResults.deflatedAnnualRetirementSpending,
      endingSurplusShortfall: isNominal ? baselineResults.nominalEndingSurplusShortfall : baselineResults.deflatedEndingSurplusShortfall,
      retirementIncomeSources: isNominal ? baselineResults.nominalRetirementIncomeSources : baselineResults.deflatedRetirementIncomeSources,
      fiNumber: isNominal ? baselineResults.nominalRetirementReadyTarget : baselineResults.deflatedRetirementReadyTarget,
      retireTodayTarget: baselineResults.retireTodayTarget
    };
  }, [baselineResults, displayMode]);

  const chartData = useMemo(() => {
    if (!displayedResults.data || displayedResults.data.length === 0) return [];
    
    const cash = Number(inputs.assets?.cash) || 0;
    const emergencyFund = Number(inputs.assets?.emergencyFund) || 0;
    const brokerage = Number(inputs.assets?.brokerage) || 0;
    const trad401k = Number(inputs.assets?.trad401k) || 0;
    const tradIra = Number(inputs.assets?.tradIra) || 0;
    const rothIra = Number(inputs.assets?.rothIra) || 0;
    const hsa = Number(inputs.assets?.hsa) || 0;
    const other = Number(inputs.assets?.other) || 0;
    
    const startingValue = cash + emergencyFund + brokerage + trad401k + tradIra + rothIra + hsa + other;

    return displayedResults.data.map((row, idx) => {
      let baselineRow = displayedBaselineResults.data.find(r => r.age === row.age);
      if (!baselineRow && displayedBaselineResults.data.length > 0) {
        baselineRow = displayedBaselineResults.data[displayedBaselineResults.data.length - 1];
      }
      
      let netWorth = row.netWorth;
      let baselineNetWorth = baselineRow ? baselineRow.netWorth : 0;
      
      const assets = row.assets !== undefined ? row.assets : (row.portfolio + (row.homeValue || 0));
      const debt = row.debt !== undefined ? row.debt : ((row.debtBalance || 0) + (row.mortgageBalance || 0) + (row.cumulativeShortfall || 0));

      return {
        ...row,
        netWorth,
        assets,
        debt,
        baselineNetWorth: baselineNetWorth,
        baselinePortfolio: baselineRow ? baselineRow.portfolio : 0,
        fiNumber: displayedResults.fiNumber
      };
    });
  }, [displayedResults.data, displayedBaselineResults.data, inputs.assets, scenarios]);

  const baselineChartData = useMemo(() => {
    if (!displayedBaselineResults.data || displayedBaselineResults.data.length === 0) return [];
    
    return displayedBaselineResults.data.map((row, idx) => {
      let netWorth = row.netWorth;
      return {
        age: row.age,
        portfolio: row.portfolio,
        netWorth,
        assets: row.assets,
        debt: row.debt,
        fiNumber: displayedBaselineResults.fiNumber
      };
    });
  }, [displayedBaselineResults.data, scenarios]);

  const validation = useMemo(() => {
    return validateFireInputs(inputs);
  }, [inputs]);

  const updateInput = (key, value) => {
    setScenarios(prev => prev.map(scen => {
      if (scen.id === currentScenarioId) {
        return {
          ...scen,
          inputs: {
            ...scen.inputs,
            [key]: value
          }
        };
      }
      return scen;
    }));
  };

  const updateAsset = (assetKey, value) => {
    setScenarios(prev => prev.map(scen => {
      if (scen.id === currentScenarioId) {
        const nextAssets = {
          ...scen.inputs.assets,
          [assetKey]: value
        };
        const total = Object.values(nextAssets).reduce((sum, v) => sum + (Number(v) || 0), 0);
        return {
          ...scen,
          inputs: {
            ...scen.inputs,
            assets: nextAssets,
            simpleInvestments: total
          }
        };
      }
      return scen;
    }));
  };

  const handleDuplicateScenario = () => {
    const newId = `compare-${Date.now()}`;
    const newScenario = {
      id: newId,
      name: `${activeScenario.name} (Copy)`,
      inputs: JSON.parse(JSON.stringify(activeScenario.inputs))
    };
    setScenarios(prev => [...prev, newScenario]);
    setCurrentScenarioId(newId);
  };

  const handleDeleteScenario = (idToDelete) => {
    if (scenarios.length <= 1) return;
    setScenarios(prev => prev.filter(s => s.id !== idToDelete));
    if (currentScenarioId === idToDelete) {
      const remaining = scenarios.filter(s => s.id !== idToDelete);
      setCurrentScenarioId(remaining[0]?.id || 'baseline');
    }
  };

  return {
    scenarios,
    setScenarios,
    currentScenarioId,
    setCurrentScenarioId,
    activeScenario,
    inputs,
    updateInput,
    updateAsset,
    displayMode,
    setDisplayMode,
    selectedYear,
    setSelectedYear,
    isMobile,
    baselineResults,
    activeResults,
    displayedResults,
    displayedBaselineResults,
    chartData,
    baselineChartData,
    validation,
    handleDuplicateScenario,
    handleDeleteScenario
  };
}
