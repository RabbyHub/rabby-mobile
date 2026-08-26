import type { TokenItem } from '@rabby-wallet/rabby-api/dist/types';

import { EMPTY_TOKEN_ITEM } from '@/constant/assets';
import type { ITokenItem } from '@/types/assets';
import {
  mapWithJsBudget,
  type MapWithJsBudgetOptions,
} from '@/core/utils/cooperativeWork';

import { TokenItemEntity } from '../entities/tokenitem';

type TokenEntityBuildOptions = Pick<
  MapWithJsBudgetOptions,
  'budgetMs' | 'minimumItemsPerSlice' | 'shouldContinue' | 'onYield' | 'clock'
>;

export type TokenEntityBuildResult = {
  tokens: Array<TokenItem | ITokenItem>;
  tokenItems: TokenItemEntity[];
};

function normalizeTokenInput(tokens: TokenItem[] | ITokenItem[]) {
  const data = [...tokens] as Array<TokenItem | ITokenItem>;
  if (data.length === 0) {
    data.push(EMPTY_TOKEN_ITEM);
  }

  return data.sort((a, b) =>
    b.is_core === a.is_core ? 0 : b.is_core ? 1 : -1,
  );
}

export async function buildTokenEntitiesCooperatively(
  address: string,
  input: TokenItem[] | ITokenItem[],
  syncTimestamp: number,
  options: TokenEntityBuildOptions = {},
): Promise<TokenEntityBuildResult | null> {
  const tokens = normalizeTokenInput(input);
  const tokenItems = await mapWithJsBudget(
    tokens,
    raw => {
      const tokenItem = new TokenItemEntity();
      TokenItemEntity.fillEntity(tokenItem, address, raw);
      tokenItem._local_updated_at = syncTimestamp;
      return tokenItem;
    },
    options,
  );

  return tokenItems ? { tokens, tokenItems } : null;
}
