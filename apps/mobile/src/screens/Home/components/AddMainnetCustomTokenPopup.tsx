import React from 'react';

import { openapi } from '@/core/request';
import { useCurrentAccount } from '@/hooks/account';
import { useMemoizedFn } from 'ahooks';
import { isAddress } from 'web3-utils';
import { useManageTokenList } from '../hooks/useManageToken';
import { AbstractPortfolioToken } from '../types';
import { DisplayedToken } from '../utils/project';
import {
  AddCustomTokenPopup,
  AddCustomTokenPopupProps,
} from './AddCustomTokenPopup';

export const AddMainnetCustomTokenPopup = (
  props: Pick<AddCustomTokenPopupProps, 'visible' | 'onClose'>,
) => {
  const { addCustomToken } = useManageTokenList();
  const { currentAccount } = useCurrentAccount();
  const searchToken = useMemoizedFn(
    async ({
      address,
      chainServerId,
    }: {
      address: string;
      chainId: number;
      chainServerId: string;
    }) => {
      if (!currentAccount?.address || !isAddress(address)) {
        return [];
      }
      const list = await openapi.searchToken(
        currentAccount?.address,
        address,
        chainServerId,
        true,
      );
      return (list || []).map(item => {
        return new DisplayedToken(item) as AbstractPortfolioToken;
      });
    },
  );
  return (
    <AddCustomTokenPopup
      {...props}
      onSearchToken={searchToken}
      isTestnet={false}
      onAddToken={async v => {
        await addCustomToken(v);
        props.onClose?.();
      }}
    />
  );
};
