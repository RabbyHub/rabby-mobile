export const formatPercentageKMB = (x: number) => {
  if (Math.abs(x) < 0.00001) {
    return '0%';
  }
  const percentageValue = x * 100;
  const absPercentage = Math.abs(percentageValue);
  let formattedValue: string;

  if (absPercentage >= 1e9) {
    formattedValue = `${(absPercentage / 1e9).toFixed(1)}B`;
  } else if (absPercentage >= 1e6) {
    formattedValue = `${(absPercentage / 1e6).toFixed(1)}M`;
  } else if (absPercentage >= 1e3) {
    formattedValue = `${(absPercentage / 1e3).toFixed(1)}K`;
  } else if (absPercentage >= 10) {
    formattedValue = absPercentage.toFixed(1);
  } else {
    formattedValue = absPercentage.toFixed(2);
  }

  const sign = x >= 0 ? '+' : '-';
  return `${sign}${formattedValue}%`;
};
