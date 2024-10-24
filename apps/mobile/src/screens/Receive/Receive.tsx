import React, { useCallback, useMemo, useState, useEffect } from 'react';
import { useGetBinaryMode, useThemeColors } from '@/hooks/theme';
import { StyleSheet, View, Modal, Text } from 'react-native';
import { CustomTouchableOpacity } from '@/components/CustomTouchableOpacity';
import { navigationRef } from '@/utils/navigation';
import { default as RcIconHeaderBack } from '@/assets/icons/header/back-cc.svg';
import { RcIconHeaderEyeClose, RcIconHeaderEye } from '@/assets/icons/home';
import { makeThemeIconFromCC } from '@/hooks/makeThemeIcon';
import {
  RcIconCopyCC,
  IconCheckCC,
  IconRabbyWalletLogo,
} from '@/assets/icons/common';
import { RcIconSAddressRisk } from '@/assets/icons/address';
import { ThemeColors } from '@/constant/theme';
import { useSwitch } from '@/hooks/useSwitch';
import { useCurrentAccount } from '@/hooks/account';
import { KEYRING_CLASS } from '@rabby-wallet/keyring-utils';
import { splitNumberByStep } from '@/utils/number';
import { useTranslation } from 'react-i18next';
import { getWalletIcon } from '@/utils/walletInfo';
import QRCode from 'react-native-qrcode-svg';
import { useNavigationState } from '@react-navigation/native';
import { RootNames } from '@/constant/layout';
import { CHAINS_ENUM } from '@/constant/chains';
import { findChainByEnum } from '@/utils/chain';
import { Button } from '@/components/Button';
import Clipboard from '@react-native-clipboard/clipboard';
import { toast } from '@/components/Toast';
import useCurrentBalance from '@/hooks/useCurrentBalance';
import { TokenItem } from '@rabby-wallet/rabby-api/dist/types';
import { useSafeSetNavigationOptions } from '@/components/AppStatusBar';

const LeftBackIcon = makeThemeIconFromCC(RcIconHeaderBack, {
  onLight: ThemeColors.light['neutral-title-2'],
  onDark: ThemeColors.dark['neutral-title-2'],
});

const RcIconCopy = makeThemeIconFromCC(RcIconCopyCC, {
  onLight: ThemeColors.light['default-blue'],
  onDark: ThemeColors.dark['default-blue'],
});
const IconCheck = makeThemeIconFromCC(IconCheckCC, {
  onLight: ThemeColors.light['default-green'],
  onDark: ThemeColors.dark['default-green'],
});

const hitSlop = {
  top: 10,
  bottom: 10,
  left: 10,
  right: 10,
};

