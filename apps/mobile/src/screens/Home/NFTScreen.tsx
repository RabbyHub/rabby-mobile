import { IconDefaultNFT } from '@/assets/icons/nft';
import { Text } from '@/components';
import { CustomTouchableOpacity } from '@/components/CustomTouchableOpacity';
import { Media } from '@/components/Media';
import { CHAIN_ID_LIST } from '@/constant/projectLists';
import { useCurrentAccount } from '@/hooks/account';
import { useThemeColors } from '@/hooks/theme';
import { abbreviateNumber } from '@/utils/math';
import { chunk } from 'lodash';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  useColorScheme,
  StyleSheet,
  View,
  SectionListProps,
  Dimensions,
  RefreshControl,
  Platform,
} from 'react-native';
import { useQueryNft } from './hooks/nft';
import FastImage from 'react-native-fast-image';
import { AppColorsVariants } from '@/constant/theme';
import { Tabs } from 'react-native-collapsible-tab-view';
import { NFTListLoader } from './components/NFTSkeleton';
import { CollectionList, NFTItem } from '@rabby-wallet/rabby-api/dist/types';
import { EmptyHolder } from '@/components/EmptyHolder';
import { toast } from '@/components/Toast';

type ItemProps = {
  item: NFTItem;
  index: number;
  collectionName: string;
};
const width = Dimensions.get('window').width;
/**
 * list paddingHorizontal 20
 * item margin 5
 * 5 items in one row
 * 20 * 2 + 5 * 2 * 5
 */
const detailWidth = (width - 90) / 5;

const Item = ({ item, index, collectionName }: ItemProps) => {
  const colors = useThemeColors();
  const isLight = useColorScheme() === 'light';
  const styles = getStyle(colors, isLight);

  const handleNFTPress = useCallback(() => {
    // TODO: next milestone
    // return navigate(RootNames.NftDetail, {
    //   token: item,
    //   collectionName,
    // });
    if (Platform.OS !== 'ios') {
      toast.show('Coming Soon :)');
    }
  }, []);

  const numberDisplay = useMemo(() => {
    let v = abbreviateNumber(item.amount || 0);
    if (v?.endsWith('T')) {
      let tmp = v.slice(0, -1);
      if (Number(tmp) > 999) {
        v += '+';
      }
    }
    return v;
  }, [item.amount]);

  return (
    <CustomTouchableOpacity
      style={StyleSheet.flatten([
        styles.imagesView,
        {
          width: detailWidth,
          height: detailWidth,
        },
      ])}
      key={item.id}
      onPress={handleNFTPress}>
      <Media
        failedPlaceholder={<IconDefaultNFT width="100%" height="100%" />}
        type={item?.content_type}
        src={item?.content?.endsWith('.svg') ? '' : item?.content}
        thumbnail={item?.content?.endsWith('.svg') ? '' : item?.content}
        mediaStyle={styles.images}
        style={styles.images}
        playIconSize={36}
      />
      {item?.amount > 1 ? (
        <View style={styles.corner}>
          <Text style={styles.cornerNumber}>{numberDisplay}</Text>
        </View>
      ) : null}
    </CustomTouchableOpacity>
  );
};

class PureItem extends React.PureComponent<{
  style: React.ComponentProps<typeof View>['style'];
  items: NFTItem[];
  collection: CollectionList;
}> {
  render() {
    const { style, items, collection } = this.props;
    return (
      <View style={style}>
        {items.map((token, index) => (
          <Item
            item={token}
            index={index}
            key={token.id}
            collectionName={collection!.name}
          />
        ))}
      </View>
    );
  }
}

