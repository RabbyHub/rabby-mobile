import React from 'react';
import { View, Text, ScrollView, Dimensions } from 'react-native';
import clsx from 'clsx';

import { stringUtils } from '@rabby-wallet/base-utils';

import NormalScreenContainer from '@/components/ScreenContainer/NormalScreenContainer';

import {
  RcClearPending,
  RcCustomRpc,
  RcFollowUs,
  RcInfo,
  RcPrivacyPolicy,
  RcLock,
  RcManageAddress,
  RcSupportChains,
  RcThemeMode,
  RcWhitelist,
  RcEarth,
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
import { APP_URLS, APP_VERSION } from '@/core/services/constant';
import { openExternalUrl } from '@/core/utils/linking';

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

  const SettingsBlocks: Record<string, SettingConfBlock> = (() => {
    return {
      features: {
        label: 'Features',
        items: [
          // TODO: in the future
          // {
          //   label: 'Lock Wallet',
          //   icon: RcLock,
          //   onPress: () => {},
          // },
          // TODO: in the future
          // {
          //   label: 'Manage Address',
          //   icon: RcManageAddress,
          //   onPress: () => {},
          // },
          {
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
      // settings: {
      //   label: 'Settings',
      //   items: [
      //     // TODO: in the future
      //     // {
      //     //   label: 'Enable whitelist for sending assets',
      //     //   icon: RcWhitelist,
      //     //   onPress: () => {},
      //     // },
      //     // TODO: in the future
      //     // {
      //     //   label: 'Custom RPC',
      //     //   icon: RcCustomRpc,
      //     //   onPress: () => {},
      //     // },
      //     // TODO: in the future
      //     // {
      //     //   label: 'Clear Pending',
      //     //   icon: RcClearPending,
      //     //   onPress: () => {},
      //     // },
      //   ],
      // },
      aboutus: {
        label: 'About Us',
        items: [
          {
            label: 'Current Version',
            icon: RcInfo,
            rightNode: (
              <Text style={{ color: colors['neutral-body'] }}>
                {APP_VERSION}
              </Text>
            ),
            onPress: () => {},
          },
          {
            label: 'Privacy Policy',
            icon: RcPrivacyPolicy,
            onPress: async () => {
              openExternalUrl(APP_URLS.PRIVACY_POLICY);
            },
          },
          // TODO: only show in non-production mode
          BUILD_CHANNEL !== 'production' &&
            ({
              label: 'Build Hash',
              icon: RcInfo,
              onPress: () => {},
              rightNode: (
                <Text style={{ color: colors['neutral-body'] }}>
                  {BUILD_CHANNEL} - {process.env.BUILD_GIT_HASH}
                </Text>
              ),
            } as any),
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
                      label={item.label}
                      icon={item.icon}
                      onPress={item.onPress}
                      rightTextNode={item.rightTextNode}
                      rightNode={item.rightNode}
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

      <SheetWebViewTester />
    </Container>
  );
}

export default SettingsScreen;
