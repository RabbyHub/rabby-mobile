import { AuthenticationModal } from '@/components/AuthenticationModal/AuthenticationModal';
import { apisLock } from '@/core/apis';
import { whitelistService } from '@/core/services';
import { addressUtils } from '@rabby-wallet/base-utils';
import { atom, useAtom } from 'jotai';
import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

const { isSameAddress } = addressUtils;

const whitelistAtom = atom<string[]>([]);
const enableAtom = atom<boolean>(whitelistService.isWhitelistEnabled());

export const useWhitelist = (options?: { disableAutoFetch?: boolean }) => {
  const [whitelist, setWL] = useAtom(whitelistAtom);
  const [enable, setEnable] = useAtom(enableAtom);
  const { t } = useTranslation();

  const getWhitelist = React.useCallback(async () => {
    const data = await whitelistService.getWhitelist();
    setWL(data);
  }, [setWL]);

  const addWhitelist = React.useCallback(
    async (address: string, options?: { hasValidated?: boolean }) => {
      const { hasValidated = false } = options || {};

      const onFinished = async () => {
        await whitelistService.addWhitelist(address);
        getWhitelist();
      };

      if (hasValidated) {
        onFinished();
      } else {
        AuthenticationModal.show({
          title: t('page.addressDetail.add-to-whitelist'),
          onFinished,
          validationHandler(password) {
            return apisLock.throwErrorIfInvalidPwd(password);
          },
        });
      }
    },
    [getWhitelist, t],
  );

  const setWhitelist = React.useCallback(
    async (addresses: string[]) => {
      await whitelistService.setWhitelist(addresses);
      setWL(addresses);
    },
    [setWL],
  );

  const removeWhitelist = React.useCallback(
    async (addresses: string) => {
      AuthenticationModal.show({
        title: t('page.addressDetail.remove-from-whitelist'),
        onFinished: async () => {
          await whitelistService.removeWhitelist(addresses);
          await getWhitelist();
        },
        validationHandler(password) {
          return apisLock.throwErrorIfInvalidPwd(password);
        },
      });
    },
    [getWhitelist, t],
  );

  const toggleWhitelist = async (bool: boolean) => {
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

  const getWhitelistEnabled = React.useCallback(async () => {
    const data = await whitelistService.isWhitelistEnabled();
    setEnable(data);
  }, [setEnable]);

  const isAddrOnWhitelist = React.useCallback(
    (address?: string) => {
      if (!address) {
        return false;
      }

      return whitelist.some(item => isSameAddress(item, address.toLowerCase()));
    },
    [whitelist],
  );

  const init = React.useCallback(async () => {
    getWhitelist();
    getWhitelistEnabled();
  }, [getWhitelist, getWhitelistEnabled]);

  const { disableAutoFetch } = options || {};

  useEffect(() => {
    if (!disableAutoFetch) {
      init();
    }
  }, [disableAutoFetch, init]);

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
