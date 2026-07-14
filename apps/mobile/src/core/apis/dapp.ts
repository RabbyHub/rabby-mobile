import type { SessionProp } from './../services/session';
import type { DappInfo } from '@/core/services/dappService';
import {
  addDappSync,
  disconnectDappSync,
  getDappSnapshot,
  getDappsSnapshot,
  hasDappPermissionSnapshot,
  patchDappsSync,
  removeDappSync,
  updateDappSync,
} from '@/core/serviceApi/dapp';
import {
  getFallbackAccountSnapshot,
  getPinnedAddressSnapshot,
} from '@/core/serviceApi/preference';
import { broadcastSessionEventSync } from '@/core/serviceApi/session';
import { BroadcastEvent } from '@/constant/event';
import type { CHAINS_ENUM } from '@/constant/chains';
import { openapi } from '../request';
import type { BasicDappInfo } from '@rabby-wallet/rabby-api/dist/types';
import { cached } from '@/utils/cache';
import { stringUtils } from '@rabby-wallet/base-utils';
import { getAllAccountsToDisplay } from './account';
import { KEYRING_CLASS } from '@rabby-wallet/keyring-utils';
import { sortAccountList } from '@/utils/sortAccountList';
import { findChain } from '@/utils/chain';
import { createDappBySession } from '@/core/utils/createDappBySession';

export { createDappBySession };

export const removeDapp = (origin: string) => {
  disconnect(origin);
  removeDappSync(origin);
};

export const disconnect = (origin: string) => {
  if (!hasDappPermissionSnapshot(origin)) {
    return;
  }
  broadcastSessionEventSync(BroadcastEvent.accountsChanged, [], origin);
  disconnectDappSync(origin);
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
  const dapp = getDappSnapshot(origin);
  const allAccounts = await getAllAccountsToDisplay();
  const pinAddresses = getPinnedAddressSnapshot();
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
    getFallbackAccountSnapshot();

  if (dapp) {
    patchDappsSync({
      [origin]: {
        chainId,
        isConnected: true,
        currentAccount: account,
      },
    });
    return;
  }
  if (info) {
    addDappSync({
      origin,
      name: info?.name,
      info,
      isConnected: true,
      chainId,
      currentAccount: account,
    });
    return;
  }
  addDappSync({
    ...createDappBySession(
      session || {
        name: '',
        origin,
        icon: '',
      },
    ),
    origin,
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
    currentAccount = getFallbackAccountSnapshot();
  }
  patchDappsSync({
    [origin]: {
      currentAccount,
    },
  });
  const dapp = getDappSnapshot(origin);

  if (dapp?.isConnected) {
    broadcastSessionEventSync(
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

export const syncBasicDappInfo = async (origin: string | string[]) => {
  const input = Array.isArray(origin) ? origin : [origin];
  const ids = input
    .filter(item => !!item)
    .map(item => item.replace(/^https?:\/\//, ''));

  if (!ids.length) return;

  const res = await openapi.getDappsInfo({
    ids: ids,
  });

  patchDappsSync(
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

  return getDappsSnapshot();
};

export const syncBasicDappsInfo = async () => {
  const dapps = Object.values(getDappsSnapshot());
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

    patchDappsSync(
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
  updateDappSync(dapp);
  const chain = findChain({
    enum: dapp.chainId,
  });
  if (dapp.isConnected && chain) {
    broadcastSessionEventSync(
      BroadcastEvent.chainChanged,
      {
        chainId: chain.hex,
        networkVersion: chain.network,
      },
      dapp.origin,
    );
  }
};
