import React, { useCallback, useRef } from 'react';
import { Linking, Platform, ScrollView, Text, View } from 'react-native';

import NormalScreenContainer from '@/components/ScreenContainer/NormalScreenContainer';

import {
  RcClearPending,
  RcEarth,
  RcFeedback,
  RcLockWallet,
  RcAutoLockTime,
  RcCountdown,
  RcManagePassword,
  RcScreenshot,
  RcFollowUs,
  RcInfo,
  RcPrivacyPolicy,
  RcScreenRecord,
  RcThemeMode,
  RcWhitelist,
} from '@/assets/icons/settings';
import RcFooterLogo from '@/assets/icons/settings/footer-logo.svg';

import {
  BUILD_CHANNEL,
  isSelfhostRegPkg,
  NEED_DEVSETTINGBLOCKS,
} from '@/constant/env';
import { RootNames } from '@/constant/layout';
import {
  SHOULD_SUPPORT_DARK_MODE,
  useAppTheme,
  useThemeColors,
  useThemeStyles,
} from '@/hooks/theme';
import { useSafeAndroidBottomSizes } from '@/hooks/useAppLayout';
import { type SettingConfBlock, Block } from './Block';
import { useSheetWebViewTester } from './sheetModals/hooks';
import SheetWebViewTester from './sheetModals/SheetWebViewTester';

import { SwitchToggleType } from '@/components';
import { SwitchAllowScreenshot } from './components/SwitchAllowScreenshot';
import { SwitchBiometricsAuthentication } from './components/SwitchBiometricsAuthentication';
import { SwitchWhitelistEnable } from './components/SwitchWhitelistEnable';

