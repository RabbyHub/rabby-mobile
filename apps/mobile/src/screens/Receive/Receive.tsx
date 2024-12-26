import { FooterButtonScreenContainer } from '@/components2024/ScreenContainer/FooterButtonScreenContainer';
import { toast } from '@/components2024/Toast';
import { CHAINS_ENUM } from '@/constant/chains';
import { RootNames } from '@/constant/layout';
import { useCurrentAccount } from '@/hooks/account';
import { useTheme2024 } from '@/hooks/theme';
import { findChainByEnum } from '@/utils/chain';
import { navigationRef } from '@/utils/navigation';
import { WalletIcon } from '@/components2024/WalletIcon/WalletIcon';
import { createGetStyles2024 } from '@/utils/styles';
import { KEYRING_CLASS, KEYRING_TYPE } from '@rabby-wallet/keyring-utils';
import { TokenItem } from '@rabby-wallet/rabby-api/dist/types';
import Clipboard from '@react-native-clipboard/clipboard';
import { useNavigationState } from '@react-navigation/native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Text, View, Pressable } from 'react-native';
import { trigger } from 'react-native-haptic-feedback';
import QRCode from 'react-native-qrcode-svg';
import IconMCopy from '@/assets2024/icons/address/mcopy.svg';
import { FooterButtonGroup } from '@/components2024/FooterButtonGroup';
import { useLastUsedAccountInScreen } from '@/hooks/useLastUsedAccountInScreen';
import { ellipsisAddress } from '@/utils/address';

function ReceiveScreen(): JSX.Element {
  const [chainTokenInfo, setChainTokenInfo] = useState({
    chainEnum: CHAINS_ENUM.ETH,
    tokenSymbol: null as TokenItem['id'] | null,
  });
  const { t } = useTranslation();
  const { styles } = useTheme2024({ getStyle });

  const { currentAccount: account } = useCurrentAccount();
  useLastUsedAccountInScreen({ disableAutoEffect: false });

  const name = useMemo(
    () => ellipsisAddress(account?.address || ''),
    [account],
  );
  const isWatchMode = useMemo(
    () => account?.type === KEYRING_CLASS.WATCH,
    [account?.type],
  );
  const [isShowWatchModeModal, setIsShowWatchModeModal] = useState(isWatchMode);

  useEffect(() => {
    // force disapper when not watch address
    if (!isWatchMode) {
      setIsShowWatchModeModal(false);
    }
  }, [isWatchMode]);

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

  const triggerLight = () => {
    trigger('impactLight', {
      enableVibrateFallback: true,
      ignoreAndroidSystemSettings: false,
    });
  };

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

  const handleCopy = () => {
    if (isShowWatchModeModal) {
      return;
    }
    triggerLight();
    toast.success('Copied successfully');
    copyAddress();
  };

  return (
    <FooterButtonScreenContainer
      as="View"
      buttonProps={{
        title: 'Copy address',
        onPress: handleCopy,
        disabled: isShowWatchModeModal,
      }}
      style={styles.screen}
      footerBottomOffset={56}
      footerContainerStyle={{
        paddingHorizontal: 24,
      }}>
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
            <View style={styles.accountBox}>
              <View className="relative">
                <WalletIcon
                  type={account?.type as KEYRING_TYPE}
                  width={styles.walletIcon.width}
                  height={styles.walletIcon.height}
                  style={styles.walletIcon}
                />
              </View>
              <Text
                numberOfLines={1}
                ellipsizeMode="tail"
                style={styles.titleText}>
                {name}
              </Text>
            </View>

            <Pressable
              style={styles.addressDetailContainer}
              onPress={handleCopy}>
              <Text style={styles.qrCardAddress}>
                {account?.address} <IconMCopy width={17} height={17} />
              </Text>
            </Pressable>
          </View>
        </View>

        <Modal
          visible={isShowWatchModeModal}
          onRequestClose={() => {
            setIsShowWatchModeModal(false);
          }}
          transparent
          animationType="fade">
          <View style={styles.overlay}>
            <View
              style={styles.modalContent}
              onStartShouldSetResponder={() => true}>
              <Text style={styles.alertModalText}>
                {t('page.receive.watchModeAlert')}
              </Text>
              <FooterButtonGroup
                style={styles.btns}
                onCancel={navBack}
                onConfirm={() => {
                  setIsShowWatchModeModal(false);
                }}
              />
            </View>
          </View>
        </Modal>
      </View>
    </FooterButtonScreenContainer>
  );
}

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  screen: {
    backgroundColor: colors2024['neutral-bg-2'],
  },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  receiveContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    width: '100%',
  },
  qrCard: {
    alignItems: 'center',
    borderRadius: 30,
    width: '100%',
    paddingVertical: 35,
    backgroundColor: colors2024['neutral-bg-1'],
    paddingHorizontal: 16,
  },
  qrCardHeader: {
    fontSize: 17,
    fontWeight: '700',
    color: colors2024['neutral-title-1'],
    marginBottom: 20,
    fontFamily: 'SF Pro Rounded',
    textAlign: 'center',
  },
  qrCardCode: {
    borderWidth: 1,
    borderColor: colors2024['neutral-line'],
    borderRadius: 10,
    padding: 8,
    marginBottom: 24,
    backgroundColor: 'white',
  },
  qrCodePlaceholder: {
    width: 190,
    height: 190,
  },
  addressDetailContainer: {
    width: '100%',
  },
  qrCardAddress: {
    width: '100%',
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '400',
    color: colors2024['neutral-info'],
    textAlign: 'center',
  },
  overlay: {
    backgroundColor: 'rgba(0,0,0,0.8)',
    height: '100%',
    justifyContent: 'center',
  },
  modalContent: {
    borderRadius: 20,
    backgroundColor: colors2024['neutral-bg-1'],
    boxShadow: '0 20 20 0 rgba(45, 48, 51, 0.16)',
    borderWidth: 1,
    borderColor: colors2024['neutral-line'],
    marginHorizontal: 20,
    paddingHorizontal: 20,
    paddingVertical: 30,
  },
  btns: {
    padding: 0,
    marginTop: 30,
  },
  alertModalText: {
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '700',
    fontFamily: 'SF Pro Rounded',
    textAlign: 'center',
    color: colors2024['neutral-title-1'],
  },
  accountBox: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 9,
    gap: 8,
  },
  titleText: {
    flexShrink: 1,
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '800',
    flexWrap: 'nowrap',
  },
  walletIcon: {
    width: 25,
    height: 25,
    borderRadius: 6.3,
  },
}));

export default ReceiveScreen;
