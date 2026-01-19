import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Linking,
  Platform,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

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
  RcAddCustomNetwork,
  RcRPC,
  RcGoogleDrive,
  RcCode,
  RcI18n,
  RcFaceId,
  RcFingerprint,
  RcScreenshotReport,
  RcIconCurrency,
} from '@/assets/icons/settings';
import RcFooterLogo from '@/assets/icons/settings/footer-logo.svg';

import {
  APP_RUNTIME_ENV,
  BUILD_CHANNEL,
  BUILD_GIT_INFO,
  IS_HERMES_ENABLED,
} from '@/constant/env';
import { isNonPublicProductionEnv, NEED_DEVSETTINGBLOCKS } from '@/constant';
import { RootNames } from '@/constant/layout';
import {
  makeThemeOptions,
  SHOULD_SUPPORT_DARK_MODE,
  useAppTheme,
  useTheme2024,
} from '@/hooks/theme';
import { useSafeAndroidBottomSizes } from '@/hooks/useAppLayout';
import { type SettingConfBlock, Block } from './Block';
// import { useSheetWebViewTester } from './sheetModals/hooks';
import SheetWebViewTester from './sheetModals/SheetWebViewTester';

import { SwitchBiometricsAuthentication } from './components/SwitchBiometricsAuthentication';

import { toast } from '@/components/Toast';
import {
  APP_FEATURE_SWITCH,
  APP_URLS,
  APP_VERSIONS,
  INTERNAL_REQUEST_SESSION,
} from '@/constant';
import { openExternalUrl } from '@/core/utils/linking';
import { useRabbyAppNavigation } from '@/hooks/navigation';
import { useUpgradeInfo } from '@/hooks/version';
import { createGetStyles2024 } from '@/utils/styles';
import { StackActions, useFocusEffect } from '@react-navigation/native';
import {
  ManagePasswordSheetModal,
  ResetPasswordAndKeyringsSheetModal,
} from '../ManagePassword/components/ManagePasswordSheetModal';

import { useBiometrics, useBiometricsComputed } from '@/hooks/biometrics';
import { SelectAutolockTimeBottomSheetModal } from './components/SelectAutolockTimeBottomSheetModal';
import { AutoLockSettingLabel } from './components/LockAbout';
import { sheetModalRefsNeedLock, useSetPasswordFirst } from '@/hooks/useLock';
import { AuthenticationModal2024 } from '@/components/AuthenticationModal/AuthenticationModal2024';
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
import WalletLockTestItemModal, {
  useWalletLockTestItemModalVisible,
} from './sheetModals/DevWalletLock';
import DevUIPlaygroundModal, {
  useDevUIPlaygroundModalVisible,
} from './sheetModals/DevUIPlayground';
import DevDataPlayground, {
  useDevDataPlaygroundModalVisible,
} from './sheetModals/DevDataPlayground';
import CurrentLanguageSelectorModal, {
  useCurrentLanguageModalVisible,
} from './sheetModals/LanguageSelector';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import {
  clearAppDataSource,
  dropAppDataSourceAndQuitApp,
} from '@/databases/imports';
import { AppCacheSizeText } from './components/SpecialText';
import { IS_IOS } from '@/core/native/utils';
import { abortAllSyncTasks } from '@/databases/sync/_task';
import { resetUpdateHistoryTime } from '@/hooks/historyTokenDict';
import { sendRequest } from '@/core/apis/sendRequest';
import { ClearPendingPopup } from './components/ClearPendingPopup';
import { OpenApiPopup } from './components/OpenApiPopup';
import { perpsService, preferenceService } from '@/core/services';
import { useClearBrowserData } from '@/hooks/browser/useClearBrowserData';
import { useMultiPress } from '@/hooks/tap';
import {
  DevModalDevServer,
  useDevServerModalVisible,
} from './Modals/DevModalDevServer';
import {
  FORCE_DISABLE_FEEDBACK_BY_SCREENSHOT,
  useScreenshotToReportEnabled,
} from '@/components/Screenshot/hooks';
import { SwitchScreenshotToReport } from './components/SwitchScreenshotToReport';
import {
  CurrencySelectorPopup,
  useCurrentCurrencyVisible,
} from './sheetModals/CurrencySelectorPopup';
import { isWorkerThreadRunning } from '@/perfs/thread';

const LAYOUTS = {
  fiexedFooterHeight: 50,
};

const isIOS = Platform.OS === 'ios';

