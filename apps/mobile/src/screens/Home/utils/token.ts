import { TokenItem } from '@rabby-wallet/rabby-api/dist/types';
import { DisplayedToken } from './project';
import { AbstractPortfolioToken } from '../types';
import type { ITokenSetting } from '@/types/assets';
import type { ITokenItem } from '@/types/assets';

type ITokenSettingsSet = {
  pinedQueue: ITokenSetting['pinedQueue'] & object;
};
export function makeTokenSettingSets(
  tokenSetting: ITokenSetting,
): ITokenSettingsSet {
  const tokenSettingSets: Required<ITokenSettingsSet> = {
    pinedQueue: tokenSetting.pinedQueue || [],
  };

  return tokenSettingSets;
}

export function tagTokenItemFavorite<T extends ITokenItem = ITokenItem>(
  i: T,
  tokenSetting: { pinedQueue: ITokenSettingsSet['pinedQueue'] },
) {
  const { pinedQueue } = tokenSetting;
  const pinIndex = Array.from(pinedQueue).findIndex(
    x =>
      x.chainId.toLowerCase() === i.chain.toLowerCase() &&
      x.tokenId.toLowerCase() === i.id.toLowerCase(),
  );
  const isPin = pinIndex !== -1;
  return {
    ...i,
    isPin,
  };
}

export const ensureAbstractPortfolioToken = (
  token: TokenItem | AbstractPortfolioToken,
): AbstractPortfolioToken => {
  if (token instanceof DisplayedToken) {
    return token as AbstractPortfolioToken;
  }

  return new DisplayedToken(token) as AbstractPortfolioToken;
};
