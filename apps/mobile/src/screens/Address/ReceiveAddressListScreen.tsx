import React from 'react';
import { useTheme2024 } from '@/hooks/theme';
import { RootNames } from '@/constant/layout';
import { useNavigation, useRoute } from '@react-navigation/core';
import {
  GetNestedScreenRouteProp,
  RootStackParamsList,
} from '@/navigation-type';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { createGetStyles2024 } from '@/utils/styles';
import NormalScreenContainer2024 from '@/components2024/ScreenContainer/NormalScreenContainer';
import { AccountsPanelInSheetModal } from '@/components/AccountSelector/AccountsPanel';
import { StackActions } from '@react-navigation/native';
import { CHAINS_ENUM } from '@/constant/chains';

type CurrentAddressProps = NativeStackScreenProps<
  RootStackParamsList,
  'StackAddress'
>;

export function ReceiveAddressListScreen(): JSX.Element {
  const { styles } = useTheme2024({ getStyle });
  const navigation = useNavigation<CurrentAddressProps['navigation']>();
  const route =
    useRoute<
      GetNestedScreenRouteProp<
        'AddressNavigatorParamList',
        'ReceiveAddressList'
      >
    >();
  const handleSelect = async account => {
    const params: {
      chainEnum?: CHAINS_ENUM;
      tokenSymbol?: string;
    } = {};
    if (route.params?.chainEnum) {
      params.chainEnum = route.params.chainEnum;
    }
    if (route.params?.tokenSymbol) {
      params.tokenSymbol = route.params.tokenSymbol;
    }
    navigation.dispatch(
      StackActions.push(RootNames.StackTransaction, {
        screen: RootNames.Receive,
        params: {
          account: account,
          ...params,
        },
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
    // paddingBottom: 24,
    height: '100%',
    maxHeight: '100%',
  },
}));