function AlertBuildInfo() {
  if (isNonPublicProductionEnv) {
    Alert.alert(
      'Build Info',
      [
        `Build Channel: ${BUILD_CHANNEL}`,
        `Runtime Env: ${APP_RUNTIME_ENV}`,
        `Commit Hash: ${BUILD_GIT_INFO.BUILD_GIT_HASH}`,
        `Hermes Enabled: ${IS_HERMES_ENABLED}`,
        `Worker Thread: ${isWorkerThreadRunning() ? 'Enabled' : 'Disabled'}`,
        '   ',
        !!BUILD_GIT_INFO.BUILD_GIT_HASH_TIME &&
          `Lastest Commit: ${dayjs(BUILD_GIT_INFO.BUILD_GIT_HASH_TIME).format(
            'YYYY-MM-DD HH:mm:ss',
          )}`,
        !!BUILD_GIT_INFO.BUILD_GIT_COMMITOR &&
          `Lastest Commitor: ${BUILD_GIT_INFO.BUILD_GIT_COMMITOR}`,
      ]
        .filter(Boolean)
        .join('\n'),
      [
        {
          text: 'OK',
        },
      ],
    );
  } else {
    Alert.alert(
      'Build Info',
      [
        `Build Channel: ${BUILD_CHANNEL}`,
        `Runtime Env: ${APP_RUNTIME_ENV}`,
        `Revision: ${BUILD_GIT_INFO.BUILD_GIT_HASH}`,
        `Hermes Enabled: ${IS_HERMES_ENABLED}`,
        `Worker Thread: ${isWorkerThreadRunning() ? 'Enabled' : 'Disabled'}`,
      ]
        .filter(Boolean)
        .join('\n'),
      [
        {
          text: 'OK',
        },
      ],
    );
  }
}

