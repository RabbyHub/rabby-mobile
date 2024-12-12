import React from 'react';
import { useTheme2024 } from '@/hooks/theme';
import { RootNames } from '@/constant/layout';
import { useNavigation } from '@react-navigation/core';
import { RootStackParamsList } from '@/navigation-type';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { createGetStyles2024 } from '@/utils/styles';
import NormalScreenContainer2024 from '@/components2024/ScreenContainer/NormalScreenContainer';
import { AccountsPanelInSheetModal } from '@/components/AccountSelector/AccountsPanel';
import { useSwitchSceneCurrentAccount } from '@/hooks/accountsSwitcher';
import {
  createGlobalBottomSheetModal2024,
  removeGlobalBottomSheetModal2024,
} from '@/components2024/GlobalBottomSheetModal';
import { StackActions } from '@react-navigation/native';

import { MODAL_NAMES } from '@/components2024/GlobalBottomSheetModal/types';
import { CHAINS_ENUM } from '@debank/common';
import { useTranslation } from 'react-i18next';

type CurrentAddressProps = NativeStackScreenProps<
  RootStackParamsList,
  'StackAddress'
>;

export function ReceiveAddressListScreen(): JSX.Element {
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const navigation = useNavigation<CurrentAddressProps['navigation']>();

  const { t } = useTranslation();
  const { switchSceneCurrentAccount } = useSwitchSceneCurrentAccount();
  const handleSelect = async account => {
    await switchSceneCurrentAccount('Receive', account);
    const id = createGlobalBottomSheetModal2024({
      name: MODAL_NAMES.SELECT_SORTED_CHAIN,
      titleText: t('page.receiveAddressList.selectChainTitle'),
      onChange: (v: CHAINS_ENUM) => {
        removeGlobalBottomSheetModal2024(id);
        navigation.dispatch(
          StackActions.push(RootNames.StackTransaction, {
            screen: RootNames.Receive,
            params: {
              chainEnum: v,
            },
          }),
        );
      },
      onClose: () => {
        removeGlobalBottomSheetModal2024(id);
      },
    });
  };

  return (
    <NormalScreenContainer2024
      type="linear"
      linearProp={{
        colors: [colors2024['neutral-bg-2'], colors2024['neutral-bg-3']],
        locations: [0.2072, 0.3181],
        start: { x: 0.5, y: 0 },
        end: { x: 0.5, y: 1 },
      }}>
      <AccountsPanelInSheetModal
        containerStyle={styles.accountRoot}
        onSelectAccount={handleSelect}
        scene="receive"
        defaultPressItemAction="copy"
      />
    </NormalScreenContainer2024>
  );
}

const getStyle = createGetStyles2024(() => ({
  accountRoot: {
    backgroundColor: 'transparent',
    paddingBottom: 56,
    height: '100%',
    maxHeight: '100%',
  },
}));
