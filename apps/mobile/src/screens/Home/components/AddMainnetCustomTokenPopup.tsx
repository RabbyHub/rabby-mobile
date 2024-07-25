import React, { useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { RcIconAddCircle } from '@/assets/icons/address';
import { RcIconCheckedCC } from '@/assets/icons/common';
import {
  AppBottomSheetModal,
  AppBottomSheetModalTitle,
  AssetAvatar,
} from '@/components';
import { FooterButton } from '@/components/FooterButton/FooterButton';
import { FormInput } from '@/components/Form/Input';
import { AppColorsVariants } from '@/constant/theme';
import { useThemeColors } from '@/hooks/theme';
import { useSheetModals } from '@/hooks/useSheetModal';
import { ChainInfo } from '@/screens/Send/components/ChainInfo';
import { formatTokenAmount } from '@/utils/number';
import { BottomSheetModal } from '@gorhom/bottom-sheet';
import {
  AddCustomTokenPopup,
  AddCustomTokenPopupProps,
} from './AddCustomTokenPopup';
import { useMemoizedFn } from 'ahooks';
import { useCurrentAccount } from '@/hooks/account';
import { openapi } from '@/core/request';
import { DisplayedToken } from '../utils/project';
import { AbstractPortfolioToken } from '../types';
import { useManageTokenList } from '../hooks/useManageToken';
import { isAddress } from 'web3-utils';

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
