import React, { useCallback, useRef } from 'react';
import { Alert, Linking, Platform, ScrollView, Text, View } from 'react-native';

import {
  RcClearPending,
  RcEarth,
  RcFeedback,
  RcLockWallet,
  RcAutoLockTime,
  RcScreenshot,
  RcFollowUs,
  RcInfo,
  RcTermsOfUse,
  RcPrivacyPolicy,
  RcScreenRecord,
  RcThemeMode,
  RcWhitelist,
  RcAddCustomNetwork,
  RcRPC,
  RcGoogleDrive,
  RcCode,
  RcI18n,
} from '@/assets/icons/settings';
import RcFooterLogo from '@/assets/icons/settings/footer-logo.svg';

import {
  BUILD_CHANNEL,
  BUILD_GIT_INFO,
  isNonPublicProductionEnv,
  isSelfhostRegPkg,
  NEED_DEVSETTINGBLOCKS,
} from '@/constant/env';
import { RootNames } from '@/constant/layout';
import {
  SHOULD_SUPPORT_DARK_MODE,
  useAppTheme,
  useTheme2024,
  useThemeColors,
} from '@/hooks/theme';
import { useSafeAndroidBottomSizes } from '@/hooks/useAppLayout';
import { type SettingConfBlock, Block } from './Block';
import { useSheetWebViewTester } from './sheetModals/hooks';
import SheetWebViewTester from './sheetModals/SheetWebViewTester';

import type { SwitchToggleType } from '@/components';
import { SwitchAllowScreenshot } from './components/SwitchAllowScreenshot';
import { SwitchBiometricsAuthentication } from './components/SwitchBiometricsAuthentication';
import { SwitchWhitelistEnable } from './components/SwitchWhitelistEnable';

import { toast } from '@/components/Toast';
import { APP_FEATURE_SWITCH, APP_URLS, APP_VERSIONS } from '@/constant';
import { clearPendingTxs } from '@/core/apis/transactions';
import { openExternalUrl } from '@/core/utils/linking';
import { useCurrentAccount } from '@/hooks/account';
import { useRabbyAppNavigation } from '@/hooks/navigation';
import { useUpgradeInfo } from '@/hooks/version';
import { createGetStyles2024 } from '@/utils/styles';
import { BottomSheetModal } from '@gorhom/bottom-sheet';
import { StackActions, useFocusEffect } from '@react-navigation/native';
import {
  ManagePasswordSheetModal,
  ResetPasswordAndKeyringsSheetModal,
} from '../ManagePassword/components/ManagePasswordSheetModal';

import { useBiometrics, useBiometricsComputed } from '@/hooks/biometrics';
import { useIsForceAllowScreenshot } from '@/hooks/appSettings';
import { SelectAutolockTimeBottomSheetModal } from './components/SelectAutolockTimeBottomSheetModal';
import {
  AutoLockCountDownLabel,
  AutoLockSettingLabel,
} from './components/LockAbout';
import { sheetModalRefsNeedLock, useSetPasswordFirst } from '@/hooks/useLock';
import { getBiometricsIcon } from '@/components/AuthenticationModal/BiometricsIcon';
import { AuthenticationModal } from '@/components/AuthenticationModal/AuthenticationModal';
import { SwitchShowFloatingAutoLockCountdown } from './components/SwitchFloatingView';
import { ConfirmBottomSheetModal } from './components/ConfirmBottomSheetModal';
import { useShowMarkdownInWebVIewTester } from './sheetModals/MarkdownInWebViewTester';
import ThemeSelectorModal, {
  useThemeSelectorModalVisible,
} from './sheetModals/ThemeSelector';
import { RABBY_GENESIS_NFT_DATA } from '../SendNFT/testData';
import RootScreenContainer from '@/components/ScreenContainer/RootScreenContainer';
import { ScreenSpecificStatusBar } from '@/components/FocusAwareStatusBar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DevForceLocalVersionSelector, {
  useLocalVersionSelectorModalVisible,
} from './sheetModals/DevForceLocalVersionSelector';
import { useShowUserAgreementLikeModal } from '../ManagePassword/components/UserAgreementLikeModalInner';
import CloudDriveTestItemModal, {
  useCloudDriveTestItemModalVisible,
} from './sheetModals/DevCloudDrive';
import WalletLockTestItemModal, {
  useWalletLockTestItemModalVisible,
} from './sheetModals/DevWalletLock';
import DevUIPlaygroundModal, {
  useDevUIPlaygroundModalVisible,
} from './sheetModals/DevUIPlayground';
import DevDataPlayground, {
  useDevDataPlaygroundModalVisible,
} from './sheetModals/DevDataPlayground';
import DevUIWipModal, {
  useUIDevWipModalVisiable,
} from './sheetModals/DevUIWip';
import CurrentLanguageSelectorModal, {
  useCurrentLanguageModalVisible,
} from './sheetModals/LanguageSelector';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import { useSQLiteStatics } from '@/databases/hooks/_statics';

