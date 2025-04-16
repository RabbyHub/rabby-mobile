import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  RefreshControl,
} from 'react-native';
import { useAccounts } from '@/hooks/account';
import { useTheme2024 } from '@/hooks/theme';
import { AddressItemEntry } from './components/AddressItem';
import { AppRootName, RootNames } from '@/constant/layout';
import {
  useFocusEffect,
  useNavigation,
  StackActions,
} from '@react-navigation/core';
import { KEYRING_CLASS } from '@rabby-wallet/keyring-utils';
import { RootStackParamsList } from '@/navigation-type';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { createGetStyles2024 } from '@/utils/styles';
import ArrowRightSVG from '@/assets2024/icons/common/arrow-right-cc.svg';
import { AddressListScreenContainer } from './components/AddressListScreenContainer';
import { useSortAddressList } from './useSortAddressList';
import { AddressEmptyContainer } from './components/AddressEmptyContainer';
import {
  createGlobalBottomSheetModal2024,
  removeGlobalBottomSheetModal2024,
} from '@/components2024/GlobalBottomSheetModal';
import { MODAL_NAMES } from '@/components2024/GlobalBottomSheetModal/types';
import { useSetPasswordFirst } from '@/hooks/useLock';
import { useTranslation } from 'react-i18next';
import { filterMyAccounts } from '@/utils/account';
import { useMultiCurve } from '@/hooks/useMultiCurve';
import { MultiAssets } from './components/MultiAssets';

type CurrentAddressProps = NativeStackScreenProps<
  RootStackParamsList,
  'StackAddress'
>;

export const OtherAddressNav = ({ onPress, text }) => {
  const { styles, colors2024 } = useTheme2024({ getStyle });

  return (
    <TouchableOpacity onPress={onPress} style={styles.sectionFooter}>
      <Text style={styles.headlineText}>{text}</Text>
      <ArrowRightSVG
        style={styles.arrow}
        width={14}
        height={14}
        color={colors2024['neutral-secondary']}
      />
    </TouchableOpacity>
  );
};

export function AddressAssetsOverview(): JSX.Element {
  return (
    <AddressListScreenContainer>
      <MultiAssets />
      {/* <FlatList
        ListEmptyComponent={AddressEmptyContainer}
      /> */}
    </AddressListScreenContainer>
  );
}

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  chart: {
    // paddingVertical: 20,
    paddingHorizontal: 20,
  },
  headline: {
    paddingHorizontal: 8,
    paddingVertical: 16,
  },
  headlineText: {
    fontSize: 16,
    fontFamily: 'SF Pro Rounded',
    fontWeight: '500',
    lineHeight: 20,
    color: colors2024['neutral-secondary'],
  },
  listContainer: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
  },

  itemGap: {
    marginBottom: 12,
  },
  footer: {
    marginTop: 12,
  },
  footerCard: {
    backgroundColor: colors2024['neutral-bg-2'],
    marginBottom: 22,
    padding: 16,
    borderRadius: 20,
  },
  footerMain: {
    height: 46,
    justifyContent: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  footerCardText: {
    color: colors2024['neutral-secondary'],
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 20,
    fontFamily: 'SF Pro Rounded',
  },
  sectionFooter: {
    paddingVertical: 10,
    paddingHorizontal: 8,
    flexDirection: 'row',
    gap: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrow: {
    marginTop: 2,
  },
  footerGap: {
    height: 70,
  },
}));
