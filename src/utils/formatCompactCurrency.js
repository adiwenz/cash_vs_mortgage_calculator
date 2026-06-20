export default function formatCompactCurrency(val) {
  if (val === null || val === undefined || isNaN(val)) {
    return '$0';
  }

  const isNegative = val < 0;
  const absVal = Math.abs(val);

  if (absVal < 1000) {
    // Under $1,000: show full value
    const formatter = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0
    });
    return formatter.format(val);
  }

  let divisor = 1;
  let suffix = '';

  if (absVal < 1000000) {
    divisor = 1000;
    suffix = 'K';
  } else if (absVal < 1000000000) {
    divisor = 1000000;
    suffix = 'M';
  } else if (absVal < 1000000000000) {
    divisor = 1000000000;
    suffix = 'B';
  } else {
    divisor = 1000000000000;
    suffix = 'T';
  }

  const divided = absVal / divisor;

  // Decide decimals based on rules:
  // Thousands (K): 1 decimal if < 10K, 0 decimals if >= 10K
  // Millions (M): 1 decimal if < 100M, 0 decimals if >= 100M
  // Billions (B): 1 decimal if < 100B, 0 decimals if >= 100B
  // Trillions (T): 1 decimal if < 100T, 0 decimals if >= 100T
  let decimals = 0;
  if (suffix === 'K') {
    decimals = absVal < 10000 ? 1 : 0;
  } else if (suffix === 'M') {
    decimals = absVal < 100000000 ? 1 : 0;
  } else if (suffix === 'B') {
    decimals = absVal < 100000000000 ? 1 : 0;
  } else if (suffix === 'T') {
    decimals = absVal < 100000000000000 ? 1 : 0;
  }

  let formattedNumber = divided.toFixed(decimals);

  // Remove trailing .0
  if (formattedNumber.endsWith('.0')) {
    formattedNumber = formattedNumber.slice(0, -2);
  }

  const sign = isNegative ? '-' : '';
  return `${sign}$${formattedNumber}${suffix}`;
}
