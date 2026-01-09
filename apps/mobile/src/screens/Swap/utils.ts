import { CHAINS, CHAINS_ENUM } from '@debank/common';
import { TokenItem } from '@rabby-wallet/rabby-api/dist/types';
import { WrapTokenAddressMap } from '@rabby-wallet/rabby-swap';
import BigNumber from 'bignumber.js';
import { addressUtils } from '@rabby-wallet/base-utils';
import { findChainByEnum } from '@/utils/chain';

const { isSameAddress } = addressUtils;

export const tokenAmountBn = (token: TokenItem) =>
  new BigNumber(token?.raw_amount_hex_str || 0, 16).div(
    10 ** (token?.decimals || 1),
  );

export function isSwapWrapToken(
  payTokenId: string,
  receiveId: string,
  chain: CHAINS_ENUM,
) {
  const wrapTokens = [
    WrapTokenAddressMap[chain as keyof typeof WrapTokenAddressMap]!,
    (findChainByEnum(chain)?.nativeTokenAddress ||
      CHAINS[chain].nativeTokenAddress)!,
  ];
  return (
    !!payTokenId &&
    !!receiveId &&
    payTokenId !== receiveId &&
    !!wrapTokens.find(token => isSameAddress(payTokenId, token)) &&
    !!wrapTokens.find(token => isSameAddress(receiveId, token))
  );
}
