import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Switch } from 'react-native-switch';

import { Text } from '@/components';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { FooterButtonScreenContainer } from '@/components2024/ScreenContainer/FooterButtonScreenContainer';
import { useNavigationState } from '@react-navigation/native';
import { RootNames } from '@/constant/layout';
import { KeyringAccountWithAlias } from '@/hooks/account';
import AddressPopover from '../../components/AddressPopover';
import AddressSource from '../../components/AddressSourceCard';
import { AppSwitch2024 } from '@/components/customized/Switch2024';
import { View } from 'react-native';
import RcTipCC from '@/assets2024/icons/common/tips.svg';
import { useWhitelist } from '@/hooks/whitelist';
import { useSafeSetNavigationOptions } from '@/components/AppStatusBar';
import { useRisks } from './risk';
import { useSendRoutes } from '@/hooks/useSendRoutes';
import { toast } from '@/components2024/Toast';

const ConfirmAddressScreen = () => {
  const { styles, colors2024 } = useTheme2024({ getStyle: getStyles });
  const { t } = useTranslation();
  const { isAddrOnWhitelist, addWhitelist, removeWhitelist } = useWhitelist();
  const { navigation } = useSafeSetNavigationOptions();
  const switchRef = useRef<Switch>(null);

  const { account } = useNavigationState(
    s => s.routes.find(r => r.name === RootNames.ConfirmAddress)?.params,
  ) as {
    account: KeyringAccountWithAlias;
  };
  const { risks, addressDesc } = useRisks(account.address);
  const { navigateToSendScreen } = useSendRoutes();

  const inWhiteList = useMemo(
    () => isAddrOnWhitelist(account.address),
    [account.address, isAddrOnWhitelist],
  );
  useEffect(() => {
    switchRef.current?.setState({ value: inWhiteList });
  }, [inWhiteList]);

  const setInWhitelist = useCallback(
    (bool: boolean) => {
      if (bool) {
        addWhitelist(account.address, {
          onAdded: () => {
            toast.success(t('page.whitelist.addSuccessful'));
          },
        });
      } else {
        removeWhitelist(account.address);
      }
    },
    [account.address, addWhitelist, removeWhitelist, t],
  );

  const onCancel = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    }
  };
  const handleConfirm = () => {
    navigateToSendScreen({
      addressBrandName: account.brandName,
      cexDes: addressDesc?.cex,
      toAddress: account.address,
    });
  };
  return (
    <FooterButtonScreenContainer
      as="View"
      buttonGroupProps={{
        onCancel,
        onConfirm: handleConfirm,
      }}
      style={styles.screen}
      footerBottomOffset={76}
      footerContainerStyle={{
        paddingHorizontal: 4,
      }}>
      <AddressPopover address={account.address} style={styles.addressPopover} />
      <AddressSource
        cexDesc={addressDesc?.cex}
        account={account}
        style={styles.addressCard}
      />
      <View style={styles.whitelist}>
        <Text style={styles.text}>{t('page.whitelist.addToWhitelist')}</Text>
        <AppSwitch2024
          ref={switchRef}
          onValueChange={setInWhitelist}
          value={inWhiteList}
        />
      </View>
      <View style={styles.riskList}>
        {risks.map(risk => (
          <View key={risk.type} style={styles.tipItem}>
            <View style={styles.tipIcon}>
              <RcTipCC
                width={14}
                height={14}
                color={colors2024['neutral-info']}
              />
            </View>
            <Text style={styles.tipText}>{risk.value}</Text>
          </View>
        ))}
      </View>
    </FooterButtonScreenContainer>
  );
};

export default ConfirmAddressScreen;

const getStyles = createGetStyles2024(({ colors2024 }) => ({
  addressPopover: {
    marginTop: 10,
  },
  screen: {
    paddingHorizontal: 20,
    backgroundColor: colors2024['neutral-bg-1'],
  },
  whitelist: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 15,
    marginBottom: 12,
  },
  text: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
    fontFamily: 'SF Pro Rounded',
    color: colors2024['neutral-secondary'],
  },
  addressCard: {
    borderWidth: 1,
    height: 78,
    width: '100%',
  },
  riskList: {
    marginTop: 65,
  },
  tipItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 32,
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
    flex: 1,
    fontFamily: 'SF Pro Rounded',
    color: colors2024['neutral-secondary'],
  },
}));
