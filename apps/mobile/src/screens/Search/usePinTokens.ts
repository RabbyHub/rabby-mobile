import { IManageToken } from '@/core/services/preference';
import { TokenItem } from '@rabby-wallet/rabby-api/dist/types';
import { preferenceService } from '@/core/services';
import { openapi } from '@/core/request';
import { atom, useAtom } from 'jotai';
import { useCallback } from 'react';
import { zCreate } from '@/core/utils/reexports';

const chunkArray = (arr: IManageToken[], size: number): IManageToken[][] => {
  const chunks: IManageToken[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
};

const getPinTokens = async () => {
  const { pinedQueue = [] } = await preferenceService.getUserTokenSettings();
  const batches = chunkArray(pinedQueue, 30);

  let newTokenDetails: TokenItem[] = [];
  for (const batch of batches) {
    const batchDetails = await openapi.batchQueryTokens(
      batch
        .filter(t => t.chainId && t.tokenId)
        .map(i => `${i.chainId}:${i.tokenId}`),
    );
    newTokenDetails = [...newTokenDetails, ...batchDetails];
  }

  return newTokenDetails;
};

type PinTokensState = {
  pinTokens: TokenItem[];
};

const pinTokensStore = zCreate<PinTokensState>(() => ({
  pinTokens: [],
}));

export async function handleFetchTokens() {
  return getPinTokens().then(tokens => {
    pinTokensStore.setState({
      pinTokens: tokens,
    });
    return tokens;
  });
}

export const usePinTokens = () => {
  const data = pinTokensStore(s => s.pinTokens);

  return {
    data,
    handleFetchTokens,
  };
};
