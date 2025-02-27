import React, { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { Text } from '@/components';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { FooterButtonScreenContainer } from '@/components2024/ScreenContainer/FooterButtonScreenContainer';
import { StackActions, useNavigationState } from '@react-navigation/native';
import { RootNames } from '@/constant/layout';
import { KeyringAccountWithAlias } from '@/hooks/account';
import AddressPopover from '../../components/AddressPopover';
import AddressSource from '../../components/AddressSourceCard';
import { AppSwitch2024 } from '@/components/customized/Switch2024';
import { View } from 'react-native';
import RcTipCC from '@/assets2024/icons/common/tips.svg';
import { useWhitelist } from '@/hooks/whitelist';
import { useSafeSetNavigationOptions } from '@/components/AppStatusBar';

const ConfirmAddressScreen = () => {
  const { styles, colors2024 } = useTheme2024({ getStyle: getStyles });
  const { t } = useTranslation();
  const { isAddrOnWhitelist, addWhitelist, removeWhitelist } = useWhitelist();
  const { navigation } = useSafeSetNavigationOptions();
  const { account } = useNavigationState(
    s => s.routes.find(r => r.name === RootNames.ConfirmAddress)?.params,
  ) as {
    account: KeyringAccountWithAlias;
  };

  const inWhiteList = useMemo(
    () => isAddrOnWhitelist(account.address),
    [account.address, isAddrOnWhitelist],
  );

  const setInWhitelist = useCallback(
    (bool: boolean) => {
      bool ? addWhitelist(account.address) : removeWhitelist(account.address);
    },
    [account.address, addWhitelist, removeWhitelist],
  );

  const onCancel = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    }
  };
  const handleConfirm = () => {
    navigation.dispatch(
      StackActions.push(RootNames.StackTransaction, {
        screen: RootNames.MultiSend,
        params: {
          addressBrandName: account.brandName,
          toAddress: account.address,
        },
      }),
    );
  };
  return (
    <FooterButtonScreenContainer
      as="View"
      buttonGroupProps={{
        onCancel,
        onConfirm: handleConfirm,
      }}
      style={styles.screen}
      footerBottomOffset={56}
      footerContainerStyle={{
        paddingHorizontal: 4,
      }}>
      <AddressPopover address={account.address} />
      <AddressSource account={account} style={styles.addressCard} />
      <View style={styles.whitelist}>
        <Text style={styles.text}>
          {t('page.addressDetail.add-to-whitelist')}
        </Text>
        <AppSwitch2024 onValueChange={setInWhitelist} value={inWhiteList} />
      </View>
      <View>
        <View style={styles.tipItem}>
          <View style={styles.tipIcon}>
            <RcTipCC
              width={14}
              height={14}
              color={colors2024['neutral-info']}
            />
          </View>
          <Text style={styles.tipText}>alert group desc</Text>
        </View>
      </View>
    </FooterButtonScreenContainer>
  );
};

export default ConfirmAddressScreen;

const getStyles = createGetStyles2024(({ colors2024 }) => ({
  screen: {
    paddingHorizontal: 20,
    backgroundColor: colors2024['neutral-bg-1'],
  },
  whitelist: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 15,
    marginBottom: 33,
  },
  text: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
    color: colors2024['neutral-secondary'],
  },
  addressCard: {
    borderWidth: 1,
    height: 78,
    width: '100%',
  },
  tipItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 32,
  },
  tipIcon: {
    width: 14,
    justifyContent: 'center',
    height: 20,
  },
  tipText: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '400',
    color: colors2024['neutral-secondary'],
  },
}));
