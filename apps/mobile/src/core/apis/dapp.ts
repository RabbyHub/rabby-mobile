import { SessionProp } from './../services/session';
import { DappInfo } from '@/core/services/dappService';
import { dappService } from '../services';
import { preferenceService, sessionService } from '../services/shared';
import { BroadcastEvent } from '@/constant/event';
import { CHAINS_ENUM } from '@/constant/chains';
import { openapi } from '../request';
import { BasicDappInfo } from '@rabby-wallet/rabby-api/dist/types';
import { cached } from '@/utils/cache';
import { stringUtils } from '@rabby-wallet/base-utils';

export const removeDapp = (origin: string) => {
  disconnect(origin);
  dappService.removeDapp(origin);
};

export const disconnect = (origin: string) => {
  if (!dappService.hasPermission(origin)) {
    return;
  }
  sessionService.broadcastEvent(BroadcastEvent.accountsChanged, [], origin);
  dappService.disconnect(origin);
};

export const connect = ({
  origin,
  session,
  info,
  chainId,
  currentAccount,
}: {
  origin: string;
  chainId: CHAINS_ENUM;
  session?: SessionProp;
  info?: BasicDappInfo;
  currentAccount?: DappInfo['currentAccount'];
}) => {
  const dapp = dappService.getDapp(origin);
  if (dapp) {
    dappService.patchDapps({
      [origin]: {
        chainId,
        isConnected: true,
        ...(currentAccount !== undefined && { currentAccount }),
      },
    });
    return;
  }
  if (info) {
    dappService.addDapp({
      origin,
      info,
      isConnected: true,
      chainId,
      ...(currentAccount !== undefined && { currentAccount }),
    });
    return;
  }
  dappService.addDapp({
    ...createDappBySession(
      session || {
        name: '',
        origin,
        icon: '',
      },
    ),
    ...(currentAccount !== undefined && { currentAccount }),
    isConnected: true,
    chainId,
  });
  syncBasicDappInfo(origin);
};

export function setCurrentAccountForDapp(
  origin: string,
  currentAccount?: DappInfo['currentAccount'],
) {
  if (currentAccount === undefined) {
    currentAccount = preferenceService.getCurrentAccount();
  }
  dappService.patchDapps({
    [origin]: {
      currentAccount,
    },
  });

  return currentAccount || null;
}

export const fetchDappInfo = async (origin: string) => {
  const res = await openapi.getDappsInfo({
    ids: [origin.replace(/^https?:\/\//, '')],
  });

  return res?.[0];
};

// cache 1 minute
export const cachedFetchDappInfo = cached(fetchDappInfo, 60 * 1e3);

export const createDappBySession = ({
  origin,
  name,
  icon,
}: {
  origin: string;
  name: string;
  icon: string;
}): DappInfo => {
  const id = origin.replace(/^https?:\/\//, '');
  return {
    origin,
    chainId: CHAINS_ENUM.ETH,
    info: {
      id,
      name: name || '',
      logo_url: icon || '',
      description: '',
      user_range: '',
      tags: [],
      chain_ids: [],
    },
  };
};

export const syncBasicDappInfo = async (origin: string | string[]) => {
  const input = Array.isArray(origin) ? origin : [origin];
  const ids = input
    .filter(item => !!item)
    .map(item => item.replace(/^https?:\/\//, ''));

  if (!ids.length) return;

  const res = await openapi.getDappsInfo({
    ids: ids,
  });

  dappService.patchDapps(
    res.reduce((accu, item) => {
      if (item.id) {
        const dappOrigin = stringUtils.ensurePrefix(item.id, 'https://');
        if (dappOrigin) {
          accu[dappOrigin] = { info: item };
        }
      }
      return accu;
    }, {} as Record<DappInfo['origin'], Partial<DappInfo>>),
  );

  return dappService.getDapps();
};
