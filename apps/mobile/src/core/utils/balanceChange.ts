export function computeBalanceChange(realtimeValue: number, baseValue: number) {
  const assetsChange = realtimeValue - baseValue;
  const changePercent =
    baseValue !== 0
      ? `${Math.abs((assetsChange * 100) / baseValue).toFixed(2)}%`
      : `${realtimeValue === 0 ? '0' : '100.00'}%`;

  return {
    assetsChange,
    changePercent,
  };
}
