import React from 'react';

import { View, Text } from 'react-native';

import clsx from 'clsx';

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
} from '@/assets/icons/settings';
import RcFooterLogo from '@/assets/icons/settings/footer-logo.svg';

import { type SettingConfBlock, Block } from './Block';
import { useAppTheme, useThemeColors } from '@/hooks/theme';

function SettingsStack(): JSX.Element {
  const { appTheme, toggleThemeMode } = useAppTheme();

  const SettingsBlocks = React.useMemo<Record<string, SettingConfBlock>>(() => {
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
                <Text className="font-normal text-14 text-r-neutral-title-1 mr-[6]">
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
    };
  }, [appTheme, toggleThemeMode]);

  return (
    <NormalScreenContainer
      className={clsx(
        'justify-between padding-[27]',
        'bg-r-neutral-bg-2 dark:bg-dark-r-neutral-bg-2',
      )}>
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
    </NormalScreenContainer>
  );
}

export default SettingsStack;
