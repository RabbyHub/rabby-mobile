import React, { useCallback, useRef } from 'react';
import { View, Text, ScrollView, Linking, Platform } from 'react-native';

import NormalScreenContainer from '@/components/ScreenContainer/NormalScreenContainer';

import {
  RcClearPending,
  RcCustomRpc,
  RcFollowUs,
  RcInfo,
  RcPrivacyPolicy,
  RcManageAddress,
  RcSignatureRecord,
  RcConnectedDapp,
  RcThemeMode,
  RcWhitelist,
  RcEarth,
  RcFeedback,
  RcLockWallet,
  RcManagePassword,
  RcIconFingerprint,
  RcIconFaceId,
  RcScreenshot,
  RcScreenRecord,
} from '@/assets/icons/settings';
import RcFooterLogo from '@/assets/icons/settings/footer-logo.svg';

import { type SettingConfBlock, Block } from './Block';
import {
  SHOULD_SUPPORT_DARK_MODE,
  useAppTheme,
  useThemeStyles,
} from '@/hooks/theme';
import { useSheetWebViewTester } from './sheetModals/hooks';
import SheetWebViewTester from './sheetModals/SheetWebViewTester';
import { BUILD_CHANNEL } from '@/constant/env';
import { RootNames } from '@/constant/layout';
import { useSafeAndroidBottomSizes } from '@/hooks/useAppLayout';

import { SwitchToggleType } from '@/components';
import { SwitchWhitelistEnable } from './components/SwitchWhitelistEnable';
import { SwitchBiometricsAuthentication } from './components/SwitchBiometricsAuthentication';
import { SwitchAllowScreenshot } from './components/SwitchAllowScreenshot';

import { ConfirmBottomSheetModal } from './components/ConfirmBottomSheetModal';
import { BottomSheetModal } from '@gorhom/bottom-sheet';
import { toast } from '@/components/Toast';
import { APP_FEATURE_SWITCH, APP_URLS, APP_VERSIONS } from '@/constant';
import { openExternalUrl } from '@/core/utils/linking';
import { clearPendingTxs } from '@/core/apis/transactions';
import { useCurrentAccount } from '@/hooks/account';
import { useUpgradeInfo } from '@/hooks/version';
import ThemeSelectorModal, {
  useThemeSelectorModalVisible,
} from './sheetModals/ThemeSelector';
import { createGetStyles } from '@/utils/styles';
import { useRabbyAppNavigation } from '@/hooks/navigation';
import { ManagePasswordSheetModal } from '../ManagePassword/components/ManagePasswordSheetModal';
import { useManagePasswordOnSettings } from '../ManagePassword/hooks';
import { useShowMarkdownInWebVIewTester } from './sheetModals/MarkdownInWebViewTester';
import { useBiometrics, useVerifyByBiometrics } from '@/hooks/biometrics';
import { useFocusEffect } from '@react-navigation/native';
import { useIsAllowScreenshot } from '@/hooks/appSettings';

const LAYOUTS = {
  fiexedFooterHeight: 50,
};

const isSelfhostRegPkg = BUILD_CHANNEL === 'selfhost-reg';

const isIOS = Platform.OS === 'ios';
export default function SettingsScreen(): JSX.Element {
  const { styles, colors } = useThemeStyles(getStyles);
  const { appThemeText } = useAppTheme();

  const navigation = useRabbyAppNavigation();

  const clearPendingRef = useRef<BottomSheetModal>(null);

  const { currentAccount } = useCurrentAccount();

  const { localVersion, remoteVersion, triggerCheckVersion } = useUpgradeInfo();

  const { setThemeSelectorModalVisible } = useThemeSelectorModalVisible();

  const {
    hasSetupCustomPassword,
    requestLockWallet,
    openManagePasswordSheetModal,
  } = useManagePasswordOnSettings();

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

  const [switchWhitelistRef, switchBiometricsRef, switchAllowScreenshotRef] = [
    useRef<SwitchToggleType>(null),
    useRef<SwitchToggleType>(null),
    useRef<SwitchToggleType>(null),
  ];

  const SettingsBlocks: Record<string, SettingConfBlock> = (() => {
    return {
      features: {
        label: 'Features',
        items: [
          {
            label: 'Signature Record',
            icon: RcSignatureRecord,

            disabled: true,
            onDisabledPress: () => {
              toast.show('Coming Soon :)');
            },
          },
          {
            label: 'Manage Address',
            icon: RcManageAddress,
            onPress: () => {},
            disabled: true,
            onDisabledPress: () => {
              toast.show('Coming Soon :)');
            },
          },
          {
            label: `Connect ${Platform.OS === 'ios' ? 'Websites' : 'Dapps'}`,
            icon: RcConnectedDapp,
            onPress: () => {},
            disabled: true,
            onDisabledPress: () => {
              toast.show('Coming Soon :)');
            },
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
        ].filter(Boolean) as SettingConfBlock['items'],
      },
      settings: {
        label: 'Settings',
        items: [
          {
            label: isBiometricsEnabled
              ? 'Biometrics enabled'
              : 'Biometrics disabled',
            icon: isFaceID ? RcIconFaceId : RcIconFingerprint,
            rightNode: (
              <SwitchBiometricsAuthentication ref={switchBiometricsRef} />
            ),
            onPress: () => {
              switchBiometricsRef.current?.toggle();
            },
            disabled: disabledBiometrics,
            visible: APP_FEATURE_SWITCH.biometricsAuth,
          },
          {
            label: 'Enable whitelist for sending assets',
            icon: RcWhitelist,
            onPress: () => {
              switchWhitelistRef.current?.toggle();
            },
            rightNode: <SwitchWhitelistEnable ref={switchWhitelistRef} />,
          },
          {
            label: 'Custom RPC',
            icon: RcCustomRpc,
            onPress: () => {},
            disabled: true,
            visible: !!__DEV__,
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
            },
            // only valid if custom password given
            {
              label: 'Lock Wallet',
              icon: RcLockWallet,
              disabled: !hasSetupCustomPassword,
              onPress: () => {
                requestLockWallet();
              },
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
              label: 'Test Biometrics',
              icon: isFaceID ? RcIconFaceId : RcIconFingerprint,
              onPress: () => {
                startBiometricsVerification({
                  onFinished: () => {
                    abortBiometricsVerification();
                  },
                });
              },
              disabled: disabledBiometrics || !isBiometricsEnabled,
            },
          ],
        },
      }),
    };
  })();

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
        {Object.entries(SettingsBlocks).map(([key, block], idx) => {
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
        <View style={[styles.bottomFooter]}>
          <RcFooterLogo />
        </View>
      </ScrollView>

      <ThemeSelectorModal />

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
