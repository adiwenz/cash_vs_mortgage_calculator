export const lastChartChangeTypeRef = { current: null };

export function setLastChartChangeType(type) {
  lastChartChangeTypeRef.current = type;
}
