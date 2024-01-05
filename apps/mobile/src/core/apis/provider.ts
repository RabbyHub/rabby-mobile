import { INTERNAL_REQUEST_SESSION } from '@/constant';
import { CHAINS_ENUM } from '@debank/common';
import providerController from '../controllers/provider';

export const requestETHRpc = (
  data: { method: string; params: any },
  chainId: string,
) => {
  return providerController.ethRpc(
    {
      data,
      session: INTERNAL_REQUEST_SESSION,
    },
    chainId,
  );
};

// TODO
export const fetchEstimatedL1Fee = async (
  txMeta: Record<string, any> & {
    txParams: any;
  },
  chain = CHAINS_ENUM.OP,
): Promise<string> => {
  throw new Error('Method not implemented.');
};
