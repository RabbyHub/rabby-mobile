import { AuthenticationModal2024 } from '@/components/AuthenticationModal/AuthenticationModal2024';
import { AuthenticationModal } from '@/components/AuthenticationModal/AuthenticationModal';
import { apisLock } from '@/core/apis';
import { contactServiceApi } from '@/core/serviceApi/contact';
import { keyringServiceApi } from '@/core/serviceApi/keyring';
import { whitelistServiceApi } from '@/core/serviceApi/whitelist';
import { addressUtils } from '@rabby-wallet/base-utils';
import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { removeCexId } from '@/utils/addressCexId';
import { zCreate } from '@/core/utils/reexports';
import type { UpdaterOrPartials } from '@/core/utils/store';
import { resolveValFromUpdater } from '@/core/utils/store';
import i18next from 'i18next';
import {
  normalizeWhitelistAddresses,
  type WhitelistRecord,
} from '@/utils/whitelist';
import type { WhitelistService } from '@/core/services/whitelist';
import { useActivityStore } from '@/hooks/storeActivity/useActivityStore';

const { isSameAddress } = addressUtils;

// export const whitelistAtom = atom<string[]>([]);
// const enableAtom = atom<boolean>(whitelistService.isWhitelistEnabled());

type WhitelistState = {
  whitelist: WhitelistRecord[];
  whitelistAddresses: string[];
  enable: boolean;
  hydrated: boolean;
};
const whitelistStore = zCreate<WhitelistState>(() => ({
  whitelist: [],
  whitelistAddresses: [],
  enable: false,
  hydrated: false,
}));

let whitelistRevision = 0;
let whitelistHydrationPromise: Promise<void> | null = null;

function mapWhitelistAddresses(whitelist: WhitelistRecord[]) {
  return whitelist.map(item => item.address);
}

function gSetWhitelist(
  valOrFunc: UpdaterOrPartials<WhitelistRecord[]>,
  options: { hydrated?: boolean } = {},
) {
  whitelistStore.setState(prev => {
    const { newVal, changed } = resolveValFromUpdater(
      prev.whitelist,
      valOrFunc,
      { strict: true },
    );
    if (!changed) {
      return prev;
    }

    return {
      ...prev,
      whitelist: newVal,
      whitelistAddresses: mapWhitelistAddresses(newVal),
      hydrated: options.hydrated ?? prev.hydrated,
    };
  });
}

function applyWhitelistSnapshot(whitelist: WhitelistRecord[], enable: boolean) {
  whitelistStore.setState({
    whitelist,
    whitelistAddresses: mapWhitelistAddresses(whitelist),
    enable,
    hydrated: true,
  });
}

export function prepareWhitelistStoreFromService(service: WhitelistService) {
  whitelistRevision += 1;
  applyWhitelistSnapshot(
    service.getWhitelistRecords(),
    service.isWhitelistEnabled(),
  );
}

const getWhitelist = async (revision = whitelistRevision) => {
  const data = await whitelistServiceApi.getWhitelistRecords();
  if (revision === whitelistRevision) {
    gSetWhitelist(data, { hydrated: true });
  }
};

export const setWhitelist = async (addresses: string[]) => {
  const normalizedAddresses = normalizeWhitelistAddresses(addresses);
  const revision = ++whitelistRevision;

  await whitelistServiceApi.setWhitelist(normalizedAddresses);
  await getWhitelist(revision);
};

export const updateWhitelistOrder = async (addresses: string[]) => {
  const revision = ++whitelistRevision;
  try {
    await whitelistServiceApi.updateWhitelistOrder(addresses);
    await getWhitelist(revision);
    return true;
  } catch {
    try {
      await getWhitelist(revision);
    } catch {
      // Keep the action result deterministic even if the authoritative refresh
      // also fails. The sortable view will reset its local visual order.
    }
    return false;
  }
};

function setEnable(val: boolean, hydrated = true) {
  whitelistStore.setState(prev => ({ ...prev, enable: val, hydrated }));
}

