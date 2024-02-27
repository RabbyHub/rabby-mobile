import React, { useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  Dimensions,
  Linking,
  Platform,
} from 'react-native';
import clsx from 'clsx';

import { stringUtils } from '@rabby-wallet/base-utils';

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
} from '@/assets/icons/settings';
import RcFooterLogo from '@/assets/icons/settings/footer-logo.svg';

import { type SettingConfBlock, Block } from './Block';
import { useAppTheme, useThemeColors } from '@/hooks/theme';
import { styled } from 'styled-components/native';
import { useSheetWebViewTester } from './sheetModals/hooks';
import SheetWebViewTester from './sheetModals/SheetWebViewTester';
import { BUILD_CHANNEL } from '@/constant/env';
import { useNavigation } from '@react-navigation/native';
import { RootNames, ScreenLayouts } from '@/constant/layout';
import { useSafeSizes } from '@/hooks/useAppLayout';
import { SwitchWhitelistEnable } from './components/SwitchWhitelistEnable';
import { ConfirmBottomSheetModal } from './components/ConfirmBottomSheetModal';
import { BottomSheetModal } from '@gorhom/bottom-sheet';
import { toast } from '@/components/Toast';
import { checkVersion } from '@/utils/version';
import { APP_URLS, APP_VERSIONS } from '@/constant';
import { openExternalUrl } from '@/core/utils/linking';
import { clearPendingTxs } from '@/core/apis/transactions';
import { useCurrentAccount } from '@/hooks/account';

const Container = styled(NormalScreenContainer)`
  flex: 1;
  justify-content: space-between;
  padding-bottom: 27px;
`;

function SettingsScreen(): JSX.Element {
  const { appTheme, toggleThemeMode } = useAppTheme();

  const { openMetaMaskTestDapp } = useSheetWebViewTester();

  const colors = useThemeColors();

  const navigation = useNavigation();

  const clearPendingRef = useRef<BottomSheetModal>(null);

  const presentWhitelistModal = SwitchWhitelistEnable.usePresent();
  const { currentAccount } = useCurrentAccount();

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
              if (Platform.OS !== 'ios') {
                toast.show('Coming Soon :)');
              }
            },
          },
          {
            label: 'Manage Address',
            icon: RcManageAddress,
            onPress: () => {},
            disabled: true,
            onDisabledPress: () => {
              if (Platform.OS !== 'ios') {
                toast.show('Coming Soon :)');
              }
            },
          },
          {
            label: 'Connect Address',
            icon: RcConnectedDapp,
            onPress: () => {},
            disabled: true,
            onDisabledPress: () => {
              if (Platform.OS !== 'ios') {
                toast.show('Coming Soon :)');
              }
            },
          },
          {
            visible: !!__DEV__,
            label: 'Switch Theme',
            icon: RcThemeMode,
            onPress: () => {
              // TODO: show modal

              toggleThemeMode();
            },
            rightTextNode: () => {
              return (
                <Text className="font-normal text-14 text-light-neutral-title-1 dark:text-dark-neutral-title-1 mr-[6]">
                  {stringUtils.ucfirst(appTheme)} Mode
                </Text>
              );
            },
          },
        ],
      },
      settings: {
        label: 'Settings',
        items: [
          {
            label: 'Enable whitelist for sending assets',
            icon: RcWhitelist,
            rightNode: SwitchWhitelistEnable,
            onPress: () => {
              presentWhitelistModal?.();
            },
          },
          {
            label: 'Custom RPC',
            icon: RcCustomRpc,
            onPress: () => {},
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
            rightTextNode: () => {
              return (
                <Text
                  style={{
                    color: colors['neutral-title-1'],
                    fontSize: 14,
                    fontWeight: '400',
                    paddingRight: 8,
                  }}>
                  {APP_VERSIONS.fromJs}
                </Text>
              );
            },
            onPress: () => {
              checkVersion();
            },
          },
          {
            label: 'Feedback',
            icon: RcFeedback,
            onPress: () => {
              Linking.openURL('https://discord.gg/AvYmaTjrBu');
            },
          },
          {
            label: 'Build Hash',
            icon: RcInfo,
            onPress: () => {},
            rightNode: (
              <Text style={{ color: colors['neutral-body'] }}>
                {BUILD_CHANNEL} - {process.env.BUILD_GIT_HASH}
              </Text>
            ),
            // TODO: only show in non-production mode
            visible: BUILD_CHANNEL === 'selfhost-reg' && !!__DEV__,
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
              label: 'ProviderController Test',
              icon: RcEarth,
              onPress: () => {
                navigation.push(RootNames.ProviderControllerTester, {
                  params: {},
                });
              },
            },
          ],
        },
      }),
    };
  })();

  const { safeTop, safeOffBottom } = useSafeSizes();

  return (
    <Container
      fitStatuBar
      className={clsx(
        'bg-light-neutral-bg-2 dark:bg-dark-neutral-bg-2',
        'pb-[40]',
      )}>
      <View
        style={{
          flex: 1,
          maxHeight:
            Dimensions.get('screen').height -
            (safeTop + safeOffBottom + ScreenLayouts.headerAreaHeight),
          // borderColor: 'black',
          // borderWidth: 1,
        }}>
        <ScrollView
          className="flex-1 p-[20] h-[100%]"
          style={{
            marginBottom: 20,
          }}>
          {Object.entries(SettingsBlocks).map(([key, block], idx) => {
            const l1key = `${key}-${idx}`;

            return (
              <Block
                key={l1key}
                label={block.label}
                className={clsx(idx > 0 && 'mt-[16]')}>
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
        </ScrollView>
      </View>

      <View
        className={clsx(
          'items-center justify-center',
          // 'absolute w-[100%] h-[40] left-0 bottom-0'
        )}>
        <RcFooterLogo />
      </View>

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

      <SheetWebViewTester />
    </Container>
  );
}

export default SettingsScreen;