const LAYOUTS = {
  fiexedFooterHeight: 50,
};

const isIOS = Platform.OS === 'ios';

const { switchBiometricsRef, selectAutolockTimeRef } = sheetModalRefsNeedLock;
function SettingsBlocks() {
  const colors = useThemeColors();

  const { currentAccount } = useCurrentAccount();

  const clearPendingRef = useRef<BottomSheetModal>(null);

  const { shouldRedirectToSetPasswordBefore } = useSetPasswordFirst();
  // const selectAutolockTimeRef = useRef<BottomSheetModal>(null);
  const startSelectAutolockTime = useCallback(() => {
    if (
      shouldRedirectToSetPasswordBefore({ onSettingsAction: 'setAutoLockTime' })
    )
      return;
    selectAutolockTimeRef.current?.present();
  }, [shouldRedirectToSetPasswordBefore]);

  const { localVersion, remoteVersion, triggerCheckVersion } = useUpgradeInfo();

  const {
    computed: { couldSetupBiometrics, isBiometricsEnabled, isFaceID },
    fetchBiometrics,
  } = useBiometrics({ autoFetch: true });

  useFocusEffect(
    useCallback(() => {
      fetchBiometrics();
    }, [fetchBiometrics]),
  );

  const { currentLangLabel, setCurrentLanguageModalVisible } =
    useCurrentLanguageModalVisible();

  const disabledBiometrics =
    !couldSetupBiometrics || !APP_FEATURE_SWITCH.biometricsAuth;

  const switchWhitelistRef = useRef<SwitchToggleType>(null);

  const startSwitchBiometrics = useCallback(() => {
    if (
      shouldRedirectToSetPasswordBefore({ onSettingsAction: 'setBiometrics' })
    )
      return;
    switchBiometricsRef.current?.toggle();
  }, [shouldRedirectToSetPasswordBefore]);

  const { setThemeSelectorModalVisible } = useThemeSelectorModalVisible();
  const { appThemeText } = useAppTheme();
  const { t } = useTranslation();

  const navigation = useRabbyAppNavigation();

  const biometricsComputed = useBiometricsComputed();

  const { viewTermsOfUse, viewPrivacyPolicy } = useShowUserAgreementLikeModal();

  const { semanticBytes, clearDbCacheAndQuiteApp } = useSQLiteStatics({
    enableAutoFetch: true,
  });

  const settingsBlocks: Record<string, SettingConfBlock> = (() => {
    return {
      settings: {
        label: t('page.setting.screenTitle'),
        items: [
          {
            label: t('page.setting.enableWhitelist'),
            icon: RcWhitelist,
            onPress: () => {
              switchWhitelistRef.current?.toggle();
            },
            rightNode: <SwitchWhitelistEnable ref={switchWhitelistRef} />,
          },
          {
            label: biometricsComputed.defaultTypeLabel,
            icon: getBiometricsIcon(isFaceID),
            rightNode: (
              <SwitchBiometricsAuthentication ref={switchBiometricsRef} />
            ),
            onPress: () => {
              startSwitchBiometrics();
            },
            disabled: disabledBiometrics,
            visible: APP_FEATURE_SWITCH.biometricsAuth,
          },
          {
            label: t('page.setting.autoLockTime'),
            icon: RcAutoLockTime,
            onPress: () => {
              startSelectAutolockTime();
            },
            rightTextNode: <AutoLockSettingLabel />,
          },
          {
            label: 'Current Language',
            icon: RcI18n,
            onPress: () => {
              setCurrentLanguageModalVisible(true);
            },
            rightTextNode: (
              <Text style={{ color: colors['neutral-body'] }}>
                {currentLangLabel}
              </Text>
            ),
          },
          {
            label: t('page.setting.addCustomNetwork'),
            icon: RcAddCustomNetwork,
            onPress: () => {
              navigation.dispatch(
                StackActions.push(RootNames.StackSettings, {
                  screen: RootNames.CustomTestnet,
                  params: {
                    source: 'settings',
                  },
                }),
              );
            },
          },
          {
            label: t('page.setting.modifyRPCURL'),
            icon: RcRPC,
            onPress: () => {
              navigation.dispatch(
                StackActions.push(RootNames.StackSettings, {
                  screen: RootNames.CustomRPC,
                  params: {
                    source: 'settings',
                  },
                }),
              );
            },
          },
          {
            visible: SHOULD_SUPPORT_DARK_MODE,
            label: t('page.setting.themeMode'),
            icon: RcThemeMode,
            onPress: () => {
              setThemeSelectorModalVisible(true);
            },
            rightTextNode: ctx => {
              return (
                <Text
                  style={{
                    fontWeight: '400',
                    fontSize: 14,
                    color: colors['neutral-title-1'],
                    marginRight: 6,
                  }}>
                  {appThemeText}
                </Text>
              );
            },
          },
          {
            label: t('page.setting.clearPending'),
            icon: RcClearPending,
            onPress: () => {
              clearPendingRef.current?.present();
            },
          },
          {
            label: t('page.setting.appCache'),
            icon: RcInfo,
            rightNode: ({ rightIconNode }) => {
              return (
                <View style={{ flexDirection: 'row' }}>
                  <Text
                    style={{
                      color: colors['neutral-title-1'],
                      fontSize: 14,
                      fontWeight: '400',
                      paddingRight: 8,
                    }}>
                    {semanticBytes}
                  </Text>
                  {rightIconNode}
                </View>
              );
            },
            onPress: () => {
              Alert.alert(
                'Clear App Cache',
                'This will clear all app cache, sometimes this help to solve some problems. Restarting app is required, Do you want to continue?',
                [
                  { text: 'Cancel', onPress: () => {} },
                  {
                    text: 'Clear & Quit App',
                    style: 'destructive',
                    onPress: async () => {
                      await clearDbCacheAndQuiteApp();
                    },
                  },
                ],
              );
            },
          },
        ],
      },
      aboutus: {
        label: t('page.setting.aboutUs'),
        items: [
          {
            label: t('page.setting.currentVersion'),
            icon: RcInfo,
            rightNode: ({ rightIconNode }) => {
              return (
                <View style={{ flexDirection: 'row' }}>
                  <Text
                    style={{
                      color: colors['neutral-title-1'],
                      fontSize: 14,
                      fontWeight: '400',
                      paddingRight: 8,
                    }}>
                    {localVersion || APP_VERSIONS.fromJs}
                  </Text>
                  {remoteVersion.couldUpgrade && (
                    <Text
                      style={{
                        color: colors['red-default'],
                        fontSize: 14,
                        fontWeight: '400',
                        paddingRight: 4,
                      }}>
                      (New version)
                    </Text>
                  )}
                  {rightIconNode}
                </View>
              );
            },
            onPress: triggerCheckVersion,
          },
          {
            label: t('page.setting.feedback'),
            icon: RcFeedback,
            onPress: () => {
              Linking.openURL('https://discord.gg/AvYmaTjrBu');
            },
          },
          // TODO: in the future
          // {
          //   label: 'Support Chains',
          //   icon: RcSupportChains,
          //   onPress: () => {},
          // },
          {
            label: t('page.setting.followUs'),
            icon: RcFollowUs,
            onPress: () => {
              openExternalUrl(APP_URLS.TWITTER);
            },
          },
          {
            label: t('page.setting.tou'),
            icon: RcTermsOfUse,
            onPress: async () => {
              viewTermsOfUse();
            },
          },
          {
            label: t('page.setting.policy'),
            icon: RcPrivacyPolicy,
            onPress: async () => {
              viewPrivacyPolicy();
            },
          },
        ].filter(Boolean),
      },
    };
  })();

  return (
    <>
      {Object.entries(settingsBlocks).map(([key, block], idx) => {
        const l1key = `${key}-${idx}`;

        return (
          <Block
            key={l1key}
            label={block.label}
            style={[
              idx > 0 && {
                marginTop: 16,
              },
            ]}>
            {block.items.map((item, idx_l2) => {
              return (
                <Block.Item
                  key={`${l1key}-${item.label}-${idx_l2}`}
                  {...item}
                />
              );
            })}
          </Block>
        );
      })}

      <ConfirmBottomSheetModal
        ref={clearPendingRef}
        height={422}
        title={t('page.setting.clearPending')}
        onConfirm={() => {
          if (currentAccount?.address) {
            clearPendingTxs(currentAccount.address);
          }
          toast.success('Pending transaction cleared');
        }}
        descStyle={{
          textAlign: 'left',
          fontSize: 16,
          lineHeight: 22,
          fontWeight: Platform.OS === 'ios' ? '500' : '400',
        }}
        desc={
          <Text>
            {t('page.setting.clearPendingDesc1')}
            {'\n'}
            {'\n'}
            {t('page.setting.clearPendingDesc2')}
          </Text>
        }
      />

      <SelectAutolockTimeBottomSheetModal ref={selectAutolockTimeRef} />

      <CurrentLanguageSelectorModal />
    </>
  );
}

