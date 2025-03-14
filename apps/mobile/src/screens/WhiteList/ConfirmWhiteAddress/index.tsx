import React, { useEffect } from 'react';
import { Text } from '@/components';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { FooterButtonScreenContainer } from '@/components2024/ScreenContainer/FooterButtonScreenContainer';
import { StackActions, useNavigationState } from '@react-navigation/native';
import { RootNames } from '@/constant/layout';
import { KeyringAccountWithAlias } from '@/hooks/account';
import AddressPopover from '@/screens/Send/components/AddressPopover';
import AddressSource from '@/screens/Send/components/AddressSourceCard';
import { View } from 'react-native';
import RcTipCC from '@/assets2024/icons/common/tips.svg';
import { useWhitelist } from '@/hooks/whitelist';
import { useSafeSetNavigationOptions } from '@/components/AppStatusBar';
import { useRisks } from '@/screens/Send/SubScreens/ConfirmSendAddress/risk';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import { toast } from '@/components2024/Toast';
import { useTranslation } from 'react-i18next';

const ConfirmWhitelistScreen = () => {
  const { styles, colors2024 } = useTheme2024({ getStyle: getStyles });
  const { whitelist, addWhitelist } = useWhitelist();
  const { navigation } = useSafeSetNavigationOptions();
  const { t } = useTranslation();

  const { account } = useNavigationState(
    s => s.routes.find(r => r.name === RootNames.WhitelistConfirm)?.params,
  ) as {
    account: KeyringAccountWithAlias;
  };
  const { risks, addressDesc } = useRisks(account.address);

  const onCancel = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    }
  };
  const handleConfirm = () => {
    addWhitelist(account.address);
  };
  useEffect(() => {
    if (whitelist.some(item => isSameAddress(item, account.address))) {
      navigation.popToTop();
      navigation.dispatch(
        StackActions.push(RootNames.StackTransaction, {
          screen: RootNames.SendTo,
        }),
      );
      toast.success(t('page.whitelist.addSuccessful'));
    }
  }, [account, navigation, t, whitelist]);
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
      <View style={styles.tipContainer}>
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

export default ConfirmWhitelistScreen;

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
    fontFamily: 'SF Pro Rounded',
    color: colors2024['neutral-secondary'],
  },
  addressCard: {
    borderWidth: 1,
    height: 78,
    width: '100%',
  },
  tipItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
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
    fontFamily: 'SF Pro Rounded',
    color: colors2024['neutral-secondary'],
  },
  addressPopover: {
    marginTop: 10,
  },
  tipContainer: {
    marginTop: 65,
  },
}));