export const NFTScreen = ({ onRefresh }: { onRefresh(): void }) => {
  const colors = useThemeColors();
  const isLight = useColorScheme() === 'light';
  const styles = getStyle(colors, isLight);
  const { currentAccount } = useCurrentAccount();

  const { list, isLoading, reload } = useQueryNft(currentAccount!.address);
  const refreshing = useMemo(() => {
    if (list.length > 0) {
      return isLoading;
    } else {
      return false;
    }
  }, [isLoading, list]);

  const sectionList = useMemo(
    () =>
      list.map(item => ({
        data: chunk(item.nft_list, 5),
        collection: item,
        key: item.id,
      })),
    [list],
  );

  const renderItem: Exclude<
    SectionListProps<NFTItem[], { collection?: CollectionList }>['renderItem'],
    void
  > = useCallback(
    ({ item, section: { collection } }) => {
      return (
        <PureItem
          style={styles.imageContainer}
          items={item}
          collection={collection!}
          key={collection!.name}
        />
      );
    },
    [styles.imageContainer],
  );

  const renderSectionHeader: Exclude<
    SectionListProps<
      NFTItem[],
      { collection?: CollectionList }
    >['renderSectionHeader'],
    void
  > = useCallback(
    ({ section }) => {
      const { collection } = section;
      const chain = CHAIN_ID_LIST.get(collection!.chain);
      const iconUri = chain?.nativeTokenLogo;

      return (
        <View style={styles.headerContainer}>
          <View style={styles.titleContainer}>
            <Text style={styles.title} numberOfLines={1}>
              {collection!.name}
            </Text>
            <Text
              style={styles.length}>{`(${collection?.nft_list.length})`}</Text>
          </View>
          {collection?.floor_price && collection.floor_price !== 0 ? (
            <View style={styles.floorPriceContainer}>
              {iconUri ? (
                <FastImage
                  source={{
                    uri: iconUri,
                  }}
                  style={styles.chainIcon}
                />
              ) : null}
              <Text style={styles.floorPriceText}>
                {chain?.name} / Floor Price:{' '}
              </Text>
              <Text style={styles.floorPriceText}>
                {collection.floor_price}
              </Text>
              <Text style={styles.floorPriceText}>
                {collection?.native_token?.symbol}
              </Text>
            </View>
          ) : null}
        </View>
      );
    },
    [styles],
  );

  const keyExtractor = useCallback((x: { id: any }[]) => x[0].id, []);

  const renderHeaderComponent = useCallback(() => {
    if (!list.length) {
      return null;
    }
    return (
      <View style={styles.tipContainer}>
        <View style={styles.tipLine} />
        <Text style={styles.tip}>NFTs are not included in wallet balance</Text>
        <View style={styles.tipLine} />
      </View>
    );
  }, [list.length, styles.tip, styles.tipContainer, styles.tipLine]);

  const ListEmptyComponent = useMemo(() => {
    return isLoading ? (
      <NFTListLoader detailWidth={detailWidth} />
    ) : (
      <EmptyHolder text="No NFTs" type="card" />
    );
  }, [isLoading]);

  return (
    <View style={styles.container}>
      <Tabs.SectionList
        ListHeaderComponent={renderHeaderComponent}
        style={styles.list}
        contentContainerStyle={styles.listContainer}
        renderItem={renderItem}
        renderSectionHeader={renderSectionHeader}
        renderSectionFooter={() => <View style={styles.footContainer} />}
        sections={sectionList}
        keyExtractor={keyExtractor}
        ListEmptyComponent={ListEmptyComponent}
        stickySectionHeadersEnabled={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              reload();
              onRefresh();
            }}
          />
        }
      />
    </View>
  );
};

const getStyle = (colors: AppColorsVariants, isLight = true) =>
  StyleSheet.create({
    container: {
      backgroundColor: colors['neutral-bg-1'],
    },
    tipContainer: {
      position: 'relative',
      marginVertical: 16,
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
    },
    tip: {
      textAlign: 'center',
      color: colors['neutral-foot'],
      fontSize: 11,
      paddingHorizontal: 10,
    },
    tipLine: {
      width: 'auto',
      flex: 1,
      height: StyleSheet.hairlineWidth,
      backgroundColor: colors['neutral-line'],
    },
    listContainer: {
      paddingBottom: 90,
    },
    list: {
      width: '100%',
      paddingHorizontal: 20,
    },
    title: {
      fontSize: 16,
      color: colors['neutral-title-1'],
      maxWidth: 260,
      fontWeight: '600',
    },
    length: {
      fontSize: 13,
      fontWeight: '400',
      color: colors['neutral-foot'],
      marginLeft: 4,
    },
    headerContainer: {
      paddingVertical: 10,
    },
    titleContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'flex-start',
      // alignItems: 'flex-end',
    },
    floorPriceContainer: {
      marginTop: 6,
      flexDirection: 'row',
    },
    floorPriceText: {
      fontSize: 13,
      fontWeight: '400',
      color: colors['neutral-foot'],
    },
    imageContainer: {
      flexDirection: 'row',
      justifyContent: 'flex-start',
      marginLeft: -5,
      marginRight: -5,
    },
    footContainer: {
      marginVertical: 10,
      height: StyleSheet.hairlineWidth,
      backgroundColor: colors['neutral-line'],
    },
    imagesView: {
      borderRadius: 4,
      justifyContent: 'center',
      alignItems: 'center',
      position: 'relative',
      margin: 5,
    },
    images: {
      width: '100%',
      height: '100%',
      borderRadius: 4,
    },
    empty: {
      width: '100%',
      paddingTop: '40%',
      justifyContent: 'center',
    },
    chainIcon: {
      marginRight: 4,
      alignSelf: 'center',
      marginTop: 2,
      width: 16,
      height: 16,
    },
    corner: {
      backgroundColor: colors['neutral-black'],
      position: 'absolute',
      right: 4,
      top: 4,
      paddingHorizontal: 4,
      paddingVertical: 1,
      borderRadius: 2,
      alignItems: 'center',
      opacity: 0.8,
    },
    cornerNumber: {
      color: colors['neutral-title-2'],
      fontSize: 12,
      fontWeight: '400',
      lineHeight: 14,
    },
    loadingWrap: {
      width: '100%',
      height: '100%',
    },
  });