import { toast } from '@/components/Toast';
import { APP_FEATURE_SWITCH, APP_URLS, APP_VERSIONS } from '@/constant';
import { clearPendingTxs } from '@/core/apis/transactions';
import { openExternalUrl } from '@/core/utils/linking';
import { useCurrentAccount } from '@/hooks/account';
import {
  requestLockWalletAndBackToUnlockScreen,
  useRabbyAppNavigation,
} from '@/hooks/navigation';
import { useUpgradeInfo } from '@/hooks/version';
import { SettingNavigatorParamList } from '@/navigation-type';
import { createGetStyles } from '@/utils/styles';
import { BottomSheetModal } from '@gorhom/bottom-sheet';
import {
  StackActions,
  useFocusEffect,
  useNavigationState,
} from '@react-navigation/native';
import { ManagePasswordSheetModal } from '../ManagePassword/components/ManagePasswordSheetModal';
import { useManagePasswordOnSettings } from '../ManagePassword/hooks';
import {
  useBiometrics,
  useBiometricsComputed,
  useVerifyByBiometrics,
} from '@/hooks/biometrics';
import {
  useIsAllowScreenshot,
  useToggleShowAutoLockCountdown,
} from '@/hooks/appSettings';
import { SelectAutolockTimeBottomSheetModal } from './components/SelectAutolockTimeBottomSheetModal';
import {
  AutoLockCountDownLabel,
  AutoLockSettingLabel,
  LastUnlockTimeLabel,
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

  const navParams = useNavigationState(
    s => s.routes.find(r => r.name === RootNames.Settings)?.params,
  ) as SettingNavigatorParamList['Settings'];

  // useMount(() => {
  //   console.debug(
  //     'navParams?.enterActionType',
  //     navParams?.enterActionType,
  //   );
  //   switch (navParams?.enterActionType) {
  //     default:
  //       break;
  //     case 'setAutoLockTime': {
  //       startSelectAutolockTime();
  //       break;
  //     }
  //     case 'setBiometrics': {
  //       startSwitchBiometrics();
  //       break;
  //     }
  //   }
  // });

  const navigation = useRabbyAppNavigation();

  const biometricsComputed = useBiometricsComputed();

  const settingsBlocks: Record<string, SettingConfBlock> = (() => {
    return {
      // features: {
      //   label: 'Features',
      //   items: [
      //     {
      //       label: 'Signature Record',
      //       icon: RcSignatureRecord,

      //       disabled: true,
      //       onDisabledPress: () => {
      //         toast.show('Coming Soon :)');
      //       },
      //     },
      //     {
      //       label: 'Manage Address',
      //       icon: RcManageAddress,
      //       onPress: () => {},
      //       disabled: true,
      //       onDisabledPress: () => {
      //         toast.show('Coming Soon :)');
      //       },
      //     },
      //     {
      //       label: `Connect ${Platform.OS === 'ios' ? 'Websites' : 'Dapps'}`,
      //       icon: RcConnectedDapp,
      //       onPress: () => {},
      //       disabled: true,
      //       onDisabledPress: () => {
      //         toast.show('Coming Soon :)');
      //       },
      //     },
      //   ],
      // },
      settings: {
        label: 'Settings',
        items: [
          {
            label: 'Enable whitelist for sending assets',
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
          // {
          //   label: 'Custom RPC',
          //   icon: RcCustomRpc,
          //   onPress: () => {},
          //   disabled: true,
          //   visible: !!__DEV__,
          // },
          {
            label: 'Auto lock time',
            icon: RcAutoLockTime,
            onPress: () => {
              startSelectAutolockTime();
            },
            rightTextNode: <AutoLockSettingLabel />,
          },
          {
            label: 'Add Custom Network',
            icon: RcWhitelist,
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
            label: 'Clear Pending',
            icon: RcClearPending,
            onPress: () => {
              clearPendingRef.current?.present();
            },
          },
        ],
      },
      aboutus: {
        label: 'About Us',
        items: [
          {
            label: 'Current Version',
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
            label: 'Feedback',
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
            label: 'Follow Us',
            icon: RcFollowUs,
            onPress: () => {
              openExternalUrl(APP_URLS.TWITTER);
            },
          },
          {
            label: 'Privacy Policy',
            icon: RcPrivacyPolicy,
            onPress: async () => {
              openExternalUrl(APP_URLS.PRIVACY_POLICY);
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
        title={'Clear Pending'}
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
            This will clear all your pending transactions. This can help you
            solve the problem that in some cases the state of the transaction in
            Rabby does not match the state on-chain.
            {'\n'}
            {'\n'}
            This will not change the balances in your accounts or require you to
            re-enter your seed phrase. All your assets and accounts information
            will remain secure.
          </Text>
        }
      />

      <SelectAutolockTimeBottomSheetModal ref={selectAutolockTimeRef} />
    </>
  );
}

function DevSettingsBlocks() {
  const { colors } = useThemeStyles(getStyles);
  const navigation = useRabbyAppNavigation();

  const { hasSetupCustomPassword, openManagePasswordSheetModal } =
    useManagePasswordOnSettings();

  const { setThemeSelectorModalVisible } = useThemeSelectorModalVisible();
  const { appThemeText } = useAppTheme();

  const {
    computed: { couldSetupBiometrics, isBiometricsEnabled, isFaceID },
    fetchBiometrics,
  } = useBiometrics({ autoFetch: true });

  useFocusEffect(
    useCallback(() => {
      fetchBiometrics();
    }, [fetchBiometrics]),
  );

  const { startBiometricsVerification, abortBiometricsVerification } =
    useVerifyByBiometrics();

  const { allowScreenshot } = useIsAllowScreenshot();
  const { openMetaMaskTestDapp } = useSheetWebViewTester();
  const { viewMarkdownInWebView } = useShowMarkdownInWebVIewTester();

  const disabledBiometrics =
    !couldSetupBiometrics ||
    !hasSetupCustomPassword ||
    !APP_FEATURE_SWITCH.biometricsAuth;

  const switchAllowScreenshotRef = useRef<SwitchToggleType>(null);
  const switchShowFloatingAutoLockCountdownRef = useRef<SwitchToggleType>(null);
  const { showAutoLockCountdown } = useToggleShowAutoLockCountdown();

  const devSettingsBlocks: Record<string, SettingConfBlock> = (() => {
    return {
      ...(isSelfhostRegPkg && {
        testkits: {
          label: 'Test Kits (Not present on production package)',
          items: [
            {
              label: 'Build Hash',
              icon: RcInfo,
              // onPress: () => {},
              rightNode: (
                <Text style={{ color: colors['neutral-body'] }}>
                  {BUILD_CHANNEL} - {process.env.BUILD_GIT_HASH}
                </Text>
              ),
              // TODO: only show in non-production mode
              visible: !!__DEV__ || BUILD_CHANNEL === 'selfhost-reg',
            },
            {
              visible: SHOULD_SUPPORT_DARK_MODE,
              label: 'Switch Theme',
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
                    {appThemeText} Mode
                  </Text>
                );
              },
            },
            {
              label: allowScreenshot
                ? `Allow ${isIOS ? 'ScreenRecord' : 'Screenshot'}`
                : `Disallow ${isIOS ? 'ScreenRecord' : 'Screenshot'}`,
              icon: isIOS ? RcScreenRecord : RcScreenshot,
              rightNode: (
                <SwitchAllowScreenshot ref={switchAllowScreenshotRef} />
              ),
              onPress: () => {
                switchAllowScreenshotRef.current?.toggle();
              },
              visible: __DEV__,
            },
            // only valid if custom password given
            {
              label: 'Lock Wallet',
              icon: RcLockWallet,
              disabled: !hasSetupCustomPassword,
              onPress: () => {
                requestLockWalletAndBackToUnlockScreen();
              },
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
            {
              label: 'Last Unlock Offset',
              icon: RcCountdown,
              // onPress: () => {},
              rightNode: (
                <Text>
                  <LastUnlockTimeLabel />
                </Text>
              ),
            },
            {
              label: hasSetupCustomPassword
                ? 'Clear Password'
                : 'Set Up Password',
              icon: RcManagePassword,
              onPress: () => {
                openManagePasswordSheetModal();
              },
              visible:
                APP_FEATURE_SWITCH.customizePassword || hasSetupCustomPassword,
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
    </>
  );
}

export default function SettingsScreen(): JSX.Element {
  const { styles } = useThemeStyles(getStyles);

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

  return (
    <NormalScreenContainer
      fitStatuBar
      style={[
        styles.container,
        {
          paddingBottom: safeSizes.containerPaddingBottom,
        },
      ]}>
      <ScrollView
        style={[styles.scrollableView]}
        contentContainerStyle={[styles.scrollableContentStyle]}>
        <SettingsBlocks />
        {NEED_DEVSETTINGBLOCKS && <DevSettingsBlocks />}
        <View style={[styles.bottomFooter]}>
          <RcFooterLogo />
        </View>
      </ScrollView>

      <ThemeSelectorModal />

      <ManagePasswordSheetModal height={422} />

      <SheetWebViewTester />
    </NormalScreenContainer>
  );
}

const getStyles = createGetStyles(colors => {
  return {
    container: {
      position: 'relative',
      flex: 0,
      flexDirection: 'column',
      height: '100%',
      backgroundColor: colors['neutral-bg-2'],
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