const getWhitelistEnabled = async (revision = whitelistRevision) => {
  const data = await whitelistServiceApi.isWhitelistEnabled();
  if (revision === whitelistRevision) {
    setEnable(data);
  }
};

const gIsAddrOnWhitelist = (
  address?: string,
  whitelist = whitelistStore.getState().whitelist,
) => {
  return isAddrInWhitelist(address, whitelist);
};

export const isAddrInWhitelist = (
  address?: string,
  whitelist: Array<string | WhitelistRecord> = [],
) => {
  if (!address) {
    return false;
  }

  return whitelist.some(item =>
    isSameAddress(
      typeof item === 'string' ? item : item.address,
      address.toLowerCase(),
    ),
  );
};

export const removeWhitelist = async (address: string) => {
  const revision = ++whitelistRevision;
  await whitelistServiceApi.removeWhitelist(address);
  removeCexId(address);
  const hasSameAddressLeft = await keyringServiceApi.hasAddress(address);
  if (!hasSameAddressLeft) {
    await contactServiceApi.removeAlias(address);
  }
  await getWhitelist(revision);
};

const toggleWhitelist = async (bool: boolean) => {
  const t = i18next.t;
  AuthenticationModal.show({
    confirmText: t('global.confirm'),
    cancelText: t('page.dashboard.settings.cancel'),
    title: bool
      ? t('page.dashboard.settings.enableWhitelist')
      : t('page.dashboard.settings.disableWhitelist'),
    description: bool
      ? t('page.dashboard.settings.enableWhitelistTip')
      : t('page.dashboard.settings.disableWhitelistTip'),
    validationHandler: async (password: string) => {
      return apisLock.verifyPasswordOrUnlock(password);
    },
    async onFinished() {
      const revision = ++whitelistRevision;
      if (bool) {
        await whitelistServiceApi.enableWhitelist();
      } else {
        await whitelistServiceApi.disableWhiteList();
      }
      if (revision === whitelistRevision) {
        setEnable(bool);
      }
    },
  });
};

const init = async () => {
  if (!whitelistHydrationPromise) {
    const revision = whitelistRevision;
    whitelistHydrationPromise = Promise.all([
      getWhitelist(revision),
      getWhitelistEnabled(revision),
    ])
      .then(() => undefined)
      .finally(() => {
        whitelistHydrationPromise = null;
      });
  }
  return whitelistHydrationPromise;
};

export const useWhitelist = (options?: { disableAutoFetch?: boolean }) => {
  const { whitelist, whitelistAddresses, enable } = useActivityStore(
    whitelistStore,
    state => state,
    Object.is,
    { storeLabel: 'whitelist' },
  );
  const { t } = useTranslation();

  const addWhitelist = React.useCallback(
    async (
      address: string,
      addOptions?: { hasValidated?: boolean; onAdded?: () => void },
    ) => {
      const { hasValidated = false } = addOptions || {};

      const onFinished = async () => {
        const revision = ++whitelistRevision;
        await whitelistServiceApi.addWhitelist(address);
        await getWhitelist(revision);
        addOptions?.onAdded?.();
      };

      if (hasValidated) {
        return onFinished();
      } else {
        AuthenticationModal2024.show({
          title: t('page.addressDetail.add-to-whitelist'),
          onFinished,
          validationHandler(password) {
            return apisLock.verifyPasswordOrUnlock(password);
          },
        });
      }
    },
    [t],
  );

  const isAddrOnWhitelist = React.useCallback(
    (address?: string) => {
      return gIsAddrOnWhitelist(address, whitelist);
    },
    [whitelist],
  );

  const { disableAutoFetch } = options || {};

  useEffect(() => {
    if (!disableAutoFetch) {
      void init().catch(console.error);
    }
  }, [disableAutoFetch]);

  return {
    init,
    fetchWhitelist: init,
    whitelist: whitelistAddresses,
    whitelistRecords: whitelist,
    enable,
    whitelistEnabled: enable,
    addWhitelist,
    removeWhitelist,
    setWhitelist,
    updateWhitelistOrder,
    toggleWhitelist,
    isAddrOnWhitelist,
  };
};
