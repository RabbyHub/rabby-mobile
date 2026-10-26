import { CHAINS, CHAINS_ENUM } from '@debank/common';
import { TokenItem } from '@rabby-wallet/rabby-api/dist/types';
import { isSwapWrapToken as matchSwapWrapToken } from '@rabby-wallet/rabby-swap';
import BigNumber from 'bignumber.js';
import { findChainByEnum } from '@/utils/chain';

export const tokenAmountBn = (token: TokenItem) => {
  return new BigNumber(token?.raw_amount_hex_str || 0, 16).div(
    10 ** token.decimals,
  );
};

export function getSwapNativeTokenAddress(chain: CHAINS_ENUM) {
  return (
    findChainByEnum(chain)?.nativeTokenAddress ||
    CHAINS[chain].nativeTokenAddress
  );
}

export function getSwapChainId(chain: CHAINS_ENUM) {
  return findChainByEnum(chain)?.id || CHAINS[chain].id;
}

export function isSwapWrapToken(
  payTokenId: string,
  receiveId: string,
  chain: CHAINS_ENUM,
) {
  return matchSwapWrapToken(
    payTokenId,
    receiveId,
    chain,
    getSwapNativeTokenAddress(chain),
  );
}
