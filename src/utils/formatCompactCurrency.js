export function formatCompactFinancial(val) {
  if (val === null || val === undefined) {
    return '$0';
  }

  const numVal = Number(val);
  if (isNaN(numVal) || !isFinite(numVal)) {
    return '$—';
  }

  const isNegative = numVal < 0;
  const absVal = Math.abs(numVal);

  if (absVal === 0) {
    return '$0';
  }

  if (absVal < 1000) {
    // Under $1,000: show full value
    const formatter = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0
    });
    return formatter.format(numVal);
  }

  let divisor;
  let suffix;

  if (absVal < 1e6) {
    divisor = 1e3;
    suffix = 'K';
  } else if (absVal < 1e9) {
    divisor = 1e6;
    suffix = 'M';
  } else if (absVal < 1e12) {
    divisor = 1e9;
    suffix = 'B';
  } else if (absVal < 1e15) {
    divisor = 1e12;
    suffix = 'T';
  } else if (absVal < 1e18) {
    divisor = 1e15;
    suffix = 'Q';
  } else if (absVal < 1e21) {
    divisor = 1e18;
    suffix = 'Qi';
  } else if (absVal < 1e24) {
    divisor = 1e21;
    suffix = 'Sx';
  } else {
    // Extremely large finite values -> scientific notation, e.g. "$1.2e+24"
    let formattedNumber = absVal.toExponential(1);
    // Remove trailing .0 if present
    formattedNumber = formattedNumber.replace('.0e', 'e');
    const sign = isNegative ? '-' : '';
    return `${sign}$${formattedNumber}`;
  }

  const divided = absVal / divisor;
  const decimals = (divided < 10) ? 1 : 0;

  let formattedNumber = divided.toFixed(decimals);

  // Remove trailing .0
  if (formattedNumber.endsWith('.0')) {
    formattedNumber = formattedNumber.slice(0, -2);
  }

  const sign = isNegative ? '-' : '';
  return `${sign}$${formattedNumber}${suffix}`;
}

export default function formatCompactCurrency(val) {
  return formatCompactFinancial(val);
}

