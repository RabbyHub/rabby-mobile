import { IconDefaultNFT } from '@/assets/icons/nft';
import { Text } from '@/components';
import { CustomTouchableOpacity } from '@/components/CustomTouchableOpacity';
import { MEDIA_TYPE, Media } from '@/components/Media';
import { getCHAIN_ID_LIST } from '@/constant/projectLists';
import { useCurrentAccount } from '@/hooks/account';
import { useThemeStyles } from '@/hooks/theme';
import { abbreviateNumber } from '@/utils/math';
import { chunk } from 'lodash';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  StyleSheet,
  View,
  SectionListProps,
  Dimensions,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useQueryNft } from './hooks/nft';
import FastImage from 'react-native-fast-image';
import { AppColorsVariants } from '@/constant/theme';
import { Tabs } from 'react-native-collapsible-tab-view';
import { NFTListLoader } from './components/NFTSkeleton';
import { CollectionList, NFTItem } from '@rabby-wallet/rabby-api/dist/types';
import { EmptyHolder } from '@/components/EmptyHolder';
import { usePsudoPagination } from '@/hooks/common/usePagination';
import {
  createGlobalBottomSheetModal,
  removeGlobalBottomSheetModal,
} from '@/components/GlobalBottomSheetModal';
import { MODAL_NAMES } from '@/components/GlobalBottomSheetModal/types';
import { NFTDetailPopupInner } from '../NftDetail/PopupInner';
import { createGetStyles, makeDebugBorder } from '@/utils/styles';
import { useRabbyAppNavigation } from '@/hooks/navigation';
import { RootNames } from '@/constant/layout';

