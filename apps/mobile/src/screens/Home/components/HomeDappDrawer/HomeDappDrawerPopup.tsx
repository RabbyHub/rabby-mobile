import { AppBottomSheetModal } from '@/components/customized/BottomSheet';

import AutoLockView from '@/components/AutoLockView';
import RcIconStar from '@/assets/icons/dapp/icon-star.svg';
import RcIconStarFull from '@/assets/icons/dapp/icon-star-full.svg';
import { useBrowserBookmark } from '@/hooks/browser/useBrowserBookmark';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { View, Image, TouchableOpacity } from 'react-native';
import { DappInfo } from '@/core/services/dappService';
import { Text } from '@/components/Typography';
import { DappIcon } from '@/screens/Dapps/components/DappIcon';
import { Button } from '@/components2024/Button';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { CheckBoxRect } from '@/components2024/CheckBox';
import { useRequest } from 'ahooks';
import { openapi } from '@/core/request';
import hotDappList from '@/constant/hot-dapp.json';
import { uniq } from 'lodash';
import { dappService } from '@/core/services';
import { useDapps } from '@/hooks/useDapps';

const LIST_BY_ICON_SIZE = 12;
const LIST_BY_GAP = 4;
const LIST_BY_MIN_LABEL_GAP = 12;
const DEFAULT_VISIBLE_LIST_BY_COUNT = 3;

const categories = uniq(hotDappList.map(item => item.category));