function DevSettingsBlocks() {
  const { colors, colors2024, styles } = useTheme2024({ getStyle: getStyles });
  const navigation = useRabbyAppNavigation();

  const {
    computed: { isFaceID },
    fetchBiometrics,
  } = useBiometrics({ autoFetch: true });

  useFocusEffect(
    useCallback(() => {
      fetchBiometrics();
    }, [fetchBiometrics]),
  );

  const { forceAllowScreenshot } = useIsForceAllowScreenshot();
  const { openMetaMaskTestDapp } = useSheetWebViewTester();
  const { viewMarkdownInWebView } = useShowMarkdownInWebVIewTester();

  const switchAllowScreenshotRef = useRef<SwitchToggleType>(null);
  const switchShowFloatingAutoLockCountdownRef = useRef<SwitchToggleType>(null);

  const { currentLocalVersion, setLocalVersionSelectorModalVisible } =
    useLocalVersionSelectorModalVisible();

  const { setCloudDriveTestItemModalVisible } =
    useCloudDriveTestItemModalVisible();
  const { setWalletTestItemModalVisible } = useWalletLockTestItemModalVisible();
  const { setDevUIWipModalVisible } = useUIDevWipModalVisiable();
  const { setDevUIPlaygroundModalVisible } = useDevUIPlaygroundModalVisible();
  const { setDataPlaygroundModalVisible } = useDevDataPlaygroundModalVisible();

  const devSettingsBlocks: Record<string, SettingConfBlock> = (() => {
    return {
      ...(isSelfhostRegPkg && {
        testkits: {
          label: 'Test Kits (Not present on production package)',
          items: [
            {
              label: 'Build Info',
              icon: RcInfo,
              onPress: () => {
                Alert.alert(
                  'Build Info',
                  [
                    `Commit Hash: ${BUILD_GIT_INFO.BUILD_GIT_HASH}`,
                    '   ',
                    !!BUILD_GIT_INFO.BUILD_GIT_HASH_TIME &&
                      `Lastest Commit: ${dayjs(
                        BUILD_GIT_INFO.BUILD_GIT_HASH_TIME,
                      ).format('YYYY-MM-DD HH:mm:ss')}`,
                    !!BUILD_GIT_INFO.BUILD_GIT_COMMITOR &&
                      `Lastest Commitor: ${BUILD_GIT_INFO.BUILD_GIT_COMMITOR}`,
                    // '   ',
                    // !!BUILD_GIT_INFO.BUILD_GIT_COMMITS_COUNT && `Distance From v${BUILD_GIT_INFO.BUILD_GIT_COMMITS_COUNT_BASEVER}: ${BUILD_GIT_INFO.BUILD_GIT_COMMITS_COUNT}`,
                  ]
                    .filter(Boolean)
                    .join('\n'),
                  [
                    {
                      text: 'OK',
                    },
                  ],
                );
              },
              rightNode: (
                <Text style={{ color: colors['neutral-body'] }}>
                  {BUILD_CHANNEL} - {BUILD_GIT_INFO.BUILD_GIT_HASH}
                </Text>
              ),
              // TODO: only show in non-production mode
              visible: NEED_DEVSETTINGBLOCKS,
            },
            {
              label: 'Force local version',
              icon: RcInfo,
              onPress: () => {
                setLocalVersionSelectorModalVisible(true);
              },
              rightTextNode: (
                <Text style={{ color: colors['neutral-body'] }}>
                  Runtime: {currentLocalVersion}
                </Text>
              ),
              // TODO: only show in non-production mode
              visible: NEED_DEVSETTINGBLOCKS,
            },
            {
              label: '[Security] Wallet Lock & Password',
              icon: RcLockWallet,
              onPress: async () => {
                setWalletTestItemModalVisible(true);
              },
            },
            {
              label: '[Cloud] Test Memonics Backup',
              icon: RcGoogleDrive,
              onPress: async () => {
                setCloudDriveTestItemModalVisible(true);
              },
            },
            {
              label: '[UI] Wip Helpers',
              icon: RcCode,
              onPress: () => {
                setDevUIWipModalVisible(true);
              },
            },
            {
              label: 'UI Playground',
              icon: RcCode,
              onPress: () => {
                setDevUIPlaygroundModalVisible(true);
              },
            },
            {
              label: 'Data Playground',
              icon: RcCode,
              onPress: () => {
                setDataPlaygroundModalVisible(true);
              },
            },
            {
              label: forceAllowScreenshot
                ? `Force Allow Capture`
                : `Disallow Capture Sensitive Scene`,
              icon: isIOS ? RcScreenRecord : RcScreenshot,
              rightNode: (
                <SwitchAllowScreenshot ref={switchAllowScreenshotRef} />
              ),
              onPress: () => {
                switchAllowScreenshotRef.current?.toggle();
              },
              visible: isNonPublicProductionEnv,
            },
            {
              label: (
                <Text>
                  <AutoLockCountDownLabel />
                </Text>
              ),
              icon: RcAutoLockTime,
              onPress: () => {
                switchShowFloatingAutoLockCountdownRef.current?.toggle();
              },
              rightNode: (
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <SwitchShowFloatingAutoLockCountdown
                    ref={switchShowFloatingAutoLockCountdownRef}
                  />
                </View>
              ),
            },
          ],
        },
      }),
      ...(__DEV__ && {
        devlab: {
          label: 'Dev Lab',
          icon: RcEarth,
          items: [
            {
              label: 'WebView Test',
              icon: RcEarth,
              onPress: () => {
                openMetaMaskTestDapp();
              },
            },
            {
              label: 'Markdown Webview Test',
              icon: RcEarth,
              onPress: () => {
                viewMarkdownInWebView();
              },
            },
            {
              label: 'ProviderController Test',
              icon: RcEarth,
              onPress: () => {
                navigation.push(RootNames.StackSettings, {
                  screen: RootNames.ProviderControllerTester,
                });
              },
            },
            {
              label: 'Test Authentication Modal',
              icon: getBiometricsIcon(isFaceID),
              onPress: () => {
                AuthenticationModal.show({
                  title: 'Test Authentication Modal',
                  authType: ['biometrics', 'password'],
                  onFinished: ctx => {
                    toast.show(JSON.stringify(ctx, null, 2));
                  },
                  onCancel: () => {
                    toast.show(
                      'Canceled, But this handler has beed deprecated',
                    );
                  },
                });
              },
            },
            {
              label: 'View Rabby Genesis NFT Detail',
              icon: RcInfo,
              onPress: () => {
                navigation.push(RootNames.StackTransaction, {
                  screen: RootNames.SendNFT,
                  params: {
                    nftItem: RABBY_GENESIS_NFT_DATA.nftToken,
                  },
                });
              },
            },
            // {
            //   label: 'Test Biometrics',
            //   icon: isFaceID ? RcIconFaceId : RcIconFingerprint,
            //   onPress: () => {
            //     startBiometricsVerification({
            //       onFinished: () => {
            //         abortBiometricsVerification();
            //       },
            //     });
            //   },
            //   disabled: disabledBiometrics || !isBiometricsEnabled,
            // },
          ],
        },
      }),
    };
  })();

  return (
    <>
      {Object.entries(devSettingsBlocks).map(([key, block], idx) => {
        const l1key = `${key}-${idx}`;

        return (
          <Block
            key={l1key}
            label={block.label}
            style={[
              {
                marginTop: 16,
              },
            ]}>
            {block.items.map((item, idx_l2) => {
              return (
                <Block.Item
                  key={`${l1key}-${item.label}-${idx_l2}`}
                  {...item}
                />
              );
            })}
          </Block>
        );
      })}

      <DevForceLocalVersionSelector />

      <CloudDriveTestItemModal />
      <WalletLockTestItemModal />
      <DevUIWipModal />
      <DevUIPlaygroundModal />
      <DevDataPlayground />
    </>
  );
}

