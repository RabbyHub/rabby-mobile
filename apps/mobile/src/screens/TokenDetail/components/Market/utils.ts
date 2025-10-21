export const sortTokenWithSymbol = (
  token: {
    id: string;
    amount: number;
    symbol: string;
    price: number;
    usd_value: number;
  }[],
  symbol: string,
) => {
  const target = symbol?.toUpperCase?.() || '';
  const getRank = (s?: string) => {
    if (!s) {
      return 999;
    }
    const up = s.toUpperCase();
    if (up === target) {
      return 0;
    }
    if (up === `W${target}`) {
      return 1;
    }
    if (up.includes(target) || target.includes(up)) {
      return 2;
    }
    return 3;
  };

  return token
    .map((t, index) => ({
      t,
      index,
      rank: getRank(t.symbol),
    }))
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map(i => i.t);
};