function ReceiveScreen(): JSX.Element {
  const _isDarkTheme = useGetBinaryMode() !== 'light';
  const { setNavigationOptions } = useSafeSetNavigationOptions();

  const [chainTokenInfo, setChainTokenInfo] = useState({
    chainEnum: CHAINS_ENUM.ETH,
    tokenSymbol: null as TokenItem['id'] | null,
  });
  const [clickedCopy, setClickedCopy] = useState(false);
  const { t } = useTranslation();
  const colors = useThemeColors();
  const styles = getStyles(colors, _isDarkTheme);

  const { on: isShowAccount, toggle: toggleShowAccount } = useSwitch(true);
  const { currentAccount: account } = useCurrentAccount();

  const { balance } = useCurrentBalance(account?.address, {
    update: true,
    noNeedBalance: false,
  });
  const isWatchMode = useMemo(
    () => account?.type === KEYRING_CLASS.WATCH,
    [account?.type],
  );
  const [isShowWatchModeModal, setIsShowWatchModeModal] = useState(isWatchMode);

  const navState = useNavigationState(
    s => s.routes.find(r => r.name === RootNames.Receive)?.params,
  ) as
    | { chainEnum?: CHAINS_ENUM | undefined; tokenSymbol?: TokenItem['symbol'] }
    | undefined;

  useEffect(() => {
    if (navState?.chainEnum) {
      setChainTokenInfo({
        chainEnum: navState.chainEnum,
        tokenSymbol: navState.tokenSymbol ?? null,
      });
    }
  }, [navState]);

  const copyAddress = useCallback(() => {
    Clipboard.setString(account?.address || '');
  }, [account?.address]);

  const receiveTitle = useMemo(
    () =>
      t('page.receive.title', {
        chain: findChainByEnum(chainTokenInfo.chainEnum)?.name,
        token: chainTokenInfo.tokenSymbol || t('global.assets'),
      }),
    [chainTokenInfo, t],
  );

  const clickCopyHandler = useCallback(() => {
    if (!clickedCopy) {
      toast.success(`${t('global.copied')} ${account?.address}`);
      setTimeout(() => {
        setClickedCopy(false);
      }, 3000);
    }
    copyAddress();
    setClickedCopy(true);
  }, [account?.address, clickedCopy, copyAddress, setClickedCopy, t]);

  const WalletIcon = useMemo(
    () => (account ? getWalletIcon(account.brandName, true) : () => null),
    [account],
  );

  const navBack = useCallback(() => {
    const navigation = navigationRef.current;
    if (navigation?.canGoBack()) {
      navigation.goBack();
    } else {
      navigationRef.resetRoot({
        index: 0,
        routes: [{ name: 'Root' }],
      });
    }
  }, []);

  React.useLayoutEffect(() => {
    setNavigationOptions({
      headerStyle: {
        backgroundColor: _isDarkTheme
          ? colors['blue-disable']
          : colors['blue-default'],
      },
      headerTitle: () =>
        isShowAccount && account ? (
          <View style={styles.headerTitleContainer}>
            <WalletIcon style={styles.walletIcon} />
            <View>
              <View style={styles.accountInfoContainer}>
                <View
                  className="flex-row align-middle"
                  style={styles.accountInfo}>
                  <Text style={styles.accountInfoName} numberOfLines={1}>
                    {account.aliasName}
                  </Text>

                  <Text style={styles.accountBalance}>
                    ${splitNumberByStep((balance || 0).toFixed(2))}
                  </Text>
                </View>
                {account.type === KEYRING_CLASS.WATCH && (
                  <Text style={styles.accountWatchType}>
                    {t('global.watchModeAddress')}
                  </Text>
                )}
              </View>
            </View>
          </View>
        ) : null,

      headerLeft: ({ tintColor }) => (
        <CustomTouchableOpacity
          style={styles.backButtonStyle}
          hitSlop={hitSlop}
          onPress={navBack}>
          <LeftBackIcon width={24} height={24} color={tintColor} />
        </CustomTouchableOpacity>
      ),

      headerRight: ({ tintColor }) => (
        <CustomTouchableOpacity
          style={styles.watchButtonStyle}
          hitSlop={hitSlop}
          onPress={toggleShowAccount}>
          <View>
            {isShowAccount ? (
              <RcIconHeaderEye width={24} height={24} />
            ) : (
              <RcIconHeaderEyeClose width={24} height={24} />
            )}
          </View>
        </CustomTouchableOpacity>
      ),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    WalletIcon,
    account,
    colors,
    isShowAccount,
    navBack,
    // navigation,
    setNavigationOptions,
    styles.accountBalance,
    styles.accountInfo,
    styles.accountInfoContainer,
    styles.accountInfoName,
    styles.accountWatchType,
    styles.backButtonStyle,
    styles.headerTitleContainer,
    styles.walletIcon,
    styles.watchButtonStyle,
    t,
    toggleShowAccount,
  ]);
  return (
    <View style={styles.container}>
      <View style={styles.receiveContainer}>
        <View style={styles.qrCard}>
          <Text style={styles.qrCardHeader}>{receiveTitle}</Text>
          <View style={styles.qrCardCode}>
            {account?.address && !isShowWatchModeModal ? (
              <QRCode value={account.address} size={190} />
            ) : (
              <View style={styles.qrCodePlaceholder} />
            )}
          </View>
          <Text style={styles.qrCardAddress}>{account?.address}</Text>
          {clickedCopy ? (
            <Button
              buttonStyle={[styles.copyButton, styles.copyButtonSuccess]}
              titleStyle={[styles.copyButtonText, styles.copyButtonTextSuccess]}
              title={t('global.copied')}
              icon={
                <IconCheck width={16} height={16} style={styles.successIcon} />
              }
              onPress={clickCopyHandler}></Button>
          ) : (
            <Button
              buttonStyle={styles.copyButton}
              titleStyle={styles.copyButtonText}
              icon={
                <RcIconCopy width={16} height={16} style={styles.copyIcon} />
              }
              title={t('global.copyAddress')}
              onPress={clickCopyHandler}></Button>
          )}
        </View>
      </View>
      <View style={styles.footer}>
        <IconRabbyWalletLogo />
      </View>

      <Modal
        visible={isShowWatchModeModal}
        className="w-[353] max-w-[100%]"
        onRequestClose={() => {
          setIsShowWatchModeModal(false);
        }}
        transparent
        animationType="fade">
        <View style={styles.overlay}>
          <View
            style={styles.modalContent}
            onStartShouldSetResponder={() => true}>
            <View className="items-center mb-[16]">
              <RcIconSAddressRisk height={52} width={52} />
            </View>

            <Text
              className="text-r-neutral-title1 leading-[22] font-medium text-center mb-[40] mx-[20]"
              style={styles.alertModalText}>
              {t('page.receive.watchModeAlert')}
            </Text>
            <View className="flex-row items-center justify-center w-full mt-[20] px-[20]">
              <View className="flex-1 pr-[5]">
                <Button
                  title="Cancel"
                  buttonStyle={styles.cancelStyle}
                  titleStyle={styles.cancelTitleStyle}
                  onPress={navBack}
                />
              </View>
              <View className="flex-1 pl-[5]">
                <Button
                  title="Confirm"
                  buttonStyle={styles.confirmStyle}
                  titleStyle={styles.confirmTitleStyle}
                  onPress={() => {
                    setIsShowWatchModeModal(false);
                  }}
                />
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const HEADER_OFFSET = 12;

const getStyles = (
  colors: ReturnType<typeof useThemeColors>,
  isDark: boolean,
) =>
  StyleSheet.create({
    container: {
      flex: 1,
      alignItems: 'center',
      backgroundColor: isDark ? colors['blue-disable'] : colors['blue-default'],
    },
    headerTitleContainer: {
      marginTop: HEADER_OFFSET,
      backgroundOpacity: 0.12,
      marginLeft: -20,
      marginRight: -20,
      flexDirection: 'row',
      backgroundColor: 'rgba(255, 255, 255, 0.12)',
      borderRadius: 6,
      paddingHorizontal: 12,
      paddingVertical: 6,
    },
    walletIcon: {
      maxWidth: 20,
      maxHeight: 20,
      width: 20,
      height: 20,
      marginRight: 8,
    },
    accountInfoContainer: {},
    accountInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingTop: 1,
    },
    accountInfoName: {
      fontSize: 15,
      maxWidth: 110,
      fontWeight: '500',
      color: colors['neutral-title-2'],
    },
    accountBalance: {
      fontSize: 13,
      fontWeight: '400',
      color: colors['neutral-title-2'],
      opacity: 0.6,
    },
    accountWatchType: {
      marginTop: 3,
      fontSize: 12,
      fontWeight: '400',
      color: colors['neutral-title-2'],
      opacity: 0.6,
    },
    backButtonStyle: {
      alignItems: 'center',
      flexDirection: 'row',
      marginLeft: -16,
      paddingLeft: 16,
      marginTop: HEADER_OFFSET,
    },
    watchButtonStyle: {
      marginTop: HEADER_OFFSET + 2,
      alignItems: 'center',
      flexDirection: 'row',
      marginRight: -16,
      paddingRight: 16,
    },
    copyButton: {
      width: 180,
      height: 48,
      borderRadius: 4,
      backgroundColor: colors['neutral-card-2'],
    },
    copyButtonText: {
      fontSize: 15,
      fontWeight: '500',
      color: colors['neutral-title-1'],
    },
    copyButtonSuccess: {
      backgroundColor: colors['green-light'],
    },
    copyButtonTextSuccess: {
      color: colors['green-default'],
    },
    successIcon: { color: colors['green-default'], marginLeft: -20 },
    copyIcon: { color: colors['neutral-title-1'], marginLeft: -20 },
    receiveContainer: {
      alignItems: 'center',
      padding: 20,
    },
    qrCard: {
      alignItems: 'center',
      marginTop: 146,
      borderRadius: 16,
      paddingVertical: 40,
      paddingHorizontal: 20,
      backgroundColor: colors['neutral-bg-1'],
    },
    qrCardHeader: {
      fontSize: 20,
      fontWeight: '500',
      color: colors['neutral-title-1'],
      marginBottom: 20,
      textAlign: 'center',
    },
    qrCardCode: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors['neutral-line'],
      borderRadius: 10,
      padding: 10,
      marginBottom: 20,
      backgroundColor: 'white',
    },
    qrCodePlaceholder: {
      width: 190,
      height: 190,
    },
    qrCardAddress: {
      fontSize: 15,
      lineHeight: 20,
      fontWeight: '500',
      color: colors['neutral-title-1'],
      marginBottom: 24,
      textAlign: 'center',
    },
    buttonStyle: {
      width: 268,
      height: 56,
      borderRadius: 8,
      backgroundColor: colors['neutral-title2'],
      boxShadow: '0 8 24 0 rgba(0, 0, 0, 0.11)',
    },
    buttonTitleStyle: {
      fontSize: 17,
      lineHeight: 20,
      fontWeight: '600',
      color: colors['blue-default'],
    },
    cancelStyle: {
      backgroundColor: colors['neutral-card-1'],
      borderColor: colors['blue-default'],
      borderWidth: 1,
      borderStyle: 'solid',
      borderRadius: 8,
      height: 48,

      width: '100%',
    },
    cancelTitleStyle: {
      fontSize: 15,
      lineHeight: 18,
      fontWeight: '500',
      color: colors['blue-default'],
    },
    confirmStyle: {
      backgroundColor: colors['blue-default'],
      height: 48,
      borderRadius: 8,
      width: '100%',
    },
    confirmTitleStyle: {
      fontSize: 15,
      lineHeight: 18,
      fontWeight: '500',
      color: colors['neutral-title2'],
    },
    touchable: {
      height: '100%',
      backgroundColor: colors['red-default'],
    },
    overlay: {
      backgroundColor: 'rgba(0,0,0,0.8)',
      height: '100%',
      justifyContent: 'center',
    },
    modalContent: {
      borderRadius: 16,
      backgroundColor: colors['neutral-bg1'],
      boxShadow: '0 20 20 0 rgba(45, 48, 51, 0.16)',
      marginHorizontal: 20,
      paddingTop: 24,
      paddingBottom: 20,
    },
    footer: {
      position: 'absolute',
      bottom: 50,
    },
    alertModalText: {
      fontSize: 17,
      color: colors['neutral-title1'],
    },
  });

export default ReceiveScreen;
