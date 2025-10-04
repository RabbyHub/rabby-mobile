import { FooterButtonScreenContainer } from '@/components2024/ScreenContainer/FooterButtonScreenContainer';
import { toast } from '@/components2024/Toast';
import { Chain, CHAINS_ENUM } from '@/constant/chains';
import { RootNames } from '@/constant/layout';
import { useTheme2024 } from '@/hooks/theme';
import { findChainByEnum, findChainByID } from '@/utils/chain';
import { navigationRef } from '@/utils/navigation';
import { WalletIcon } from '@/components2024/WalletIcon/WalletIcon';
import { Button } from '@/components2024/Button';
import { createGetStyles2024 } from '@/utils/styles';
import { KEYRING_CLASS, KEYRING_TYPE } from '@rabby-wallet/keyring-utils';
import { TokenItem } from '@rabby-wallet/rabby-api/dist/types';
import Clipboard from '@react-native-clipboard/clipboard';
import { useRoute } from '@react-navigation/native';
import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Text, View, Pressable, Image } from 'react-native';
import { trigger } from 'react-native-haptic-feedback';
import QRCode from 'react-native-qrcode-svg';
import { default as RcIconMCopy } from '@/assets2024/icons/address/mcopy-cc.svg';
import { FooterButtonGroup } from '@/components2024/FooterButtonGroup';
import { useSafeSetNavigationOptions } from '@/components/AppStatusBar';
import {
  createGlobalBottomSheetModal2024,
  removeGlobalBottomSheetModal2024,
} from '@/components2024/GlobalBottomSheetModal';
import { TestnetChainLogo } from '@/components/Chain/TestnetChainLogo';
import { default as RcIconEyeCC } from '@/assets/icons/receive/eye-cc.svg';
import { default as RcIconEyeCloseCC } from '@/assets/icons/receive/eye-close-cc.svg';
import { RcArrowRightCC } from '@/assets/icons/common';
import { MODAL_NAMES } from '@/components2024/GlobalBottomSheetModal/types';
import { useGnosisNetworks } from '@/hooks/gnosis/useGnosisNetworks';
import { GetNestedScreenRouteProp } from '@/navigation-type';

