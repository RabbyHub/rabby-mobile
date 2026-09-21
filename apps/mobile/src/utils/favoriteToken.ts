import type { IManageToken } from '@/types/assets';

export const isCustomTestnetFavoriteChain = (chainId?: string) => {
  return !!chainId?.toLowerCase().startsWith('custom_');
};

export const filterCustomTestnetFavoriteTokens = <
  T extends Pick<IManageToken, 'chainId'>,
>(
  tokens: readonly T[] = [],
) => {
  return tokens.filter(token => !isCustomTestnetFavoriteChain(token.chainId));
};

export const filterCustomTestnetUserTokenSettings = <
  T extends { pinedQueue?: IManageToken[] },
>(
  settings: T,
): T => {
  return {
    ...settings,
    pinedQueue: filterCustomTestnetFavoriteTokens(settings.pinedQueue),
  };
};
