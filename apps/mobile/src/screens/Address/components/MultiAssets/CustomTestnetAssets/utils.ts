import type { ITokenItem, TokenDisplayMode } from '@/types/assets';

export type CustomTestnetTokenDisplayRow = {
  key: string;
  token: ITokenItem;
  tokens: ITokenItem[];
  mode: 'token' | 'group';
};

const getCustomTestnetAssetGroupKey = (token: ITokenItem) =>
  `${token.chain.toLowerCase()}::${token.id.toLowerCase()}`;

const aggregateCustomTestnetTokensByAsset = (
  tokens: ITokenItem[],
): CustomTestnetTokenDisplayRow[] => {
  const grouped = new Map<string, ITokenItem[]>();

  tokens.forEach(token => {
    const key = getCustomTestnetAssetGroupKey(token);
    const list = grouped.get(key);
    if (list) {
      list.push(token);
    } else {
      grouped.set(key, [token]);
    }
  });

  return Array.from(grouped.entries()).map(([key, groupTokens]) => {
    const primary = groupTokens.reduce((best, item) => {
      const bestAmount = best?.amount || 0;
      const nextAmount = item.amount || 0;
      return nextAmount > bestAmount ? item : best;
    }, groupTokens[0])!;
    const amount = groupTokens.reduce(
      (sum, item) => sum + (item.amount || 0),
      0,
    );
    const usdValue = groupTokens.reduce(
      (sum, item) => sum + (item.usd_value || 0),
      0,
    );

    return {
      key,
      token: {
        ...primary,
        amount,
        usd_value: usdValue,
      },
      tokens: groupTokens,
      mode: 'group',
    };
  });
};

export const getCustomTestnetTokenDisplayRows = (
  tokens: ITokenItem[],
  tokenDisplayMode: TokenDisplayMode,
): CustomTestnetTokenDisplayRow[] => {
  if (tokenDisplayMode === 'byAddress') {
    return tokens.map(token => ({
      key: `${token.owner_addr.toLowerCase()}::${getCustomTestnetAssetGroupKey(
        token,
      )}`,
      token,
      tokens: [token],
      mode: 'token',
    }));
  }

  return aggregateCustomTestnetTokensByAsset(tokens);
};
