import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

import { DappInfo } from '@/core/services/dappService';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { useTranslation } from 'react-i18next';
import { BrowserSiteCard } from '@/screens/Browser/components/BrowserSiteCard';

export function BrowserHot({
  onPress,
  isInBottomSheet,
  list,
}: {
  onPress?(dapp: DappInfo): void;
  isInBottomSheet?: boolean;
  list?: DappInfo[];
}) {
  const { colors2024, styles, isLight } = useTheme2024({
    getStyle,
  });

  const { t } = useTranslation();

  return (
    <View>
      <View style={styles.header}>
        <Text style={styles.title}>{t('page.browser.BrowserSearch.hot')}</Text>
      </View>
      <View style={styles.grid}>
        {list?.map(item => {
          return (
            <BrowserSiteCard data={item} onPress={onPress} key={item.origin} />
          );
        })}
      </View>
    </View>
  );
}
const getStyle = createGetStyles2024(({ colors2024 }) => ({
  container: {
    flex: 1,
    backgroundColor: colors2024['neutral-bg-0'],
  },
  list: {
    paddingHorizontal: 20,
  },
  header: {
    paddingHorizontal: 8,
    marginBottom: 12,
  },
  title: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 18,
    lineHeight: 20,
    fontWeight: '800',
  },
  edit: {
    color: colors2024['neutral-body'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    fontStyle: 'normal',
    fontWeight: '700',
    lineHeight: 18,
  },

  grid: {
    gap: 8,
  },
  gridItem: {
    gap: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dappIcon: {
    height: 56,
    width: 56,
    borderRadius: 6,
  },
  dappName: {
    color: colors2024['neutral-title-1'],
    textAlign: 'center',
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    fontStyle: 'normal',
    fontWeight: '500',
    lineHeight: 20,
  },
}));
