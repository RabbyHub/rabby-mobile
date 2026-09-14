import { addressUtils } from '@rabby-wallet/base-utils';

const { isSameAddress } = addressUtils;

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

export const isSwapCalldataReceiverAllowed = (
  toTokenReceiver: string | null | undefined,
  userAddress: string | null | undefined,
) => {
  const receiver = toTokenReceiver?.toString?.() || '';
  if (!receiver) {
    return true;
  }
  // 1inch (and similar routers) treat the zero address as msg.sender.
  if (isSameAddress(receiver, ZERO_ADDRESS)) {
    return true;
  }
  if (!userAddress) {
    return false;
  }
  return isSameAddress(receiver, userAddress);
};