function ReceiveScreen(): JSX.Element {
  const [selectedChain, setSelectedChain] = useState<CHAINS_ENUM | null>(null);
  const { t } = useTranslation();
  const { styles, colors2024 } = useTheme2024({ getStyle });

  const route =
    useRoute<
      GetNestedScreenRouteProp<'TransactionNavigatorParamList', 'Receive'>
    >();

  const account = route.params.account;

  const isSafe = useMemo(() => {
    return account?.type === KEYRING_TYPE.GnosisKeyring;
  }, [account]);
  const { data: safeNetworks } = useGnosisNetworks({
    address: isSafe ? account?.address : undefined,
  });
  const safeChains = useMemo(() => {
    if (!safeNetworks || safeNetworks.length <= 0) {
      return [];
    }
    const chains: Chain[] = [];
    for (let i = 0; i < safeNetworks.length; i++) {
      const chain = findChainByID(Number(safeNetworks[i]));
      if (chain) {
        chains.push(chain);
      }
    }
    return chains;
  }, [safeNetworks]);

  const selectedChainInfo = useMemo(() => {
    if (!selectedChain) {
      return null;
    }
    return findChainByEnum(selectedChain);
  }, [selectedChain]);

  const addressSplit = useMemo(() => {
    if (!account?.address) {
      return [];
    }
    const prefix = account.address.slice(0, 8);
    const middle = account.address.slice(8, -6);
    const suffix = account.address.slice(-6);

    return [prefix, middle, suffix];
  }, [account]);

  const isWatchMode = useMemo(
    () => account?.type === KEYRING_CLASS.WATCH,
    [account?.type],
  );
  const [isShowWatchModeModal, setIsShowWatchModeModal] = useState(isWatchMode);

  const { setNavigationOptions } = useSafeSetNavigationOptions();

  const [showName, setShowName] = useState(true);

  const headerTitle = useMemo(
    () => (
      <View style={styles.headerTitle}>
        {showName ? (
          <>
            <WalletIcon
              type={account?.type as KEYRING_TYPE}
              address={account?.address}
              width={styles.walletIcon.width}
              height={styles.walletIcon.height}
              style={styles.walletIcon}
            />
            <Text
              numberOfLines={1}
              ellipsizeMode="tail"
              style={styles.titleText}>
              {account?.aliasName}
            </Text>
          </>
        ) : (
          <Text style={styles.titleText}>******</Text>
        )}
        <Pressable
          style={styles.headerIconEye}
          onPress={() => setShowName(e => !e)}>
          {showName ? (
            <RcIconEyeCC
              width={20}
              height={20}
              color={colors2024['neutral-title-1']}
            />
          ) : (
            <RcIconEyeCloseCC
              width={20}
              height={20}
              color={colors2024['neutral-title-1']}
            />
          )}
        </Pressable>
      </View>
    ),
    [
      styles.headerTitle,
      styles.walletIcon,
      styles.titleText,
      styles.headerIconEye,
      showName,
      account?.type,
      account?.address,
      account?.aliasName,
      colors2024,
    ],
  );

  useLayoutEffect(() => {
    setNavigationOptions({
      headerTitle: () => headerTitle,
    });
  }, [setNavigationOptions, headerTitle]);

  useEffect(() => {
    // force disapper when not watch address
    if (!isWatchMode) {
      setIsShowWatchModeModal(false);
    }
  }, [isWatchMode]);

  const navState = route.params;

  useEffect(() => {
    if (navState?.chainEnum) {
      setSelectedChain(navState.chainEnum);
    }
  }, [navState]);

  const handleSelectChain = () => {
    const id = createGlobalBottomSheetModal2024({
      name: MODAL_NAMES.SELECT_CHAIN_WITH_SUMMARY,
      value: selectedChain,
      account: account,
      bottomSheetModalProps: {
        enableContentPanningGesture: true,
        rootViewType: 'View',
        enablePanDownToClose: true,
      },
      supportChains: isSafe ? safeChains.map(item => item.enum) : undefined,
      titleText: t('page.receiveAddressList.selectChainTitle'),
      onChange: (v: CHAINS_ENUM) => {
        setSelectedChain(v);
        removeGlobalBottomSheetModal2024(id);
      },
      onClose: () => {
        removeGlobalBottomSheetModal2024(id);
      },
    });
  };

  const copyAddress = useCallback(() => {
    Clipboard.setString(account?.address || '');
  }, [account?.address]);

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

  const safeChainsUI =
    selectedChain || safeChains.length === 1 ? (
      <View style={styles.selectChainWrapper}>
        <Image
          style={styles.selectChianLogo}
          source={{ uri: (selectedChainInfo || safeChains[0])?.logo }}
          width={23}
          height={23}
        />
        <Text style={styles.selectChainText}>
          {(selectedChainInfo || safeChains[0])?.name}
        </Text>
      </View>
    ) : (
      <View
        style={{
          ...styles.selectChainWrapper,
          ...styles.safeSelectChainWrapper,
        }}>
        {safeChains.length > 0 &&
          safeChains
            .slice(0, 5)
            .map(chain => (
              <Image
                style={{ ...styles.selectChianLogo, ...styles.safeChainLogo }}
                source={{ uri: chain.logo }}
                width={23}
                height={23}
                key={chain.serverId}
              />
            ))}
      </View>
    );
  const nonSafeChainUI = selectedChain ? (
    <View style={styles.selectChainWrapper}>
      {selectedChainInfo?.isTestnet ? (
        <TestnetChainLogo
          size={23}
          name={selectedChainInfo.name}
          style={styles.selectChianLogo}
        />
      ) : (
        <Image
          style={styles.selectChianLogo}
          source={{ uri: selectedChainInfo?.logo }}
          width={23}
          height={23}
        />
      )}
      <Text style={styles.selectChainText}>{selectedChainInfo?.name}</Text>
    </View>
  ) : (
    t('page.receive.allEVMChain')
  );

  return (
    <FooterButtonScreenContainer
      as="View"
      style={styles.screen}
      footerBottomOffset={56}>
      <View style={styles.container}>
        <View style={styles.receiveContainer}>
          <View style={styles.qrCard}>
            <Text style={styles.qrCardHeader}>
              {t('page.receive.newTitle')}
            </Text>
            <Button
              titleStyle={styles.selectChainText}
              title={isSafe ? safeChainsUI : nonSafeChainUI}
              buttonStyle={styles.selectChain}
              iconRight={
                <RcArrowRightCC
                  width={15}
                  height={15}
                  color={colors2024['neutral-title-1']}
                />
              }
              onPress={handleSelectChain}
            />
            <View style={styles.qrCardCode}>
              {account?.address && !isShowWatchModeModal ? (
                <QRCode value={account.address} size={190} />
              ) : (
                <View style={styles.qrCodePlaceholder} />
              )}
            </View>

            <Pressable
              style={styles.addressDetailContainer}
              onPress={handleCopy}>
              <Text style={styles.qrCardAddress}>
                <Text style={styles.highlightAddrPart}>{addressSplit[0]}</Text>
                {addressSplit[1]}
                <Text style={styles.highlightAddrPart}>{addressSplit[2]}</Text>
              </Text>
            </Pressable>
          </View>
          <Button
            title={t('page.receive.copyAddress')}
            icon={<RcIconMCopy color={colors2024['neutral-InvertHighlight']} />}
            onPress={handleCopy}
            disabled={isShowWatchModeModal}
            type="primary"
            containerStyle={{
              width: '100%',
            }}
          />
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
  headerTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  screen: {
    backgroundColor: colors2024['neutral-bg-1'],
  },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  receiveContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    width: '100%',
  },
  qrCard: {
    alignItems: 'center',
    borderRadius: 30,
    width: 320,
    paddingTop: 23,
    paddingBottom: 35,
    backgroundColor: colors2024['neutral-bg-1'],
    paddingHorizontal: 30,
    borderWidth: 1,
    borderColor: colors2024['neutral-line'],
    marginBottom: 48,
  },
  qrCardHeader: {
    fontSize: 17,
    lineHeight: 20,
    fontWeight: '500',
    color: colors2024['neutral-secondary'],
    marginBottom: 6,
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
    fontFamily: 'SF Pro Rounded',
    width: '100%',
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '500',
    color: colors2024['neutral-secondary'],
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
    borderRadius: 7,
  },
  selectChain: {
    display: 'flex',
    flexDirection: 'row',
    paddingTop: 8,
    paddingBottom: 8,
    paddingLeft: 12,
    paddingRight: 6,
    backgroundColor: colors2024['neutral-bg-2'],
    // borderRadius: 100,
    alignItems: 'center',
    marginBottom: 20,
    width: 'auto',
    height: 'auto',
  },
  selectChainWrapper: {
    display: 'flex',
    flexDirection: 'row',
  },
  selectChianLogo: {
    marginRight: 4,
  },
  selectChainText: {
    fontFamily: 'SF Pro',
    fontSize: 17,
    fontWeight: '700',
    lineHeight: 22,
    color: colors2024['neutral-title-1'],
  },
  highlightAddrPart: {
    color: colors2024['neutral-title-1'],
  },
  headerIconEye: {
    marginLeft: 4,
  },
  safeChainLogo: {
    borderColor: colors2024['neutral-bg-2'],
    borderWidth: 2,
    marginRight: 0,
    borderRadius: 50,
  },
  safeSelectChainWrapper: {
    gap: -6,
  },
}));

export default ReceiveScreen;
