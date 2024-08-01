import { CHAINS_ENUM } from '@/constant/chains';
import { keyringService } from '../services';
import { dappService } from '@/core/services/shared';
import providerController from './provider';
import { findChain, findChainByEnum } from '@/utils/chain';
import { ProviderRequest } from './type';

const networkIdMap: {
  [key: string]: string;
} = {};

const tabCheckin = ({
  data: {
    params: { name, icon },
  },
  session,
  origin,
}) => {
  session.setProp({ origin, name, icon });
};

const getProviderState = async (req: ProviderRequest) => {
  const {
    session: { origin },
  } = req;
  const chainEnum = dappService.getDapp(origin)?.chainId || CHAINS_ENUM.ETH;
  const isUnlocked = keyringService.memStore.getState().isUnlocked;
  let networkVersion = '1';
  if (networkIdMap[chainEnum]) {
    networkVersion = networkIdMap[chainEnum];
  } else {
    // TODO: it maybe throw error
    networkVersion = await providerController.netVersion(req);
    networkIdMap[chainEnum] = networkVersion;
  }

  // TODO: should we throw error here?
  let chainItem = findChainByEnum(chainEnum);

  if (!chainItem) {
    console.warn(
      `[internalMethod::getProviderState] chain ${chainEnum} not found`,
    );
    chainItem = findChain({
      enum: CHAINS_ENUM.ETH,
    })!;
  }

  return {
    chainId: chainItem.hex,
    isUnlocked,
    accounts: isUnlocked ? await providerController.ethAccounts(req) : [],
    networkVersion,
  };
};

export default {
  tabCheckin,
  getProviderState,
  rabby_getProviderState: getProviderState,
};
