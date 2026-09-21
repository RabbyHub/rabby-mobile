export const getStatsReportSide = (isBuy: boolean, isReduceOnly: boolean) => {
  if (isReduceOnly) {
    return isBuy ? 'close short' : 'close long';
  }
  return isBuy ? 'open long' : 'open short';
};
