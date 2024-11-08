import React, { useMemo, useEffect } from 'react';
import { View, Text, SectionList, TouchableOpacity } from 'react-native';
import { useNavigationState } from '@react-navigation/native';
import { useAccounts, usePinAddresses } from '@/hooks/account';
import { useTheme2024 } from '@/hooks/theme';
import { AddressItem } from './components/AddressItem';
import { RootNames } from '@/constant/layout';
import { useNavigation } from '@react-navigation/core';
import { addressUtils } from '@rabby-wallet/base-utils';
import { KEYRING_CLASS } from '@rabby-wallet/keyring-utils';
import groupBy from 'lodash/groupBy';
import { sortAccountsByBalance } from '@/utils/account';
import { useOpenDappView } from '../Dapps/hooks/useDappView';
import { RootStackParamsList } from '@/navigation-type';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { redirectToAddAddressEntry } from '@/utils/navigation';
import { createGetStyles2024 } from '@/utils/styles';
import { FooterButtonScreenContainer } from '@/components2024/ScreenContainer/FooterButtonScreenContainer';
import WalletSVG from '@/assets2024/icons/common/wallet-cc.svg';
import ArrowRightSVG from '@/assets2024/icons/common/arrow-right-cc.svg';

type CurrentAddressProps = NativeStackScreenProps<
  RootStackParamsList,
  'StackAddress'
>;

const OtherAddressNav = ({ onPress, text }) => {
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

export function AddressListScreen(): JSX.Element {
  const { accounts } = useAccounts();
  const { pinAddresses: highlightedAddresses } = usePinAddresses({
    disableAutoFetch: true,
  });
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const { openUrlAsDapp } = useOpenDappView();

  const navState = useNavigationState(
    s => s.routes.find(r => r.name === RootNames.AddressList)?.params,
  ) as
    | {
        backToDappOnClose?: string | undefined;
      }
    | undefined;

  React.useEffect(() => {
    return () => {
      if (navState?.backToDappOnClose) {
        openUrlAsDapp(navState?.backToDappOnClose, {
          showSheetModalFirst: false,
        });
      }
    };
  }, [navState, openUrlAsDapp]);

  const navigation = useNavigation<CurrentAddressProps['navigation']>();

  const gotoAddAddress = React.useCallback(() => {
    redirectToAddAddressEntry({ action: 'classical:push' });
  }, []);

  const hasWatchAddress = React.useMemo(() => {
    return accounts.some(account => account.type === KEYRING_CLASS.WATCH);
  }, [accounts]);
  const hasSafeAddress = React.useMemo(() => {
    return accounts.some(account => account.type === KEYRING_CLASS.GNOSIS);
  }, [accounts]);

  const sectionData = useMemo(() => {
    const restAccounts = [...accounts];
    let highlightedAccounts: typeof accounts = [];

    highlightedAddresses.forEach(highlighted => {
      const idx = restAccounts.findIndex(
        account =>
          addressUtils.isSameAddress(account.address, highlighted.address) &&
          account.brandName === highlighted.brandName,
      );
      if (idx > -1) {
        highlightedAccounts.push(restAccounts[idx]);
        restAccounts.splice(idx, 1);
      }
    });
    const data = groupBy(restAccounts, e =>
      e.type === KEYRING_CLASS.WATCH ? '1' : '0',
    );
    highlightedAccounts = sortAccountsByBalance(highlightedAccounts);

    const normalAccounts = highlightedAccounts
      .concat(sortAccountsByBalance(data['0'] || []))
      .filter(e => !!e);

    return [
      {
        title: 'address',
        data: normalAccounts,
      },
    ];
  }, [accounts, highlightedAddresses]);

  useEffect(() => {
    if (!accounts?.length) {
      redirectToAddAddressEntry({ action: 'classical:resetTo' });
    }
  }, [accounts, navigation]);

  const onGotoWatchAddress = React.useCallback(() => {
    navigation.navigate(RootNames.StackAddress, {
      screen: RootNames.WatchAddressList,
    });
  }, [navigation]);

  const onGotoSafeAddress = React.useCallback(() => {
    navigation.navigate(RootNames.StackAddress, {
      screen: RootNames.SafeAddressList,
    });
  }, [navigation]);

  return (
    <FooterButtonScreenContainer
      footerContainerStyle={styles.footer}
      buttonProps={{
        title: (
          <View style={styles.buttonTitle}>
            <WalletSVG
              width={20}
              height={20}
              color={colors2024['brand-default']}
            />
            <Text style={styles.buttonTitleText}>Add an Address</Text>
          </View>
        ),
        type: 'ghost',
        onPress: gotoAddAddress,
        buttonStyle: {
          marginTop: 20,
          width: 200,
          margin: 'auto',
          backgroundColor: 'transparent',
        },
      }}
      footerBottomOffset={76}>
      <View style={styles.headline}>
        <Text style={styles.headlineText}>My Address ({accounts?.length})</Text>
      </View>
      <SectionList
        initialNumToRender={15}
        sections={sectionData}
        keyExtractor={React.useCallback(
          item => `${item.address}-${item.type}-${item.brandName}`,
          [],
        )}
        style={styles.listContainer}
        renderItem={React.useCallback(
          ({ item, index, section }) => (
            <View
              key={`${item.address}-${item.type}-${item.brandName}-${index}`}
              style={
                index < section.data.length - 1 ? styles.itemGap : undefined
              }>
              <AddressItem account={item} />
            </View>
          ),
          [styles.itemGap],
        )}
        renderSectionFooter={() => {
          return (
            <View>
              {hasSafeAddress && (
                <OtherAddressNav
                  onPress={onGotoSafeAddress}
                  text={'Imported Safe Address'}
                />
              )}
              {hasWatchAddress && (
                <OtherAddressNav
                  onPress={onGotoWatchAddress}
                  text={'Imported Watch-only address'}
                />
              )}
            </View>
          );
        }}
      />
    </FooterButtonScreenContainer>
  );
}

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  headline: {
    paddingHorizontal: 28,
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
    paddingHorizontal: 16,
  },
  itemGap: {
    marginBottom: 12,
  },
  buttonTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  buttonTitleText: {
    fontSize: 17,
    fontWeight: '700',
    fontFamily: 'SF Pro Rounded',
    color: colors2024['brand-default'],
  },
  footer: {
    alignItems: 'center',
  },
  sectionFooter: {
    paddingVertical: 24,
    paddingHorizontal: 8,
    flexDirection: 'row',
    gap: 2,
    alignItems: 'center',
  },
  arrow: {
    marginTop: 2,
  },
}));
