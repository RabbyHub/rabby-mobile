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
import { StackActions } from '@react-navigation/native';

type CurrentAddressProps = NativeStackScreenProps<
  RootStackParamsList,
  'StackAddress'
>;

export function ReceiveAddressListScreen(): JSX.Element {
  const { styles } = useTheme2024({ getStyle });
  const navigation = useNavigation<CurrentAddressProps['navigation']>();
  const { switchSceneCurrentAccount } = useSwitchSceneCurrentAccount();
  const handleSelect = async account => {
    await switchSceneCurrentAccount('Receive', account);
    navigation.dispatch(
      StackActions.push(RootNames.StackTransaction, {
        screen: RootNames.Receive,
      }),
    );
  };

  return (
    <NormalScreenContainer2024
      type="linear"
      overwriteStyle={styles.overwriteStyle}>
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
  overwriteStyle: {
    paddingTop: 76,
  },
  accountRoot: {
    paddingTop: 0,
    backgroundColor: 'transparent',
    paddingBottom: 56,
    height: '100%',
    maxHeight: '100%',
  },
}));
