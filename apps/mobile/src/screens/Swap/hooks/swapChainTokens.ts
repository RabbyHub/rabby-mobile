import { CHAINS_ENUM } from '@debank/common';
import { addressUtils } from '@rabby-wallet/base-utils';

import {
  getChainDefaultToken,
  getDefaultSwapToTokenItem,
} from '@/constant/swap';

const { isSameAddress } = addressUtils;

export const resolveSwapChainTokens = ({
  chain,
  payTokenId,
  payUseBaseToken = false,
}: {
  chain: CHAINS_ENUM;
  payTokenId?: string;
  payUseBaseToken?: boolean;
}) => {
  const payToken = {
    ...getChainDefaultToken(chain),
    ...(payTokenId ? { id: payTokenId } : {}),
  };

  if (payUseBaseToken) {
    return {
      payToken,
      receiveToken: {
        ...getChainDefaultToken(chain),
      },
    };
  }

  const defaultReceiveToken = getDefaultSwapToTokenItem(chain);
  return {
    payToken,
    receiveToken:
      defaultReceiveToken && !isSameAddress(payToken.id, defaultReceiveToken.id)
        ? defaultReceiveToken
        : undefined,
  };
};
