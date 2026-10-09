import { FooterButtonScreenContainer } from '@/components2024/ScreenContainer/FooterButtonScreenContainer';
import { toast } from '@/components2024/Toast';
import type { Chain, CHAINS_ENUM } from '@/constant/chains';
import { useTheme2024 } from '@/hooks/theme';
import { findChainByID } from '@/utils/chain';
import { navigationRef } from '@/utils/navigation';
import { WalletIcon } from '@/components2024/WalletIcon/WalletIcon';
import { ReceiveAddressCard } from '@/components2024/ReceiveAddressCard';
import { createGetStyles2024 } from '@/utils/styles';
import { KEYRING_CLASS, KEYRING_TYPE } from '@rabby-wallet/keyring-utils';
import Clipboard from '@react-native-clipboard/clipboard';
import { useIsFocused, useRoute } from '@react-navigation/native';
import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { View, Pressable, ScrollView, Dimensions } from 'react-native';
import { trigger } from 'react-native-haptic-feedback';
import { default as RcIconMCopy } from '@/assets2024/icons/address/mcopy-cc.svg';
import { FooterButtonGroup } from '@/components2024/FooterButtonGroup';
import { useSafeSetNavigationOptions } from '@/components/AppStatusBar';
import { default as RcIconEyeCC } from '@/assets/icons/receive/eye-cc.svg';
import { default as RcIconEyeCloseCC } from '@/assets/icons/receive/eye-close-cc.svg';
import { useGnosisNetworks } from '@/hooks/gnosis/useGnosisNetworks';
import { GetNestedScreenRouteProp } from '@/navigation-type';
import { Text } from '@/components/Typography';
import { BackupReminderCard } from '@/components2024/BackupReminderCard';
import { useRegressionScenario } from '@/devtools/regressionScenarios/react';
import { useBackupReminder } from '@/hooks/account';
import {
  OfflineChainNotify,
  useOfflineChain,
} from '@/screens/Home/components/OfflineChainNotify';
import { rateGuideLastExposureState } from '@/components/RateModal/hooks';
import { TrackedModal } from '@/components/Modal/TrackedModal';
import { MODAL_GATE_IDS } from '@/utils/modalGate';

function formatSafeAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function ReceiveScreen(): JSX.Element {
  const [selectedChain, setSelectedChain] = useState<CHAINS_ENUM | null>(null);
  const { t } = useTranslation();
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const regressionScenario = useRegressionScenario<'Receive'>();

  const route =
    useRoute<
      GetNestedScreenRouteProp<'TransactionNavigatorParamList', 'Receive'>
    >();

  const account = route.params.account;
  const isFocused = useIsFocused();

  const isSafe = useMemo(() => {
    return account?.type === KEYRING_TYPE.GnosisKeyring;
  }, [account]);
  const { data: safeNetworks } = useGnosisNetworks({
    address: isSafe ? account?.address : undefined,
    active: isFocused,
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

  const isWatchMode = useMemo(
    () => account?.type === KEYRING_CLASS.WATCH,
    [account?.type],
  );
  const [isShowWatchModeModal, setIsShowWatchModeModal] = useState(isWatchMode);

  const { setNavigationOptions } = useSafeSetNavigationOptions();

  const [showName, setShowName] = useState(true);

  // Backup reminder logic
  const needsBackupReminder = useBackupReminder(account);
  const offlineChainData = useOfflineChain();
  const txCount = rateGuideLastExposureState(state => state.txCount);

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

  useEffect(() => {
    if (
      !regressionScenario.active ||
      regressionScenario.scenario !== 'send-receive' ||
      !account?.address ||
      isShowWatchModeModal
    ) {
      return;
    }

    if (!regressionScenario.claimOnce('receive-address-ready')) {
      return;
    }

    regressionScenario.report('assertion', {
      assertion: 'receive-address-ready',
      passed: true,
      address: formatSafeAddress(account.address),
      chain: selectedChain || 'all-evm',
      hasQr: true,
    });
  }, [
    account?.address,
    isShowWatchModeModal,
    regressionScenario,
    selectedChain,
  ]);

  const navState = route.params;

  useEffect(() => {
    if (navState?.chainEnum) {
      setSelectedChain(navState.chainEnum);
    }
  }, [navState]);

  useEffect(() => {
    if (
      isSafe &&
      safeNetworks &&
      selectedChain &&
      !safeChains.some(chain => chain.enum === selectedChain)
    ) {
      setSelectedChain(null);
    }
  }, [isSafe, safeNetworks, safeChains, selectedChain]);

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
    toast.success(t('global.copiedSuccessfully'));
    copyAddress();
  };

  return (
    <FooterButtonScreenContainer
      as="View"
      style={styles.screen}
      footerBottomOffset={48}
      buttonProps={{
        title: t('page.receive.copyAddress'),
        icon: <RcIconMCopy color={colors2024['neutral-InvertHighlight']} />,
        onPress: handleCopy,
        disabled: isShowWatchModeModal,
      }}>
      <View style={styles.container}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollViewContent}
          showsVerticalScrollIndicator={false}
          contentInsetAdjustmentBehavior="never"
          automaticallyAdjustContentInsets={false}>
          <View style={styles.receiveContainer}>
            {/* Offline Chain Notify */}
            {txCount > 0 && (
              <OfflineChainNotify
                data={offlineChainData}
                style={styles.offlineChainNotify}
              />
            )}

            {/* Backup Reminder Card */}
            <BackupReminderCard
              visible={needsBackupReminder}
              account={account}
              style={styles.backupReminderCard}
            />

            {/* Original QR Card */}
            <ReceiveAddressCard
              account={account}
              selectedChain={selectedChain}
              onSelectChainChange={setSelectedChain}
              safeChains={safeChains}
              showAddress={showName}
              showQr={!isShowWatchModeModal}
              onCopy={handleCopy}
            />
          </View>
        </ScrollView>

        <TrackedModal
          modalId={MODAL_GATE_IDS.receiveWatchMode}
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
        </TrackedModal>
      </View>
    </FooterButtonScreenContainer>
  );
}

const SCREEN_WIDTH = Dimensions.get('window').width;
const getStyle = createGetStyles2024(({ colors2024 }) => ({
  headerTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    maxWidth: SCREEN_WIDTH - 100,
  },
  screen: {
    backgroundColor: colors2024['neutral-bg-0'],
  },
  container: {
    flex: 1,
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
    width: '100%',
  },
  scrollViewContent: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  receiveContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    paddingTop: 0,
    width: '100%',
  },
  offlineChainNotify: {
    marginHorizontal: 0,
    marginBottom: 12,
    marginTop: 8,
    width: '100%',
  },
  // Backup Reminder Card styles
  backupReminderCard: {
    marginHorizontal: 0,
    marginBottom: 16,
    marginTop: 8,
    width: '100%',
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
    fontWeight: '900',
    flexWrap: 'nowrap',
  },
  walletIcon: {
    width: 25,
    height: 25,
    borderRadius: 7,
  },
  headerIconEye: {
    marginLeft: 4,
  },
}));

export default ReceiveScreen;
