import { CHAINS_ENUM } from '@debank/common';
import { CHAINS } from '@/constant/chains';
import { keyringService } from '../services';
import { dappService } from '@/core/services/shared';
import providerController from './provider';
import { findChainByEnum } from '@/utils/chain';

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

const getProviderState = async req => {
  const {
    session: { origin },
  } = req;
  const chainEnum = dappService.getDapp(origin)?.chainId || CHAINS_ENUM.ETH;
  const isUnlocked = keyringService.memStore.getState().isUnlocked;
  let networkVersion = '1';
  if (networkIdMap[chainEnum]) {
    networkVersion = networkIdMap[chainEnum];
  } else {
    networkVersion = await providerController.netVersion(req);
    networkIdMap[chainEnum] = networkVersion;
  }

  // TODO: should we throw error here?
  let chainItem = findChainByEnum(chainEnum);

  if (!chainItem) {
    console.warn(
      `[internalMethod::getProviderState] chain ${chainEnum} not found`,
    );
    chainItem = CHAINS.ETH;
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
};
