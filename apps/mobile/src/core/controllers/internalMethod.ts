import { keyBy, uniq } from 'lodash';
import { CHAINS_ENUM } from '@/constant/chains';
import { keyringService } from '../services';
import { dappService, sessionService } from '@/core/services/shared';
import providerController from './provider';
import { findChain, findChainByEnum } from '@/utils/chain';
import { ProviderRequest } from './type';
import { createDappBySession } from '../apis/dapp';
import { openapi } from '../request';

const networkIdMap: {
  [key: string]: string;
} = {};

const tabCheckin = ({
  data: {
    params: { name, icon },
  },
  session: { origin },
}) => {
  // session.setProp({ origin, name, icon });
  // console.debug('tabCheckin', origin, name, icon);
  const dapp = dappService.getDapp(origin);
  if (!dapp) {
    dappService.addDapp(
      createDappBySession({
        origin,
        name,
        icon,
      }),
    );
  } else {
    const info = {
      ...dapp.info,
    };
    // todo check this
    info.name = info.name || name;
    info.logo_url = info.logo_url || icon;
    dappService.updateDapp({
      ...dapp,
      info: {
        ...info,
      },
    });
  }

  return null;
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

const getDappsInfo = async (req: ProviderRequest) => {
  const domains: string[] = req.data.params?.[0]?.domains || [];

  const res = await openapi.getDappsInfo({
    ids: domains,
  });
  return keyBy(res, 'id');
};

const getOriginIsScam = async (req: ProviderRequest) => {
  const args: { origin: string; source: string } = req.data.params?.[0];
  return openapi.getOriginIsScam(args.origin, args.origin);
};

export default {
  tabCheckin,
  getProviderState,
  rabby_getProviderState: getProviderState,
  rabby_getDappsInfo: getDappsInfo,
  rabby_getOriginIsScam: getOriginIsScam,
};
