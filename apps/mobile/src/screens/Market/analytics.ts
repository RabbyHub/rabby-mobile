export const MARKET_TAB_ACTION_PREFIX: Record<string, string> = {
  watchlist: 'WatchList',
  meme: 'Memecoin',
  stock: 'Stock',
  commodities: 'Commodities',
  hot: 'Hot',
};

export const getMarketTabActionPrefix = (categoryId: string) => {
  return MARKET_TAB_ACTION_PREFIX[categoryId] || null;
};

const buildAction = (categoryId: string, suffix: string) => {
  const prefix = getMarketTabActionPrefix(categoryId);
  return prefix ? `${prefix}_${suffix}` : null;
};
export const getMarketTabViewAction = (id: string) => buildAction(id, 'View');
export const getMarketTabClickListAction = (id: string) =>
  buildAction(id, 'ClickList');
export const getMarketTabToSwapPageAction = (id: string) =>
  buildAction(id, 'ToSwapPage');
export const getMarketTabCreateSwapTxAction = (id: string) =>
  buildAction(id, 'CreateSwapTx');

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
}) =>
  MARKET_TAB_ACTION_PREFIX[categoryId.toLowerCase()]
    ? {
        scene: categoryId,
        id,
        chain,
        symbol: symbol || '',
      }
    : undefined;
