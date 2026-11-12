import { CHAINS_ENUM } from '@debank/common';
import type { TokenItem } from '@rabby-wallet/rabby-api/dist/types';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import BigNumber from 'bignumber.js';
import { ETH_USDT_CONTRACT } from '@/constant/swap';
import { getERC20Allowance } from '@/core/apis/provider';
import type { Account } from '@/core/startupServices/preference';
import { findChain } from '@/utils/chain';
import {
  getBridgeAllowanceRequestKey,
  getOrCreateBridgeAllowanceRequest,
} from './quoteResultBatch';

export const getBridgeQuoteApproval = async ({
  fromToken,
  approveContractId,
  amount,
  account,
  allowanceCache,
}: {
  fromToken: Pick<TokenItem, 'id' | 'chain' | 'decimals'>;
  approveContractId?: string;
  amount: string | number;
  account: Account;
  allowanceCache: Map<string, Promise<string>>;
}): Promise<{ shouldApproveToken: boolean; shouldTwoStepApprove: boolean }> => {
  let tokenApproved = false;
  let allowance = '0';
  const fromFindChain = findChain({ serverId: fromToken.chain });
  if (fromToken.id === fromFindChain?.nativeTokenAddress) {
    tokenApproved = true;
  } else if (!approveContractId) {
    tokenApproved = true;
  } else {
    const allowanceKey = getBridgeAllowanceRequestKey({
      chainId: fromToken.chain,
      tokenId: fromToken.id,
      spender: approveContractId,
      account: account.address,
    });
    allowance = await getOrCreateBridgeAllowanceRequest(
      allowanceCache,
      allowanceKey,
      () =>
        getERC20Allowance(
          fromToken.chain,
          fromToken.id,
          approveContractId,
          account.address,
          account,
        ),
    );
    tokenApproved = new BigNumber(allowance).gte(
      new BigNumber(amount).times(10 ** fromToken.decimals),
    );
  }

  const shouldTwoStepApprove =
    fromFindChain?.enum === CHAINS_ENUM.ETH &&
    isSameAddress(fromToken.id, ETH_USDT_CONTRACT) &&
    Number(allowance) !== 0 &&
    !tokenApproved;

  return { shouldApproveToken: !tokenApproved, shouldTwoStepApprove };
};
