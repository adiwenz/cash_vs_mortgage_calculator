import { ASSET_LABELS } from './simulationConstants.js';

export function formatCurrency(val) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  }).format(val);
}

export function sumNonDebtExpenses(expensesMap, activeProperties = [], age = null) {
  if (!expensesMap) return 0;
  let housingCost = Number(expensesMap.housing) || 0;
  if (activeProperties.length > 0 && age !== null) {
    activeProperties.forEach(prop => {
      if (age >= prop.purchaseAge) {
        const p = prop.homePrice || 0;
        const propTaxRate = prop.propertyTaxRate || 0;
        const insRate = prop.insuranceRate || 0;
        const maintRate = prop.maintenanceRate || 0;
        
        const monthlyPropTax = (p * propTaxRate) / 12;
        const monthlyIns = (p * insRate) / 12;
        const monthlyMaint = (p * maintRate) / 12;
        const monthlyHoa = prop.hoa || 0;
        const monthlyUtil = prop.utilitiesIncrease || 0;
        
        let monthlyPmi = 0;
        if (prop.purchaseType !== 'cash' && prop.downPayment < p * 0.2) {
          const pmiRate = prop.pmiRate || 0.5;
          const loanAmount = Math.max(0, p - prop.downPayment);
          monthlyPmi = (loanAmount * (pmiRate / 100)) / 12;
        }
        
        const propertyNonMortgageCosts = monthlyPropTax + monthlyIns + monthlyMaint + monthlyHoa + monthlyUtil + monthlyPmi;
        housingCost = Math.max(0, housingCost - Math.round(propertyNonMortgageCosts));
      }
    });
  }
  return Object.keys(expensesMap)
    .filter(k => !k.startsWith('debt_') && k !== '🏠 Mortgage' && k !== 'mortgage' && k !== 'housing')
    .reduce((sum, k) => sum + (Number(expensesMap[k]) || 0), 0) + housingCost;
}

export function getAssetLabel(key) {
  return ASSET_LABELS[key] || key;
}

export function isGeneratedMainIncome(id) {
  if (!id || typeof id !== 'string') return false;
  return id.startsWith('child-income-boost') ||
         id.startsWith('simple-inc-prechild') ||
         id.startsWith('simple-inc-worksave') ||
         id.startsWith('simple-inc-childcare') ||
         id === 'simple-inc' ||
         id === 'inc-1';
}
