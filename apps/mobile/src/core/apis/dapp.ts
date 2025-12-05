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
import { getAllAccountsToDisplay } from './account';
import { KEYRING_CLASS } from '@rabby-wallet/keyring-utils';
import { sortAccountList } from '@/utils/sortAccountList';
import { findChain } from '@/utils/chain';

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

export const connect = async ({
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
  const allAccounts = await getAllAccountsToDisplay();
  const pinAddresses = preferenceService.getPinAddresses();
  const accounts = sortAccountList(allAccounts, {
    highlightedAddresses: pinAddresses,
  });

  const myAccounts = accounts.filter(
    account =>
      account.type !== KEYRING_CLASS.WATCH &&
      account.type !== KEYRING_CLASS.GNOSIS,
  );

  const account =
    currentAccount ||
    dapp?.currentAccount ||
    myAccounts?.[0] ||
    accounts?.[0] ||
    preferenceService.getFallbackAccount();

  if (dapp) {
    dappService.patchDapps({
      [origin]: {
        chainId,
        isConnected: true,
        currentAccount: account,
      },
    });
    return;
  }
  if (info) {
    dappService.addDapp({
      origin,
      name: info?.name,
      info,
      isConnected: true,
      chainId,
      currentAccount: account,
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
    currentAccount: account,
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
    currentAccount = preferenceService.getFallbackAccount();
  }
  dappService.patchDapps({
    [origin]: {
      currentAccount,
    },
  });
  const dapp = dappService.getDapp(origin);
  if (dapp?.isConnected) {
    sessionService.broadcastEvent(
      BroadcastEvent.accountsChanged,
      !dapp.currentAccount ? [] : [dapp.currentAccount?.address.toLowerCase()],
      dapp.origin,
    );
  }

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
    chainId: undefined as any,
    name: '',
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

export const syncBasicDappsInfo = async () => {
  const dapps = Object.values(dappService.getDapps());
  const ids = dapps
    .filter(
      item =>
        item.origin?.trim() &&
        Date.now() - (item.infoUpdateAt || 0) > 3 * 24 * 60 * 60 * 1000,
    )
    .map(item => item.origin.replace(/^https?:\/\//, ''));
  if (ids.length) {
    const res = await openapi.getDappsInfo({
      ids,
    });

    dappService.patchDapps(
      res.reduce((accu, item) => {
        if (item.id) {
          const dappOrigin = stringUtils.ensurePrefix(item.id, 'https://');
          if (dappOrigin) {
            const patch: Partial<DappInfo> = {
              info: item,
              infoUpdateAt: Date.now(),
            };
            // if (item?.collected_list?.length) {
            //   patch.isDapp = true;
            // }
            accu[dappOrigin] = patch;
          }
        }
        return accu;
      }, {} as Record<DappInfo['origin'], Partial<DappInfo>>),
    );
  }
};

export const updateDappChain = (dapp: DappInfo) => {
  dappService.updateDapp(dapp);
  const chain = findChain({
    enum: dapp.chainId,
  });
  if (dapp.isConnected && chain) {
    sessionService.broadcastEvent(
      BroadcastEvent.chainChanged,
      {
        chainId: chain.hex,
        networkVersion: chain.network,
      },
      dapp.origin,
    );
  }
};
