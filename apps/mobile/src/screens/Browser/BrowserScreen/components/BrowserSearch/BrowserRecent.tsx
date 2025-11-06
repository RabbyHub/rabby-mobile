import React, { useMemo } from 'react';
import { FlatList, Text, useWindowDimensions, View } from 'react-native';

import { RcIconDynamicArrowDownCC } from '@/assets/icons/dapp';
import RcIconEmptyDark from '@/assets/icons/dapp/dapp-history-empty-dark.svg';
import RcIconEmpty from '@/assets/icons/dapp/dapp-history-empty.svg';
import { DappInfo } from '@/core/services/dappService';
import { useBrowserHistory } from '@/hooks/browser/useBrowserHistory';
import { useTheme2024 } from '@/hooks/theme';
import { BrowserSiteCard } from '@/screens/Browser/components/BrowserSiteCard';
import { createGetStyles2024 } from '@/utils/styles';
import { BottomSheetFlatList, TouchableOpacity } from '@gorhom/bottom-sheet';
import { useTranslation } from 'react-i18next';
import { Image } from 'react-native-reanimated/lib/typescript/Animated';
import { DappIcon } from '@/screens/Dapps/components/DappIcon';
import dayjs from 'dayjs';

export function BrowserRecent({
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

  const { width } = useWindowDimensions();

  const itemW = (width - 20 * 2 - 8 * 2) / 4;

  const Component = isInBottomSheet ? BottomSheetFlatList : FlatList;

  if (!list?.length) {
    return (
      <View>
        <View style={styles.header}>
          <Text style={styles.title}>
            {t('page.browser.BrowserSearch.recent')}
          </Text>
        </View>
        <View style={styles.empty}>
          <View style={styles.emptyContent}>
            {isLight ? (
              <RcIconEmpty style={styles.emptyIcon} />
            ) : (
              <RcIconEmptyDark style={styles.emptyIcon} />
            )}
            <Text style={styles.emptyText}>
              {t('page.browser.BrowserSearch.recentEmpty')}
            </Text>
          </View>
          <RcIconDynamicArrowDownCC color={colors2024['neutral-line']} />
        </View>
      </View>
    );
  }
  //
  return (
    <View>
      <View style={styles.header}>
        <Text style={styles.title}>
          {t('page.browser.BrowserSearch.recent')}
        </Text>
      </View>
      <View style={styles.grid}>
        {list
          ?.filter(item =>
            dayjs
              .unix(item.infoUpdateAt || (item as any)?.createdAt)
              .add(3, 'day')
              .isAfter(dayjs()),
          )
          ?.sort((a, b) => (b?.infoUpdateAt || 0) - (a?.infoUpdateAt || 0))
          .slice(0, 8)
          .map(data => (
            <TouchableOpacity
              onPress={() => {
                onPress?.(data);
              }}
              key={data.url || data.origin}
              style={[styles.gridItem, { width: itemW }]}>
              <DappIcon
                source={
                  data?.icon
                    ? {
                        uri: data.icon,
                      }
                    : undefined
                }
                origin={data.origin}
                style={styles.dappIcon}
              />
              <Text style={styles.dappName}>
                {data.info?.name || data?.name}
              </Text>
            </TouchableOpacity>
          ))}
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

  empty: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 16,
    paddingTop: 32,
  },
  emptyContent: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 6,
  },
  emptyIcon: {
    width: 163,
    height: 126,
  },
  emptyText: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
    fontFamily: 'SF Pro Rounded',
    color: colors2024['neutral-info'],
    textAlign: 'center',
  },

  grid: {
    flexDirection: 'row',
    gap: 16,
    flexWrap: 'wrap',
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