export const DappInfoPopup: React.FC<{
  dappInfo?: DappInfo;
  visible: boolean;
  onClose: () => void;
  onOpenDapp?: (url: string) => void;
}> = ({ visible, onClose, dappInfo, onOpenDapp }) => {
  const { addBookmark, removeBookmark, getBookmark } = useBrowserBookmark();
  const [listByRowWidth, setListByRowWidth] = useState(0);
  const [listByLabelWidth, setListByLabelWidth] = useState(0);
  const [listByMoreWidth, setListByMoreWidth] = useState(0);

  const { styles } = useTheme2024({ getStyle });

  const snapPoints = useMemo(() => {
    return [494];
  }, []);

  const modalRef = useRef<AppBottomSheetModal>(null);

  const { dapps } = useDapps();
  const bookmarkKey = dappInfo?.url || dappInfo?.origin;
  const isFavorite = !!(bookmarkKey && getBookmark(bookmarkKey));
  const isSkipRemind = !!(
    dappInfo?.origin && dapps[dappInfo.origin]?.isSkipRemind
  );

  const { data: level } = useRequest(
    async () => {
      if (!dappInfo?.origin) {
        return;
      }
      const result = await openapi.getOriginPopularityLevel(dappInfo.origin);

      return result.level;
    },
    {
      refreshDeps: [dappInfo?.origin],
      cacheKey: `dapp-getOriginPopularityLevel-${dappInfo?.origin}`,
      staleTime: 10 * 1000,
    },
  );

  const { data: basicDappInfo = dappInfo?.info } = useRequest(
    async () => {
      if (!dappInfo?.origin) {
        return;
      }
      const res = await openapi.getDappsInfo({
        ids: [dappInfo?.origin.replace(/^https?:\/\//, '') || ''],
      });
      return res?.[0];
    },
    {
      refreshDeps: [dappInfo?.origin],
      cacheKey: `dapp-getDappsInfo-${dappInfo?.origin}`,
      staleTime: 10 * 1000,
    },
  );

  const category = useMemo(() => {
    return dappInfo?.info?.tags?.find(tag => categories.includes(tag));
  }, [dappInfo?.info?.tags]);

  const collectionList = useMemo(() => {
    return basicDappInfo?.collected_list || dappInfo?.info?.collected_list;
  }, [basicDappInfo?.collected_list, dappInfo?.info?.collected_list]);

  const listByAvailableWidth = useMemo(() => {
    if (!listByRowWidth || !listByLabelWidth) {
      return 0;
    }

    return Math.max(
      0,
      listByRowWidth - listByLabelWidth - LIST_BY_MIN_LABEL_GAP,
    );
  }, [listByLabelWidth, listByRowWidth]);

  const listByVisibleCount = useMemo(() => {
    const totalCount = collectionList?.length || 0;

    if (!totalCount) {
      return 0;
    }

    if (!listByAvailableWidth) {
      return Math.min(totalCount, DEFAULT_VISIBLE_LIST_BY_COUNT);
    }

    const maxVisibleCount = Math.min(
      totalCount,
      Math.floor(
        (listByAvailableWidth + LIST_BY_GAP) /
          (LIST_BY_ICON_SIZE + LIST_BY_GAP),
      ),
    );

    if (maxVisibleCount >= totalCount) {
      return totalCount;
    }

    for (
      let visibleCount = maxVisibleCount;
      visibleCount >= 0;
      visibleCount -= 1
    ) {
      const hiddenCount = totalCount - visibleCount;
      const extraMoreWidth = hiddenCount
        ? listByMoreWidth || `${hiddenCount}`.length * 8 + 10
        : 0;
      const iconsWidth = visibleCount
        ? visibleCount * LIST_BY_ICON_SIZE + (visibleCount - 1) * LIST_BY_GAP
        : 0;
      const totalWidth =
        iconsWidth +
        (hiddenCount && visibleCount ? LIST_BY_GAP : 0) +
        extraMoreWidth;

      if (totalWidth <= listByAvailableWidth) {
        return visibleCount;
      }
    }

    return 0;
  }, [collectionList, listByAvailableWidth, listByMoreWidth]);

  const hiddenListByCount = Math.max(
    0,
    (collectionList?.length || 0) - listByVisibleCount,
  );

  const visibleCollectionList = useMemo(() => {
    return collectionList?.slice(0, listByVisibleCount) || [];
  }, [collectionList, listByVisibleCount]);

  const setRoundedWidth = useCallback(
    (
      setter: React.Dispatch<React.SetStateAction<number>>,
      nextWidth: number,
    ) => {
      const roundedWidth = Math.ceil(nextWidth);

      setter(prevWidth =>
        prevWidth === roundedWidth ? prevWidth : roundedWidth,
      );
    },
    [],
  );

  const handleFavoritePress = useCallback(() => {
    if (!bookmarkKey || !dappInfo) {
      return;
    }

    if (getBookmark(bookmarkKey)) {
      removeBookmark(bookmarkKey);
      return;
    }

    addBookmark({
      url: bookmarkKey,
      name: dappInfo.info?.name || dappInfo.name,
      icon: dappInfo.icon,
      createdAt: Date.now(),
    });
  }, [addBookmark, bookmarkKey, dappInfo, getBookmark, removeBookmark]);

  useEffect(() => {
    if (visible) {
      modalRef.current?.present();
    } else {
      modalRef.current?.close();
    }
  }, [visible]);

  return (
    <AppBottomSheetModal
      index={visible ? 0 : -1}
      enableHandlePanningGesture
      enableContentPanningGesture={true}
      enablePanDownToClose
      handleStyle={styles.handleStyle}
      handleIndicatorStyle={styles.handleIndicatorStyle}
      style={styles.popupStyle}
      ref={modalRef}
      keyboardBehavior="extend"
      snapPoints={snapPoints}
      onChange={index => {
        if (index === -1) {
          onClose();
        }
      }}>
      <AutoLockView as="View" style={styles.content}>
        {dappInfo ? (
          <BottomSheetScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollViewContent}>
            <View style={styles.dappCard}>
              <DappIcon
                source={
                  dappInfo?.icon
                    ? {
                        uri: dappInfo.icon,
                      }
                    : undefined
                }
                origin={dappInfo.origin}
                style={styles.dappIcon}
              />
              <View style={styles.dappContent}>
                <View style={styles.dappContentHeader}>
                  <Text style={[styles.dappTitle]} numberOfLines={1}>
                    {dappInfo?.info?.name ||
                      dappInfo.name ||
                      dappInfo.origin.split('://')[1] ||
                      dappInfo.origin}
                  </Text>
                  <TouchableOpacity
                    style={styles.favoriteButton}
                    hitSlop={8}
                    onPress={handleFavoritePress}>
                    {isFavorite ? <RcIconStarFull /> : <RcIconStar />}
                  </TouchableOpacity>
                </View>
                <Text style={styles.dappOrigin} numberOfLines={1}>
                  {dappInfo.origin}
                </Text>
              </View>
            </View>
            {dappInfo.info?.description ? (
              <Text style={styles.dappDesc} numberOfLines={3}>
                {dappInfo.info?.description}
              </Text>
            ) : null}
            <View style={styles.divider} />
            <View style={styles.list}>
              <View
                style={styles.listItem}
                onLayout={event => {
                  setRoundedWidth(
                    setListByRowWidth,
                    event.nativeEvent.layout.width,
                  );
                }}>
                <Text
                  style={styles.listLabel}
                  onLayout={event => {
                    setRoundedWidth(
                      setListByLabelWidth,
                      event.nativeEvent.layout.width,
                    );
                  }}>
                  Listed by
                </Text>
                {collectionList?.length ? (
                  <View
                    style={[
                      styles.listBy,
                      listByAvailableWidth
                        ? { maxWidth: listByAvailableWidth }
                        : null,
                    ]}>
                    {visibleCollectionList.map((item, index) => (
                      <Image
                        key={index}
                        source={{
                          uri: item.logo_url,
                        }}
                        style={styles.listByIcon as any}
                      />
                    ))}
                    {hiddenListByCount ? (
                      <Text
                        style={styles.listByMore}
                        onLayout={event => {
                          setRoundedWidth(
                            setListByMoreWidth,
                            event.nativeEvent.layout.width,
                          );
                        }}>
                        +{hiddenListByCount}
                      </Text>
                    ) : null}
                  </View>
                ) : null}
              </View>
              <View style={styles.listItem}>
                <Text style={styles.listLabel}>Site popularity</Text>

                {level === 'high' ? (
                  <View style={[styles.tag, styles.tagHigh]}>
                    <Text style={[styles.tagText, styles.tagTextHigh]}>
                      High
                    </Text>
                  </View>
                ) : level === 'medium' ? (
                  <View style={[styles.tag, styles.tagMedium]}>
                    <Text style={[styles.tagText, styles.tagTextMedium]}>
                      Medium
                    </Text>
                  </View>
                ) : level === 'low' ? (
                  <View style={[styles.tag, styles.tagMedium]}>
                    <Text style={[styles.tagText, styles.tagTextMedium]}>
                      Low
                    </Text>
                  </View>
                ) : level === 'very_low' ? (
                  <View style={[styles.tag, styles.tagMedium]}>
                    <Text style={[styles.tagText, styles.tagTextMedium]}>
                      Very Low
                    </Text>
                  </View>
                ) : null}
              </View>
              <View style={styles.listItem}>
                <Text style={styles.listLabel}>Category</Text>
                <View style={styles.tag}>
                  <Text style={styles.tagText}>{category}</Text>
                </View>
              </View>
            </View>
            <View style={styles.footer}>
              <View style={styles.checkBoxContainer}>
                <TouchableOpacity
                  onPress={() => {
                    if (!dappInfo) {
                      return;
                    }

                    dappService.patchDapps({
                      [dappInfo.origin]: {
                        isSkipRemind: !isSkipRemind,
                      },
                    });
                  }}>
                  <View style={styles.checkBoxContent}>
                    <CheckBoxRect checked={isSkipRemind} />
                    <Text style={styles.checkBoxText}>
                      Skip this page next time
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>
              <Button
                type="primary"
                onPress={() => {
                  onOpenDapp?.(dappInfo?.url || dappInfo?.origin);
                }}
                title={`Open ${dappInfo.info?.name || dappInfo.origin}`}
                titleStyle={styles.openButtonTitle}
              />
            </View>
          </BottomSheetScrollView>
        ) : null}
      </AutoLockView>
    </AppBottomSheetModal>
  );
};

const getStyle = createGetStyles2024(({ colors2024, isLight: _isLight }) => {
  return {
    popupStyle: {
      borderRadius: 32,
      overflow: 'hidden',
    },
    handleStyle: {
      // backgroundColor: isLight
      //   ? colors2024['neutral-bg-0']
      //   : colors2024['neutral-bg-1'],
      backgroundColor: colors2024['neutral-bg-1'],
      borderTopLeftRadius: 32,
      borderTopRightRadius: 32,
    },
    handleIndicatorStyle: {
      backgroundColor: colors2024['neutral-bg-5'],
      height: 6,
      width: 50,
    },

    content: {
      flex: 1,
      backgroundColor: colors2024['neutral-bg-1'],
      paddingHorizontal: 24,
      paddingTop: 24,
      // backgroundColor: isLight
      //   ? colors2024['neutral-bg-0']
      //   : colors2024['neutral-bg-1'],
    },
    scrollView: {
      height: '100%',
      paddingBottom: 56,
      display: 'flex',
      flexDirection: 'column',
    },
    scrollViewContent: {
      flexGrow: 1,
    },

    dappCard: {
      display: 'flex',
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      position: 'relative',
      gap: 8,
    },
    dappIcon: {
      width: 46,
      height: 46,
      borderRadius: 12,
      borderCurve: 'continuous',
    },
    dappTitle: {
      fontFamily: 'SF Pro Rounded',
      fontWeight: '700',
      fontSize: 16,
      lineHeight: 20,
      color: colors2024['neutral-title-1'],
      flex: 1,
    },
    dappContentHeader: {
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    dappContent: {
      minWidth: 0,
      flex: 1,
    },
    favoriteButton: {
      padding: 4,
      marginRight: -4,
    },
    openButtonTitle: {
      paddingHorizontal: 8,
    },
    dappOrigin: {
      marginTop: 4,
      fontFamily: 'SF Pro Rounded',
      fontWeight: '500',
      fontSize: 14,
      lineHeight: 18,
      color: colors2024['neutral-secondary'],
    },

    dappDesc: {
      marginTop: 12,
      fontFamily: 'SF Pro Rounded',
      fontWeight: '500',
      fontSize: 14,
      lineHeight: 20,
      color: colors2024['neutral-secondary'],
    },

    divider: {
      marginVertical: 12,
      height: 1,
      backgroundColor: colors2024['neutral-bg-5'],
    },

    list: { flex: 1 },

    listItem: {
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 10,
    },
    listLabel: {
      fontFamily: 'SF Pro Rounded',
      fontWeight: '500',
      fontSize: 14,
      lineHeight: 18,
      color: colors2024['neutral-secondary'],
    },
    listBy: {
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
      flexShrink: 1,
      gap: 4,
    },
    listByIcon: {
      width: 12,
      height: 12,
      borderRadius: 1000,
    },
    listByMore: {
      fontFamily: 'SF Pro Rounded',
      fontWeight: '500',
      fontSize: 14,
      lineHeight: 18,
      color: colors2024['neutral-secondary'],
    },
    sitePopularity: {
      fontFamily: 'SF Pro Rounded',
      fontWeight: '700',
      fontSize: 16,
      lineHeight: 20,
      color: colors2024['neutral-title-1'],
    },
    tag: {
      backgroundColor: colors2024['neutral-bg-5'],
      paddingHorizontal: 4,
      paddingVertical: 1,
      borderRadius: 4,
      minWidth: 38,
    },
    tagText: {
      fontFamily: 'SF Pro Rounded',
      fontWeight: '500',
      fontSize: 12,
      lineHeight: 16,
      color: colors2024['neutral-secondary'],
      textAlign: 'center',
    },

    tagHigh: {
      backgroundColor: colors2024['green-light-1'],
    },
    tagTextHigh: {
      fontFamily: 'SF Pro Rounded',
      color: colors2024['green-default'],
    },

    tagMedium: {
      backgroundColor: colors2024['orange-light-1'],
    },
    tagTextMedium: {
      fontFamily: 'SF Pro Rounded',
      color: colors2024['orange-default'],
    },
    // tagLow: {
    //   backgroundColor: colors2024['green-light-1'],
    // },
    // tagTextLow: {
    //   fontFamily: 'SF Pro Rounded',
    //   color: colors2024['green-default'],
    // },
    // tagVeryLow: {
    //   backgroundColor: colors2024['green-light-1'],
    // },
    // tagTextVeryLow: {
    //   fontFamily: 'SF Pro Rounded',
    //   color: colors2024['green-default'],
    // },

    footer: {
      marginTop: 'auto',
    },

    checkBoxContainer: {
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 16,
    },
    checkBoxContent: {
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    checkBoxText: {
      fontFamily: 'SF Pro Rounded',
      fontWeight: '500',
      fontSize: 12,
      lineHeight: 16,
      color: colors2024['neutral-secondary'],
    },
  };
});
