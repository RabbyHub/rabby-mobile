export const MARKET_TAB_ACTION_PREFIX: Record<string, string> = {
  watchlist: 'WatchList',
  meme: 'Memecoin',
  stock: 'Stock',
  commodities: 'Commodities',
};

export const getMarketTabActionPrefix = (categoryId: string) => {
  return MARKET_TAB_ACTION_PREFIX[categoryId] || null;
};

export const getMarketTabViewAction = (categoryId: string) => {
  const prefix = getMarketTabActionPrefix(categoryId);

  if (!prefix) {
    return null;
  }

  return `${prefix}_View`;
};

export const getMarketTabClickListAction = (categoryId: string) => {
  const prefix = getMarketTabActionPrefix(categoryId);

  if (!prefix) {
    return null;
  }

  return `${prefix}_ClickList`;
};

export const getMarketTabToSwapPageAction = (categoryId: string) => {
  const prefix = getMarketTabActionPrefix(categoryId);

  if (!prefix) {
    return null;
  }

  return `${prefix}_ToSwapPage`;
};

export const getMarketTabCreateSwapTxAction = (categoryId: string) => {
  const prefix = getMarketTabActionPrefix(categoryId);

  if (!prefix) {
    return null;
  }

  return `${prefix}_CreateSwapTx`;
};

export const buildMarketTokenDetailFrom = ({
  categoryId,
  id,
  chain,
  symbol,
}: {
  categoryId: string;
  id?: string;
  chain?: string;
  symbol?: string;
}) => ({
  scene: categoryId,
  id,
  chain,
  symbol: symbol || '',
});
