import { keyBy } from 'lodash';
import { CHAINS_ENUM } from '@/constant/chains';
import type KeyringService from '@rabby-wallet/service-keyring';
import { findChain, findChainByEnum } from '@/utils/chain';
import { createDappBySession } from '../apis/dapp';
import { openapi } from '../request';
import type { ProviderRequest } from './type';
import {
  getServiceReady,
  SERVICE_READY_KEYS,
} from '@/core/services/serviceReady';
import type { AutoConnectService } from '@/core/services/autoConnect';
import type { DappService } from '@/core/services/dappService';
import type { MetamaskModeService } from '@/core/services/metamaskModeService';
import { getProviderController } from './provider';

const networkIdMap: {
  [key: string]: string;
} = {};

const tabCheckin = async ({
  data: {
    params: { name, icon, userAgent },
  },
  session,
}) => {
  const origin = session.origin;
  // try {
  //   session.setProp({ origin, name, icon });
  // } catch (e) {
  //   console.error(e);
  // }
  console.debug('[tabCheckin]', origin, name, icon, userAgent);

  const [dappService, autoConnectService] = await Promise.all([
    getServiceReady<DappService>(SERVICE_READY_KEYS.dappService),
    getServiceReady<AutoConnectService>(SERVICE_READY_KEYS.autoConnectService),
  ]);
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
    dappService.updateDapp({
      ...dapp,
      name: name,
      icon: icon,
    });
  }
  autoConnectService.prepare(origin);

  return null;
};

const getProviderState = async (req: ProviderRequest) => {
  const {
    session: { origin },
  } = req;
  const [dappService, keyringService] = await Promise.all([
    getServiceReady<DappService>(SERVICE_READY_KEYS.dappService),
    getServiceReady<KeyringService>(SERVICE_READY_KEYS.keyringService),
  ]);
  const chainEnum = dappService.getDapp(origin)?.chainId || CHAINS_ENUM.ETH;
  const isUnlocked = keyringService.memStore.getState().isUnlocked;
  let networkVersion = '1';
  const providerController = await getProviderController();
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
  return openapi.getOriginIsScam(args.origin, args.source);
};

const getIsMetamaskMode = async (req: ProviderRequest) => {
  const origin = req.session.origin;

  if (!origin) {
    return false;
  }
  const metamaskModeService = await getServiceReady<MetamaskModeService>(
    SERVICE_READY_KEYS.metamaskModeService,
  );
  return metamaskModeService.checkIsMetamaskMode(origin);
};

export default {
  tabCheckin,
  getProviderState,
  rabby_getProviderState: getProviderState,
  rabby_getDappsInfo: getDappsInfo,
  rabby_getOriginIsScam: getOriginIsScam,
  rabby_getIsMetamaskMode: getIsMetamaskMode,
};