const { switchBiometricsRef, selectAutolockTimeRef } = sheetModalRefsNeedLock;
function SettingsBlocks() {
  const { colors, styles } = useTheme2024({ getStyle: getStyles });

  const [isShowClearPendingPopup, setIsShowClearPendingPopup] = useState(false);

  const { shouldRedirectToSetPasswordBefore } = useSetPasswordFirst();
  // const selectAutolockTimeRef = useRef<BottomSheetModal>(null);
  const startSelectAutolockTime = useCallback(() => {
    if (
      shouldRedirectToSetPasswordBefore({
        onSettingsAction: 'setAutoLockExpireTime',
      })
    ) {
      return;
    }
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

  const { currency, setIsShowCurrencyPopup } = useCurrentCurrencyVisible();

  const disabledBiometrics =
    !couldSetupBiometrics || !APP_FEATURE_SWITCH.biometricsAuth;

  const startSwitchBiometrics = useCallback(() => {
    if (
      shouldRedirectToSetPasswordBefore({ onSettingsAction: 'setBiometrics' })
    ) {
      return;
    }
    switchBiometricsRef.current?.toggle();
  }, [shouldRedirectToSetPasswordBefore]);

  const { setThemeSelectorModalVisible } = useThemeSelectorModalVisible();
  const { appTheme } = useAppTheme();
  const { t } = useTranslation();
  const appThemeText = useMemo(() => {
    return (
      makeThemeOptions(t).find(item => item.value === appTheme)?.title || ''
    );
  }, [appTheme, t]);

  const navigation = useRabbyAppNavigation();

  const biometricsComputed = useBiometricsComputed();

  const { viewTermsOfUse, viewPrivacyPolicy } = useShowUserAgreementLikeModal();

  const { clearBrowserData } = useClearBrowserData();

  const { toggleScreenshotToReport } = useScreenshotToReportEnabled();

  const settingsBlocks: Record<string, SettingConfBlock> = (() => {
    return {
      settings: {
        label: t('page.setting.screenTitle'),
        items: [
          {
            label: biometricsComputed.defaultTypeLabel,
            icon: isFaceID ? RcFaceId : RcFingerprint,
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
            rightTextNode: <AutoLockSettingLabel style={styles.rightText} />,
          },
          {
            label: t('page.setting.currentLanguage'),
            icon: RcI18n,
            onPress: () => {
              setCurrentLanguageModalVisible(true);
            },
            rightTextNode: (
              <Text style={styles.rightText}>{currentLangLabel}</Text>
            ),
          },
          {
            label: t('page.setting.currency'),
            icon: RcIconCurrency,
            onPress: () => {
              setIsShowCurrencyPopup(true);
            },
            rightTextNode: (
              <Text style={styles.rightText}>{currency?.code}</Text>
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
          // {
          //   label: t('page.setting.modifyRPCURL'),
          //   icon: RcRPC,
          //   onPress: () => {
          //     navigation.dispatch(
          //       StackActions.push(RootNames.StackSettings, {
          //         screen: RootNames.CustomRPC,
          //         params: {
          //           source: 'settings',
          //         },
          //       }),
          //     );
          //   },
          // },
          {
            visible: SHOULD_SUPPORT_DARK_MODE,
            label: t('page.setting.themeMode'),
            icon: RcThemeMode,
            onPress: () => {
              setThemeSelectorModalVisible(true);
            },
            rightTextNode: ctx => {
              return <Text style={styles.rightText}>{appThemeText}</Text>;
            },
          },
          {
            label: t('page.setting.screenshotReportSwitch'),
            icon: RcScreenshotReport,
            rightNode: <SwitchScreenshotToReport ref={switchBiometricsRef} />,
            onPress: () => {
              toggleScreenshotToReport();
            },
            // disabled: disabledBiometrics,
            visible: !FORCE_DISABLE_FEEDBACK_BY_SCREENSHOT,
          },
          {
            label: t('page.setting.clearPending'),
            icon: RcClearPending,
            onPress: () => {
              setIsShowClearPendingPopup(true);
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
                  <Text style={styles.rightText}>
                    {localVersion || APP_VERSIONS.fromJs}
                  </Text>
                  {remoteVersion.couldUpgrade && (
                    <Text
                      style={{
                        ...styles.rightText,
                        color: colors['red-default'],
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
      extra: {
        label: '',
        items: [
          {
            label: t('page.setting.appCache'),
            icon: RcClearPending,
            rightNode: IS_IOS
              ? undefined
              : ({ rightIconNode }) => {
                  return (
                    <View style={{ flexDirection: 'row' }}>
                      <AppCacheSizeText
                        style={{
                          ...styles.rightText,
                          paddingRight: 8,
                        }}
                      />
                      {rightIconNode}
                    </View>
                  );
                },
            onPress: () => {
              Alert.alert(
                t('page.settingModal.clearAppCache.title'),
                t('page.settingModal.clearAppCache.clearAppCacheDesc'),
                [
                  { text: t('common.dialog.button.cancel'), onPress: () => {} },
                  IS_IOS
                    ? {
                        text: t('page.settingModal.clearAppCache.button.clear'),
                        style: 'destructive',
                        onPress: async () => {
                          abortAllSyncTasks();
                          resetUpdateHistoryTime();
                          await clearAppDataSource();
                          Alert.alert(
                            t('page.settingModal.clearAppCache.iOSToastTitle'),
                            t('page.settingModal.clearAppCache.iOSToastDesc'),
                            [],
                          );
                        },
                      }
                    : {
                        text: t(
                          'page.settingModal.clearAppCache.button.clear_and_quit',
                        ),
                        style: 'destructive',
                        onPress: async () => {
                          resetUpdateHistoryTime();
                          await dropAppDataSourceAndQuitApp();
                        },
                      },
                ],
              );
            },
          },
          // {
          //   label: t('page.setting.clearBrowserData'),
          //   icon: RcClearPending,
          //   onPress: () => {
          //     Alert.alert(
          //       t('page.settingModal.clearBrowserData.title'),
          //       t('page.settingModal.clearBrowserData.desc'),
          //       [
          //         { text: t('common.dialog.button.cancel'), onPress: () => {} },
          //         {
          //           text: t('page.settingModal.clearBrowserData.button'),
          //           style: 'destructive',
          //           onPress: async () => {
          //             clearBrowserData();
          //             toast.success('Cleared');
          //           },
          //         },
          //       ],
          //     );
          //   },
          // },
        ],
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
              idx > 0 &&
                !!block.label && {
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

      <ClearPendingPopup
        visible={isShowClearPendingPopup}
        onClose={() => {
          setIsShowClearPendingPopup(false);
        }}
        onConfirm={() => {
          setIsShowClearPendingPopup(false);
        }}
      />

      <SelectAutolockTimeBottomSheetModal ref={selectAutolockTimeRef} />

      <CurrentLanguageSelectorModal />

      <CurrencySelectorPopup />
    </>
  );
}

function DevSettingsBlocks() {
  const { colors } = useTheme2024({ getStyle: getStyles });
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

  const { viewMarkdownInWebView } = useShowMarkdownInWebVIewTester();

  const { currentLocalVersion, setLocalVersionSelectorModalVisible } =
    useLocalVersionSelectorModalVisible();

  const { setWalletTestItemModalVisible } = useWalletLockTestItemModalVisible();
  const { setDevUIPlaygroundModalVisible } = useDevUIPlaygroundModalVisible();
  const { setDataPlaygroundModalVisible } = useDevDataPlaygroundModalVisible();

  const [isShowOpenApiPopup, setIsShowOpenApiPopup] = useState(false);
  const { setDevServerSettingsModalVisible } = useDevServerModalVisible();
  const currentAccount = preferenceService.getFallbackAccount();

  const devSettingsBlocks: Record<string, SettingConfBlock> = (() => {
    return {
      ...(isNonPublicProductionEnv && {
        testkits: {
          label: 'Test Kits (Not present on production package)',
          items: [
            {
              label: 'Build Info',
              icon: RcInfo,
              onPress: () => {
                AlertBuildInfo();
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
              label: 'Backend Service URL',
              icon: RcCode,
              onPress: async () => {
                setIsShowOpenApiPopup(true);
              },
            },
            {
              label: '[Security] Wallet Lock & Password',
              icon: RcLockWallet,
              onPress: async () => {
                setWalletTestItemModalVisible(true);
              },
            },
            {
              label: 'Regression Switches',
              icon: RcCode,
              onPress: () => {
                navigation.dispatch(
                  StackActions.push(RootNames.StackTestkits, {
                    screen: RootNames.DevSwitches,
                  }),
                );
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
          ],
        },
      }),
      ...(__DEV__ && {
        devlab: {
          label: 'Dev Lab',
          icon: RcEarth,
          items: [
            {
              label: 'LAN Server Settings',
              icon: RcCode,
              onPress: async () => {
                setDevServerSettingsModalVisible(true);
              },
            },
            // {
            //   label: 'WebView Test',
            //   icon: RcEarth,
            //   onPress: () => {
            //     openMetaMaskTestDapp();
            //   },
            // },
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
              icon: isFaceID ? RcFaceId : RcFingerprint,
              onPress: () => {
                AuthenticationModal2024.show({
                  title: 'Test Authentication Modal',
                  authType: ['biometrics', 'password'],
                  // authType: ['password'],
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
                    fromAccount: currentAccount!,
                  },
                });
              },
            },
            {
              label: 'Test EIP-7702',
              icon: RcInfo,
              onPress: () => {
                sendRequest({
                  data: {
                    method: 'eth_sendTransaction',
                    params: [
                      {
                        from: '0x5853eD4f26A3fceA565b3FBC698bb19cdF6DEB85',
                        to: '0x093ccbaecb0e0006c8bffca92e9929d117fec583',
                        value: '0x0',
                        data: '0x13af40350000000000000000000000007c754e12423bc46a2120303ad239b955ccb94f1a',
                        chainId: 1,
                        authorizationList: [],
                      },
                    ],
                  },
                  session: INTERNAL_REQUEST_SESSION,
                  account: currentAccount!,
                });
              },
            },
            {
              label: 'Test OFAC Blocked Transaction',
              icon: RcInfo,
              onPress: () => {
                sendRequest({
                  data: {
                    method: 'eth_sendTransaction',
                    params: [
                      {
                        from: '0x5853eD4f26A3fceA565b3FBC698bb19cdF6DEB85',
                        to: '0xe7aa314c77f4233c18c6cc84384a9247c0cf367b',
                        value: '0x0',
                        data: '0x',
                        chainId: 1,
                      },
                    ],
                  },
                  session: INTERNAL_REQUEST_SESSION,
                  account: currentAccount!,
                });
              },
            },
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

      <WalletLockTestItemModal />
      <DevUIPlaygroundModal />
      <DevDataPlayground />
      <DevModalDevServer />
      <OpenApiPopup
        visible={isShowOpenApiPopup}
        onClose={() => {
          setIsShowOpenApiPopup(false);
        }}
      />
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

  const { handlePress } = useMultiPress({ onMultiPress: AlertBuildInfo });

  return (
    <RootScreenContainer
      fitStatuBar
      hideBottomBar
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
        <TouchableOpacity onPress={handlePress} activeOpacity={1}>
          <View style={[styles.bottomFooter]}>
            <RcFooterLogo />
          </View>
        </TouchableOpacity>
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
      backgroundColor: ctx.isLight
        ? ctx.classicalColors['neutral-bg-2']
        : ctx.colors2024['neutral-bg-1'],
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
    rightText: {
      color: ctx.colors2024['neutral-secondary'],
      fontFamily: 'SF Pro Rounded',
      fontSize: 16,
      fontStyle: 'normal',
      fontWeight: '500',
      lineHeight: 20,
    },
  };
});
