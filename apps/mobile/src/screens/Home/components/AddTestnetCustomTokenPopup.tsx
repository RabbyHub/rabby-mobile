import React from 'react';

import { apiCustomTestnet } from '@/core/apis';
import { useCurrentAccount } from '@/hooks/account';
import { customTestnetTokenToTokenItem } from '@/utils/token';
import { useMemoizedFn } from 'ahooks';
import { useManageTestnetTokenList } from '../hooks/useManageTestnetToken';
import { AbstractPortfolioToken } from '../types';
import { DisplayedToken } from '../utils/project';
import {
  AddCustomTokenPopup,
  AddCustomTokenPopupProps,
} from './AddCustomTokenPopup';

export const AddTestnetCustomTokenPopup = (
  props: Pick<AddCustomTokenPopupProps, 'visible' | 'onClose' | 'onAddToken'>,
) => {
  const { addCustomToken } = useManageTestnetTokenList();
  const { currentAccount } = useCurrentAccount();
  const searchToken = useMemoizedFn(
    async ({
      address,
      chainId,
    }: {
      address: string;
      chainId: number;
      chainServerId: string;
    }) => {
      const token = await apiCustomTestnet.getCustomTestnetToken({
        address: currentAccount!.address,
        chainId: chainId,
        tokenId: address,
      });
      if (!token) {
        return [];
      }
      return [
        new DisplayedToken(
          customTestnetTokenToTokenItem(token),
        ) as AbstractPortfolioToken,
      ];
    },
  );
  return (
    <AddCustomTokenPopup
      {...props}
      onSearchToken={searchToken}
      isTestnet={true}
      onAddToken={async v => {
        await addCustomToken(v);
        props.onAddToken?.(v);
        props.onClose?.();
      }}
    />
  );
};
