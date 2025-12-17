import { AuthenticationModal2024 } from '@/components/AuthenticationModal/AuthenticationModal2024';
import { AuthenticationModal } from '@/components/AuthenticationModal/AuthenticationModal';
import { apisLock } from '@/core/apis';
import {
  contactService,
  keyringService,
  whitelistService,
} from '@/core/services';
import { addressUtils } from '@rabby-wallet/base-utils';
import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { removeCexId } from '@/utils/addressCexId';
import { zCreate } from '@/core/utils/reexports';
import { resolveValFromUpdater, UpdaterOrPartials } from '@/core/utils/store';
import i18next from 'i18next';

const { isSameAddress } = addressUtils;

// export const whitelistAtom = atom<string[]>([]);
// const enableAtom = atom<boolean>(whitelistService.isWhitelistEnabled());

type WhitelistState = {
  whitelist: string[];
  enable: boolean;
};
const whitelistStore = zCreate<WhitelistState>(() => ({
  whitelist: [],
  enable: false,
}));

function gSetWhitelist(valOrFunc: UpdaterOrPartials<string[]>) {
  whitelistStore.setState(prev => {
    const { newVal, changed } = resolveValFromUpdater(
      prev.whitelist,
      valOrFunc,
      { strict: true },
    );
    if (!changed) return prev;

    return { ...prev, whitelist: newVal };
  });
}

const getWhitelist = async () => {
  const data = await whitelistService.getWhitelist();
  gSetWhitelist(data);
};

export const setWhitelist = async (addresses: string[]) => {
  await whitelistService.setWhitelist(addresses);
  gSetWhitelist(addresses);
};

function setEnable(val: boolean) {
  whitelistStore.setState(prev => ({ ...prev, enable: val }));
}

const getWhitelistEnabled = async () => {
  const data = await whitelistService.isWhitelistEnabled();
  setEnable(data);
};

const gIsAddrOnWhitelist = (
  address?: string,
  whitelist = whitelistStore.getState().whitelist,
) => {
  return isAddrInWhitelist(address, whitelist);
};

export const isAddrInWhitelist = (
  address?: string,
  whitelist: string[] = [],
) => {
  if (!address) {
    return false;
  }

  return whitelist.some(item => isSameAddress(item, address.toLowerCase()));
};

const removeWhitelist = async (address: string) => {
  await whitelistService.removeWhitelist(address);
  removeCexId(address);
  const hasSameAddressLeft = await keyringService.hasAddress(address);
  if (!hasSameAddressLeft) {
    contactService.removeAlias(address);
  }
  await getWhitelist();
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
      return apisLock.throwErrorIfInvalidPwd(password);
    },
    async onFinished() {
      if (bool) {
        await whitelistService.enableWhitelist();
      } else {
        await whitelistService.disableWhiteList();
      }
      setEnable(bool);
    },
  });
};

const init = async () => {
  getWhitelist();
  getWhitelistEnabled();
};

export const useWhitelist = (options?: { disableAutoFetch?: boolean }) => {
  const { whitelist, enable } = whitelistStore(s => s);
  const { t } = useTranslation();

  const addWhitelist = React.useCallback(
    async (
      address: string,
      options?: { hasValidated?: boolean; onAdded?: () => void },
    ) => {
      const { hasValidated = false } = options || {};

      const onFinished = async () => {
        await whitelistService.addWhitelist(address);
        await getWhitelist();
        options?.onAdded?.();
      };

      if (hasValidated) {
        onFinished();
      } else {
        AuthenticationModal2024.show({
          title: t('page.addressDetail.add-to-whitelist'),
          onFinished,
          validationHandler(password) {
            return apisLock.throwErrorIfInvalidPwd(password);
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
      init();
    }
  }, [disableAutoFetch]);

  return {
    init,
    fetchWhitelist: init,
    whitelist,
    enable,
    whitelistEnabled: enable,
    addWhitelist,
    removeWhitelist,
    setWhitelist,
    toggleWhitelist,
    isAddrOnWhitelist,
  };
};