type ItemProps = {
  item: NFTItem;
  indexInline: number;
  lastCountMark: null | number;
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

const Item = ({ item, lastCountMark, collectionName }: ItemProps) => {
  const { styles } = useThemeStyles(getStyle);
  const navigation = useRabbyAppNavigation();

  const handleNFTPress = useCallback(() => {
    const id = createGlobalBottomSheetModal({
      name: MODAL_NAMES.NFT_DETAIL,
      bottomSheetModalProps: {
        footerComponent: () => (
          <NFTDetailPopupInner.FooterComponent
            onPressSend={() => {
              removeGlobalBottomSheetModal(id);

              navigation.push(RootNames.StackTransaction, {
                screen: RootNames.SendNFT,
                params: {
                  collectionName,
                  nftItem: item,
                },
              });
            }}
            token={item}
            collectionName={collectionName}
          />
        ),
      },
      token: item,
      collectionName,
    });
  }, [item, collectionName, navigation]);

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

  const isSvgURL = item?.content?.endsWith('.svg');

  return (
    <CustomTouchableOpacity
      style={StyleSheet.flatten([
        styles.imagesView,
        {
          width: detailWidth,
          height: detailWidth,
        },
      ])}
      onPress={handleNFTPress}>
      <Media
        failedPlaceholder={<IconDefaultNFT width="100%" height="100%" />}
        type={item?.content_type as MEDIA_TYPE}
        src={isSvgURL ? '' : item?.content}
        thumbnail={isSvgURL ? '' : item?.content}
        mediaStyle={styles.images}
        style={styles.images}
        playIconSize={36}
      />
      {lastCountMark && (
        <View style={styles.imageCountMarkView}>
          <Text style={styles.imageCountMarkText}>+{lastCountMark}</Text>
        </View>
      )}
      {item?.amount > 1 ? (
        <View style={styles.corner}>
          <Text style={styles.cornerNumber}>x{numberDisplay}</Text>
        </View>
      ) : null}
    </CustomTouchableOpacity>
  );
};

class PureItem extends React.PureComponent<{
  style: React.ComponentProps<typeof View>['style'];
  items: NFTItem[];
  collection: CollectionList;
  isLastLine?: boolean;
}> {
  render() {
    const { style, items, collection, isLastLine } = this.props;

    const collectionNFTCount = collection.nft_list.length;
    const needLastCountMark =
      isLastLine && collectionNFTCount > NFT_LIMITED_DISPLAY_COUNT;

    return (
      <View style={style}>
        {items.map((token, indexInline) => {
          const lastCountMark = !needLastCountMark
            ? null
            : indexInline === NFT_COUNT_PER_LINE - 1
            ? collectionNFTCount - NFT_LIMITED_DISPLAY_COUNT
            : null;

          return (
            <Item
              item={token}
              indexInline={indexInline}
              key={`${token.id}-${collection!.name}-${indexInline}`}
              lastCountMark={lastCountMark}
              collectionName={collection.name}
            />
          );
        })}
      </View>
    );
  }
}

const NFT_COUNT_PER_LINE = 5;
const NFT_LIMITED_DISPLAY_COUNT = 50;
const NFT_LINES_LIMIT = NFT_LIMITED_DISPLAY_COUNT / NFT_COUNT_PER_LINE;
export const NFTScreen = ({ onRefresh }: { onRefresh(): void }) => {
  const { styles } = useThemeStyles(getStyle);
  const { currentAccount } = useCurrentAccount();

  const {
    list: nftList,
    isLoading,
    reload,
  } = useQueryNft(currentAccount!.address);
  const refreshing = useMemo(() => {
    if (nftList.length > 0) {
      return isLoading;
    } else {
      return false;
    }
  }, [isLoading, nftList]);

  const fullSectionList = useMemo(
    () =>
      nftList.map((collection, index) => {
        const renderLines = chunk(collection.nft_list, NFT_COUNT_PER_LINE);
        return {
          // data: chunk(collection.nft_list, 5),
          data: renderLines.slice(0, NFT_LINES_LIMIT),
          collection: collection,
          key: `${collection.id}-${index}`,
        };
      }),
    [nftList],
  );

  const {
    fallList: sectionList,
    simulateLoadNext: goToNextSectionList,
    isFetchingNextPage,
  } = usePsudoPagination(fullSectionList, { pageSize: 8 });

  const onEndReached = useCallback(() => {
    goToNextSectionList();
  }, [goToNextSectionList]);

  const renderItem: Exclude<
    SectionListProps<NFTItem[], { collection?: CollectionList }>['renderItem'],
    void
  > = useCallback(
    ({ item, section: { collection }, index }) => {
      const isLastLine = index === NFT_LINES_LIMIT - 1;
      return (
        <PureItem
          style={styles.imageContainer}
          items={item}
          collection={collection!}
          key={collection!.name}
          isLastLine={isLastLine}
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
      const chain = getCHAIN_ID_LIST().get(collection!.chain);
      const iconUri = chain?.nativeTokenLogo;

      const showSubTitle = iconUri || chain?.name || !!collection?.floor_price;

      return (
        <View style={styles.headerContainer}>
          <View style={styles.titleContainer}>
            <Text style={styles.title} numberOfLines={1}>
              {collection!.name}
            </Text>
            <Text
              style={styles.length}>{`(${collection?.nft_list.length})`}</Text>
          </View>
          {!showSubTitle ? null : (
            <View style={styles.floorPriceContainer}>
              {iconUri ? (
                <FastImage
                  source={{
                    uri: iconUri,
                  }}
                  style={styles.chainIcon}
                />
              ) : null}
              <Text style={styles.floorPriceText}>{chain?.name} </Text>
              {!!collection?.floor_price && (
                <>
                  <Text style={styles.floorPriceText}>
                    / Floor Price: {collection.floor_price}
                  </Text>
                  <Text style={styles.floorPriceText}>
                    {collection?.native_token?.symbol}
                  </Text>
                </>
              )}
            </View>
          )}
        </View>
      );
    },
    [styles],
  );

  const keyExtractor = useCallback<
    SectionListProps<
      NFTItem[],
      { collection?: CollectionList }
    >['keyExtractor'] &
      object
  >((nftItems, index) => {
    const allIds = nftItems.map(item => item.id).join('-');
    return `${allIds}-${index}`;
  }, []);

  const renderHeaderComponent = useCallback(() => {
    if (!nftList.length) {
      return null;
    }
    return (
      <View style={styles.tipContainer}>
        <View style={styles.tipLine} />
        <Text style={styles.tip}>NFTs are not included in wallet balance</Text>
        <View style={styles.tipLine} />
      </View>
    );
  }, [nftList.length, styles.tip, styles.tipContainer, styles.tipLine]);

  const ListEmptyComponent = useMemo(() => {
    return isLoading ? (
      <NFTListLoader detailWidth={detailWidth} />
    ) : (
      <EmptyHolder text="No NFTs" type="card" />
    );
  }, [isLoading]);

  return (
    <View style={styles.container}>
      <Tabs.SectionList<NFTItem[]>
        initialNumToRender={4}
        maxToRenderPerBatch={20}
        // updateCellsBatchingPeriod={200}
        ListHeaderComponent={renderHeaderComponent}
        ListFooterComponent={isFetchingNextPage ? <ActivityIndicator /> : null}
        style={styles.list}
        contentContainerStyle={styles.listContainer}
        renderItem={renderItem}
        renderSectionHeader={renderSectionHeader}
        renderSectionFooter={() => <View style={styles.footContainer} />}
        sections={sectionList}
        keyExtractor={keyExtractor}
        ListEmptyComponent={ListEmptyComponent}
        stickySectionHeadersEnabled={false}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.3}
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

const IMAGE_OFFSET_Y = 10;
const getStyle = createGetStyles((colors: AppColorsVariants) =>
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
      // lineHeight: 16,
      lineHeight: 22,
    },
    length: {
      fontSize: 13,
      fontWeight: '400',
      color: colors['neutral-foot'],
      marginLeft: 4,
    },
    headerContainer: {
      paddingTop: 0,
      paddingBottom: 0,
      // ...makeDebugBorder('purple'),
    },
    titleContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'flex-start',
      alignItems: 'center',
    },
    floorPriceContainer: {
      marginTop: 6,
      flexDirection: 'row',
      justifyContent: 'flex-start',
      alignItems: 'center',
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
      marginTop: IMAGE_OFFSET_Y + 5,
      marginBottom: IMAGE_OFFSET_Y,
      height: StyleSheet.hairlineWidth,
      backgroundColor: colors['neutral-line'],
      // ...makeDebugBorder('blue'),
    },
    imagesView: {
      borderRadius: 4,
      justifyContent: 'center',
      alignItems: 'center',
      position: 'relative',
      marginTop: IMAGE_OFFSET_Y,
      marginBottom: 0,
      marginLeft: 5,
      marginRight: 5,
      // ...makeDebugBorder('blue'),
    },
    imageCountMarkView: {
      position: 'absolute',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      borderRadius: 4,
      backgroundColor: 'rgba(0, 0, 0, 0.6)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    imageCountMarkText: {
      color: '#fff',
      fontSize: 16,
      fontStyle: 'normal',
      fontWeight: '600',
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
      borderRadius: 16,
    },
    corner: {
      backgroundColor: 'rgba(0, 0, 0, 0.30)',
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
  }),
);
