import React from 'react';
import { FlatList, Text, View } from 'react-native';

import { RcArrowRight3CC } from '@/assets/icons/common';
import { RcIconBallCC, RcIconGoogle } from '@/assets/icons/dapp';
import { DappInfo } from '@/core/services/dappService';
import { useTheme2024 } from '@/hooks/theme';
import { BrowserSiteCard } from '@/screens/Browser/components/BrowserSiteCard';
import { createGetStyles2024 } from '@/utils/styles';
import { BottomSheetFlatList } from '@gorhom/bottom-sheet';
import { TouchableOpacity } from 'react-native-gesture-handler';

export function BrowserSearchResult({
  data,
  searchText,
  onOpenURL,
  isValidDomain,
  isInBottomSheet,
}: {
  data: DappInfo[];
  searchText: string;
  onOpenURL?(url: string): void;
  isValidDomain?: boolean;
  isInBottomSheet?: boolean;
}) {
  const { colors2024, styles } = useTheme2024({
    getStyle,
  });

  const Component = isInBottomSheet ? BottomSheetFlatList : FlatList;

  return (
    <Component
      data={data}
      style={styles.dappList}
      keyExtractor={item => item.origin}
      // onEndReached={onEndReached}
      onEndReachedThreshold={0.8}
      showsVerticalScrollIndicator={false}
      // ListEmptyComponent={ListEmptyComponent}
      ListHeaderComponent={
        <>
          {searchText ? (
            <View style={styles.list}>
              <TouchableOpacity
                style={styles.listItem}
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
                    Search "{searchText}" in Google
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
                  onPress={() => {
                    onOpenURL?.(
                      /^https?:\/\//.test(searchText)
                        ? searchText
                        : `https://${searchText}`,
                    );
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
                      Open "{searchText}"
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
          {data?.length ? (
            <View style={styles.header}>
              <Text style={styles.title}>Results</Text>
            </View>
          ) : null}
        </>
      }
      renderItem={({ item }) => {
        return (
          <View style={styles.dappListItem}>
            <BrowserSiteCard
              // keyword={keyword}
              data={item}
              onPress={dapp => onOpenURL?.(dapp.url || dapp.origin)}
              isShowBorder
              isShowFavorite
              isShowListBy
              // onFavoritePress={onFavoritePress}
              // onPress={onPress}
              // isShowDesc
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
    paddingTop: 22,
  },
  dappListItem: {
    marginBottom: 12,
  },
  list: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: 24,
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
    color: colors2024['neutral-body'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
  },
  footer: {
    backgroundColor: colors2024['neutral-bg-1'],
    paddingHorizontal: 16,
    paddingVertical: 12,
    // box-shadow: 0px -6px 40px 0px rgba(55, 56, 63, 0.12);
    // backdrop-filter: blur(14.5px);
  },
}));
