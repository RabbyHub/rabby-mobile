import React, { useMemo } from 'react';
import { FlatList, Text, View } from 'react-native';

import { RcArrowRight3CC } from '@/assets/icons/common';
import { RcIconBallCC, RcIconGoogle } from '@/assets/icons/dapp';
import { DappInfo } from '@/core/services/dappService';
import { useTheme2024 } from '@/hooks/theme';
import { BrowserSiteCard } from '@/screens/Browser/components/BrowserSiteCard';
import { createGetStyles2024 } from '@/utils/styles';
import { BottomSheetFlatList } from '@gorhom/bottom-sheet';
import { TouchableOpacity } from 'react-native-gesture-handler';
import { dappService } from '@/core/services';
import { safeGetOrigin } from '@rabby-wallet/base-utils/dist/isomorphic/url';
import { useTranslation } from 'react-i18next';
import { matomoRequestEvent } from '@/utils/analytics';
import { useMemoizedFn } from 'ahooks';
import { ViewProps } from 'react-native';

export function DappFirstSearchResult({
  data,
  searchText,
  onOpenURL,
  isValidDomain,
  style,
}: {
  data: DappInfo[];
  searchText: string;
  onOpenURL?(url: string): void;
  isValidDomain?: boolean;
  style?: ViewProps['style'];
}) {
  const { colors2024, styles } = useTheme2024({
    getStyle,
  });

  const { t } = useTranslation();

  const handlePress = useMemoizedFn((dapp: DappInfo) => {
    if (!dappService.getDapp(safeGetOrigin(dapp.url || dapp.origin))?.isDapp) {
      dappService.updateDapp(dapp);
    }
    onOpenURL?.(dapp.url || dapp.origin);
    if (dapp.origin) {
      matomoRequestEvent({
        category: 'Websites Usage',
        action: 'Website_Visit_Search Results',
        label: dapp.origin,
      });
    }
  });

  return (
    <>
      {searchText ? (
        <View style={[styles.list, { flex: 0 }, style]}>
          {data?.[0] ? (
            <View>
              <Text style={styles.firstTitle}>{t('global.Dapp')}</Text>
              <BrowserSiteCard
                keyword={searchText}
                data={data[0]}
                onPress={handlePress}
                isShowBorder
                isShowFavorite
                isShowListBy
              />
            </View>
          ) : null}
          <TouchableOpacity
            style={styles.listItem}
            hitSlop={10}
            onPress={() => {
              onOpenURL?.(
                `https://www.google.com/search?q=${encodeURIComponent(
                  searchText,
                )}`,
              );
            }}>
            <RcIconGoogle style={styles.listItemIcon} />
            <View style={styles.listItemContent}>
              <Text
                style={styles.listItemText}
                numberOfLines={1}
                ellipsizeMode="tail">
                {t('page.browser.BrowserSearch.searchInGoogle', {
                  searchText: searchText,
                })}
              </Text>
              <RcArrowRight3CC
                width={16}
                height={16}
                style={styles.listItemArrowIcon}
                color={colors2024['neutral-body']}
              />
            </View>
          </TouchableOpacity>
          {isValidDomain ? (
            <TouchableOpacity
              style={styles.listItem}
              hitSlop={10}
              onPress={() => {
                const url = /^https?:\/\//.test(searchText)
                  ? searchText
                  : `https://${searchText}`;
                onOpenURL?.(url);
                const origin = safeGetOrigin(url);
                if (origin) {
                  matomoRequestEvent({
                    category: 'Websites Usage',
                    action: 'Website_Visit_Direct Open',
                    label: origin,
                  });
                }
              }}>
              <RcIconBallCC
                style={styles.listItemIcon}
                color={colors2024['neutral-secondary']}
              />
              <View style={styles.listItemContent}>
                <Text
                  style={styles.listItemText}
                  numberOfLines={1}
                  ellipsizeMode="tail">
                  {t('page.browser.BrowserSearch.openUrl', {
                    searchText: searchText,
                  })}
                </Text>
                <RcArrowRight3CC
                  width={16}
                  height={16}
                  style={styles.listItemArrowIcon}
                  color={colors2024['neutral-body']}
                />
              </View>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}
    </>
  );
}

export function BrowserSearchResult({
  data,
  searchText,
  onOpenURL,
  isValidDomain,
  isInBottomSheet,
  showOtherResults = true,
}: {
  data: DappInfo[];
  searchText: string;
  onOpenURL?(url: string): void;
  isValidDomain?: boolean;
  isInBottomSheet?: boolean;
  showOtherResults?: boolean;
}) {
  const { colors2024, styles } = useTheme2024({
    getStyle,
  });

  const Component = isInBottomSheet ? BottomSheetFlatList : FlatList;

  const { t } = useTranslation();

  const handlePress = useMemoizedFn((dapp: DappInfo) => {
    if (!dappService.getDapp(safeGetOrigin(dapp.url || dapp.origin))?.isDapp) {
      dappService.updateDapp(dapp);
    }
    onOpenURL?.(dapp.url || dapp.origin);
    if (dapp.origin) {
      matomoRequestEvent({
        category: 'Websites Usage',
        action: 'Website_Visit_Search Results',
        label: dapp.origin,
      });
    }
  });

  return (
    <Component
      data={showOtherResults ? data?.slice(1) : []}
      style={styles.dappList}
      keyExtractor={item => item.origin}
      // onEndReached={onEndReached}
      onEndReachedThreshold={0.8}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      // ListEmptyComponent={ListEmptyComponent}
      ListHeaderComponent={
        <>
          <DappFirstSearchResult
            data={data}
            searchText={searchText}
            onOpenURL={onOpenURL}
            isValidDomain={isValidDomain}
          />
          {data?.length > 1 ? (
            <View style={styles.header}>
              <Text style={styles.title}>
                {t('page.browser.BrowserSearch.otherResults')}
              </Text>
            </View>
          ) : null}
        </>
      }
      renderItem={({ item }) => {
        return (
          <View style={styles.dappListItem}>
            <BrowserSiteCard
              data={item}
              onPress={handlePress}
              // isShowBorder
              isShowFavorite
              isShowListBy
            />
          </View>
        );
      }}
    />
  );
}
const getStyle = createGetStyles2024(({ colors2024 }) => ({
  container: {
    flex: 1,
    backgroundColor: colors2024['neutral-bg-0'],
  },
  header: {
    paddingHorizontal: 8,
    marginBottom: 12,
  },
  title: {
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '500',
  },
  dappList: {
    paddingHorizontal: 20,
    // paddingTop: 22,
    paddingTop: 0,
  },
  dappListItem: {
    marginBottom: 12,
  },
  firstTitle: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 18,
    fontStyle: 'normal',
    fontWeight: '800',
    lineHeight: 22,
    paddingBottom: 12,
  },
  list: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: 20,
    marginBottom: 30,
  },
  listItem: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 8,
  },
  listItemContent: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  listItemIcon: {
    width: 20,
    height: 20,
  },
  listItemArrowIcon: {
    width: 16,
    height: 16,
  },
  listItemText: {
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '500',
  },
  footer: {
    backgroundColor: colors2024['neutral-bg-1'],
    paddingHorizontal: 16,
    paddingVertical: 12,
    // box-shadow: 0px -6px 40px 0px rgba(55, 56, 63, 0.12);
    // backdrop-filter: blur(14.5px);
  },
}));
