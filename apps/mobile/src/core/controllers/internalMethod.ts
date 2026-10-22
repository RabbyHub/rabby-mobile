import { keyBy } from 'lodash';
import { autoConnectServiceApi } from '@/core/serviceApi/autoConnect';
import {
  addDappSync,
  getDappSnapshot,
  updateDappSync,
} from '@/core/serviceApi/dapp';
import { getKeyringMemStoreStateSnapshot } from '@/core/serviceApi/keyring';
import { metamaskModeServiceApi } from '@/core/serviceApi/metamaskMode';
import providerController from './provider';
import { getProviderNetworkState } from '@/core/utils/providerNetworkState';
import type { ProviderRequest } from './type';
import { createDappBySession } from '@/core/utils/createDappBySession';
import { openapi } from '../request';

const tabCheckin = ({
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

  const dapp = getDappSnapshot(origin);
  if (!dapp) {
    addDappSync(
      createDappBySession({
        origin,
        name,
        icon,
      }),
    );
  } else {
    updateDappSync({
      ...dapp,
      name: name,
      icon: icon,
    });
  }
  void autoConnectServiceApi.prepare(origin).catch(console.error);

  return null;
};

const getProviderState = async (req: ProviderRequest) => {
  const {
    session: { origin },
  } = req;
  const isUnlocked = getKeyringMemStoreStateSnapshot()?.isUnlocked || false;

  // Must stay on `getProviderNetworkState`: the `chainChanged` notification the
  // BackgroundBridge pushes is derived from the same function, and the two
  // disagreeing makes the inpage provider emit a spurious `chainChanged`.
  const { chainId, networkVersion } = getProviderNetworkState(origin);

  return {
    chainId,
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
  return metamaskModeServiceApi.checkIsMetamaskMode(origin);
};

export default {
  tabCheckin,
  getProviderState,
  rabby_getProviderState: getProviderState,
  rabby_getDappsInfo: getDappsInfo,
  rabby_getOriginIsScam: getOriginIsScam,
  rabby_getIsMetamaskMode: getIsMetamaskMode,
};