export default function SettingsScreen(): JSX.Element {
  const { styles } = useTheme2024({ getStyle: getStyles });

  const {
    computed: { couldSetupBiometrics },
    fetchBiometrics,
  } = useBiometrics({ autoFetch: true });

  useFocusEffect(
    useCallback(() => {
      fetchBiometrics();
    }, [fetchBiometrics]),
  );

  const { safeSizes } = useSafeAndroidBottomSizes({
    containerPaddingBottom: 0,
  });

  const { bottom } = useSafeAreaInsets();

  return (
    <RootScreenContainer
      fitStatuBar
      style={[
        styles.container,
        {
          paddingBottom: safeSizes.containerPaddingBottom,
        },
      ]}>
      <ScreenSpecificStatusBar screenName={RootNames.Settings} />
      <ScrollView
        style={[styles.scrollableView]}
        contentContainerStyle={[
          styles.scrollableContentStyle,
          { paddingBottom: 12 + bottom },
        ]}>
        <SettingsBlocks />
        {NEED_DEVSETTINGBLOCKS && <DevSettingsBlocks />}
        <View style={[styles.bottomFooter]}>
          <RcFooterLogo />
        </View>
      </ScrollView>

      <ThemeSelectorModal />

      <ManagePasswordSheetModal height={422} />
      {NEED_DEVSETTINGBLOCKS && <ResetPasswordAndKeyringsSheetModal />}

      <SheetWebViewTester />
    </RootScreenContainer>
  );
}

const getStyles = createGetStyles2024(ctx => {
  return {
    container: {
      position: 'relative',
      flex: 0,
      flexDirection: 'column',
      height: '100%',
      backgroundColor: ctx.classicalColors['neutral-bg-2'],
      // paddingBottom: LAYOUTS.fiexedFooterHeight,
    },
    scrollableContentStyle: {
      paddingHorizontal: 20,
      width: '100%',
      paddingBottom: 12,
    },
    scrollableView: {
      marginBottom: 0,
      height: '100%',
      flexShrink: 1,
      // ...makeDebugBorder('yellow'),
    },
    bottomFooter: {
      flexShrink: 0,
      // position: 'absolute',
      // bottom: 0,
      // left: 0,
      // right: 0,
      width: '100%',
      paddingHorizontal: 20,
      height: LAYOUTS.fiexedFooterHeight,
      alignItems: 'center',
      justifyContent: 'center',
      // ...makeDebugBorder(),
    },
  };
});
