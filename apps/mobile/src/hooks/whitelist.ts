import { whitelistService } from '@/core/services';
import { addressUtils } from '@rabby-wallet/base-utils';
import { atom, useAtom } from 'jotai';
import React, { useEffect } from 'react';

const { isSameAddress } = addressUtils;

const whitelistAtom = atom<string[]>([]);
const enableAtom = atom<boolean>(false);

export const useWhitelist = () => {
  const [whitelist, setWL] = useAtom(whitelistAtom);
  const [enable, setEnable] = useAtom(enableAtom);

  const getWhitelist = React.useCallback(async () => {
    const data = await whitelistService.getWhitelist();
    setWL(data);
  }, [setWL]);

  const addWhitelist = React.useCallback(
    async (address: string) => {
      await whitelistService.addWhitelist(address);
      getWhitelist();
    },
    [getWhitelist],
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
      await whitelistService.removeWhitelist(addresses);
      await getWhitelist();
    },
    [getWhitelist],
  );

  const toggleWhitelist = async (bool: boolean) => {
    if (bool) {
      await whitelistService.enableWhitelist();
    } else {
      await whitelistService.disableWhiteList();
    }
    setEnable(bool);
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

  useEffect(() => {
    init();
  }, [init]);

  return {
    init,
    whitelist,
    enable,
    addWhitelist,
    removeWhitelist,
    setWhitelist,
    toggleWhitelist,
    isAddrOnWhitelist,
  };
};
