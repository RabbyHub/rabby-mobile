import React, { useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { PillsSwitch, PillsSwitchProps } from './index';
import { StyleSheet } from 'react-native';

const NetTypes = {
  mainnet: 'Mainnets',
  testnet: 'Testnets',
} as const;

export type NetSwitchTabsKey = keyof typeof NetTypes;
type OptionType = {
  key: NetSwitchTabsKey;
  label: string;
};
type SwitchTabProps = Omit<PillsSwitchProps<OptionType[]>, 'options'>;

export function useSwitchNetTab(options?: { hideTestnetTab?: boolean }) {
  const isShowTestnet = true;
  const { hideTestnetTab = false } = options || {};

  const [selectedTab, setSelectedTab] = useState<OptionType['key']>('mainnet');
  const alwaysMain = useMemo(
    () => !isShowTestnet || hideTestnetTab,
    [isShowTestnet, hideTestnetTab],
  );

  const onTabChange = useCallback(
    (key: OptionType['key']) => {
      setSelectedTab(alwaysMain ? 'mainnet' : key);
    },
    [alwaysMain],
  );

  return {
    isShowTestnet: isShowTestnet && !hideTestnetTab,
    selectedTab: alwaysMain ? 'mainnet' : selectedTab,
    onTabChange,
  };
}

function useSwitchOptions() {
  const { t } = useTranslation();

  return useMemo(() => {
    return [
      {
        key: 'mainnet',
        label: t('component.PillsSwitch.NetSwitchTabs.mainnet'),
      },
      {
        key: 'testnet',
        label: t('component.PillsSwitch.NetSwitchTabs.testnet'),
      },
    ] as const;
  }, [t]);
}

export default function NetSwitchTabs(props: SwitchTabProps) {
  const switchOptions = useSwitchOptions();

  return (
    <PillsSwitch
      {...props}
      itemStyle={StyleSheet.flatten([
        {
          height: 36,
        },
        props.itemStyle,
      ])}
      options={switchOptions}
    />
  );
}
