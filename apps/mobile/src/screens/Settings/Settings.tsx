import React from 'react';
import { View, Text } from 'react-native';
import clsx from 'clsx';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';

import { stringUtils } from '@rabby-wallet/base-utils';

import NormalScreenContainer from '@/components/ScreenContainer/NormalScreenContainer';

import {
  RcClearPending,
  RcCustomRpc,
  RcFollowUs,
  RcInfo,
  RcLock,
  RcManageAddress,
  RcSupportChains,
  RcThemeMode,
  RcWhitelist,
  RcEarth,
} from '@/assets/icons/settings';
import RcFooterLogo from '@/assets/icons/settings/footer-logo.svg';

import { type SettingConfBlock, Block } from './Block';
import { useAppTheme } from '@/hooks/theme';
import { styled } from 'styled-components/native';
import { useSheetModalsOnSettingScreen } from './sheetModals/hooks';
import SheetWebViewTester from './sheetModals/SheetWebViewTester';

const Container = styled(NormalScreenContainer)`
  flex: 1;
  justify-content: space-between;
  padding-bottom: 27px;
`;

function SettingsScreen(): JSX.Element {
  const { appTheme, toggleThemeMode } = useAppTheme();

  const { toggleShowSheetModal } = useSheetModalsOnSettingScreen();

  const SettingsBlocks: Record<string, SettingConfBlock> = (() => {
    return {
      features: {
        label: 'Features',
        items: [
          // {
          //   label: 'Lock Wallet',
          //   icon: RcLock,
          //   onPress: () => {},
          // },
          {
            label: 'Manage Address',
            icon: RcManageAddress,
            onPress: () => {},
          },
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
      settings: {
        label: 'Settings',
        items: [
          {
            label: 'Enable whitelist for sending assets',
            icon: RcWhitelist,
            onPress: () => {},
          },
          {
            label: 'Custom RPC',
            icon: RcCustomRpc,
            onPress: () => {},
          },
          {
            label: 'Clear Pending',
            icon: RcClearPending,
            onPress: () => {},
          },
        ],
      },
      aboutus: {
        label: 'About Us',
        items: [
          {
            label: 'Current Version',
            icon: RcInfo,
            onPress: () => {},
          },
          {
            label: 'Support Chains',
            icon: RcSupportChains,
            onPress: () => {},
          },
          {
            label: 'Follow Us',
            icon: RcFollowUs,
            onPress: () => {},
          },
        ],
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
                toggleShowSheetModal('webviewTesterRef', true);
              },
            },
          ],
        },
      }),
    };
  })();

  return (
    <Container
      className={clsx('bg-light-neutral-bg-2 dark:bg-dark-neutral-bg-2')}>
      <View className="flex-1 p-[20]">
        {Object.entries(SettingsBlocks).map(([key, block], idx) => {
          const l1key = `${key}-${idx}`;

          return (
            <Block
              key={l1key}
              label={block.label}
              {...(idx > 0 && {
                className: 'mt-[16]',
              })}>
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
      </View>
      <View className="items-center">
        <RcFooterLogo />
      </View>

      <SheetWebViewTester />
    </Container>
  );
}

export default SettingsScreen;
