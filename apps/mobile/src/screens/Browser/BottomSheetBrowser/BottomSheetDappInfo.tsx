import { AppBottomSheetModal } from '@/components/customized/BottomSheet';

import RcIconStarFull from '@/assets/icons/dapp/icon-star-full.svg';
import RcIconStar from '@/assets/icons/dapp/icon-star.svg';
import AutoLockView from '@/components/AutoLockView';
import { Text } from '@/components/Typography';
import { Button } from '@/components2024/Button';
import { CheckBoxRect } from '@/components2024/CheckBox';
import hotDappList from '@/constant/hot-dapp.json';
import { createDappBySession } from '@/core/apis/dapp';
import { openapi } from '@/core/request';
import { useBrowser } from '@/hooks/browser/useBrowser';
import { useBrowserBookmark } from '@/hooks/browser/useBrowserBookmark';
import { useTheme2024 } from '@/hooks/theme';
import { useDapps } from '@/hooks/useDapps';
import { DappIcon } from '@/screens/Dapps/components/DappIcon';
import { matomoRequestEvent } from '@/utils/analytics';
import { createGetStyles2024 } from '@/utils/styles';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { safeGetOrigin } from '@rabby-wallet/base-utils/dist/isomorphic/url';
import { useMemoizedFn, useRequest } from 'ahooks';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { Image, TouchableOpacity, View } from 'react-native';

const LIST_BY_ICON_SIZE = 12;
const LIST_BY_GAP = 4;
const LIST_BY_MIN_LABEL_GAP = 12;
const DEFAULT_VISIBLE_LIST_BY_COUNT = 3;

const hotDappMap = new Map(
  hotDappList.map(item => [item.origin, item] as const),
);

export const DappInfoPopup: React.FC<{
  url?: string;
  visible?: boolean;
  onClose: () => void;
  onOpenDapp?: (url: string) => void;
}> = ({ visible, onClose, url, onOpenDapp }) => {
  const { addBookmark, removeBookmark, getBookmark } = useBrowserBookmark();
  const [listByRowWidth, setListByRowWidth] = useState(0);
  const [listByLabelWidth, setListByLabelWidth] = useState(0);
  const [listByMoreWidth, setListByMoreWidth] = useState(0);
  const { t, i18n } = useTranslation();

  const { styles } = useTheme2024({ getStyle });

  const snapPoints = useMemo(() => {
    return [494];
  }, []);

  const modalRef = useRef<AppBottomSheetModal>(null);

  const { dapps, setDapp } = useDapps();
  const origin = useMemo(() => {
    if (!url) {
      return '';
    }

    return safeGetOrigin(url) || safeGetOrigin(`https://${url}`) || url;
  }, [url]);
  const domain = useMemo(() => {
    if (!origin) {
      return '';
    }

    return origin.replace(/^https?:\/\//, '');
  }, [origin]);
  const dapp = origin ? dapps[origin] : undefined;
  const hotDappInfo = useMemo(() => {
    if (!origin) {
      return;
    }

    return hotDappMap.get(origin);
  }, [origin]);
  const bookmark = useMemo(() => {
    if (!url && !origin) {
      return;
    }

    return getBookmark(url || origin);
  }, [getBookmark, origin, url]);

  const displayUrl = url || dapp?.url || bookmark?.url || origin;
  const displayName = hotDappInfo?.name || dapp?.name || '';

  const isSkipRemind = !!(origin && dapps[origin]?.isSkipRemind);

  const { data: level } = useRequest(
    async () => {
      if (!origin) {
        return;
      }
      const result = await openapi.getOriginPopularityLevel(origin);

      return result.level;
    },
    {
      refreshDeps: [origin],
      cacheKey: `dapp-getOriginPopularityLevel-${origin}`,
      staleTime: 60 * 1000,
    },
  );

  const { data: basicDappInfo = dapp?.info } = useRequest(
    async () => {
      if (!origin) {
        return;
      }
      const res = await openapi.getDappsInfo({
        ids: [origin.replace(/^https?:\/\//, '') || ''],
      });
      return res?.[0];
    },
    {
      refreshDeps: [origin],
      cacheKey: `dapp-getDappsInfo-${origin}`,
      staleTime: 60 * 1000,
    },
  );

  const displayDescription = useMemo(() => {
    if (!hotDappInfo) {
      return basicDappInfo?.description || dapp?.info?.description || '';
    }

    if (i18n.language === 'zh-CN') {
      return hotDappInfo.zh;
    } else {
      return hotDappInfo.en;
    }
  }, [
    basicDappInfo?.description,
    dapp?.info?.description,
    hotDappInfo,
    i18n.language,
  ]);

  const displayIcon =
    hotDappInfo?.logo ||
    basicDappInfo?.logo_url ||
    dapp?.icon ||
    dapp?.info?.logo_url ||
    bookmark?.icon;

  const category = hotDappInfo?.category;

  const collectionList = useMemo(() => {
    return basicDappInfo?.collected_list || dapp?.info?.collected_list;
  }, [basicDappInfo?.collected_list, dapp?.info?.collected_list]);

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

  const { bookmarkStore } = useBrowserBookmark();

  const isBookmark = useMemo(() => {
    if (!url) {
      return false;
    }
    return !!bookmarkStore.ids.find(
      i => safeGetOrigin(i) === safeGetOrigin(url),
    );
  }, [bookmarkStore.ids, url]);

  const handleFavoritePress = useMemoizedFn(() => {
    if (!url) {
      return;
    }
    if (isBookmark) {
      removeBookmark(url);
    } else {
      if (!dapps[origin]) {
        setDapp({
          ...createDappBySession({
            origin,
            name: displayName,
            icon: displayIcon || '',
          }),
          isDapp: true,
        });
      }
      addBookmark({
        url,
        name: displayName || origin,
        createdAt: Date.now(),
      });
      matomoRequestEvent({
        category: 'Websites Usage',
        action: 'Website_Favorite',
        label: origin,
      });
    }
  });

  const handleToggleSkipRemind = useMemoizedFn(() => {
    if (!origin) {
      return;
    }

    if (!dapps[origin]) {
      setDapp({
        ...createDappBySession({
          origin,
          name: displayName || '',
          icon: displayIcon || '',
        }),
        origin,
        isDapp: true,
        isSkipRemind: !isSkipRemind,
      });
    } else {
      setDapp({
        ...dapps[origin],
        origin,
        isSkipRemind: !isSkipRemind,
      });
    }
  });

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
        {origin ? (
          <BottomSheetScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollViewContent}>
            <View style={styles.dappCard}>
              <DappIcon
                source={
                  displayIcon
                    ? {
                        uri: displayIcon,
                      }
                    : undefined
                }
                origin={origin}
                style={styles.dappIcon}
              />
              <View style={styles.dappContent}>
                <View style={styles.dappContentHeader}>
                  <Text style={[styles.dappTitle]} numberOfLines={1}>
                    {displayName || domain}
                  </Text>
                  <TouchableOpacity
                    style={styles.favoriteButton}
                    hitSlop={8}
                    onPress={handleFavoritePress}>
                    {isBookmark ? (
                      <RcIconStarFull width={20} height={20} />
                    ) : (
                      <RcIconStar width={20} height={20} />
                    )}
                  </TouchableOpacity>
                </View>
                <Text style={styles.dappOrigin} numberOfLines={1}>
                  {origin}
                </Text>
              </View>
            </View>
            {displayDescription ? (
              <Text style={styles.dappDesc} numberOfLines={3}>
                {displayDescription}
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
                ) : (
                  <Text style={styles.emptyText}>-</Text>
                )}
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
                ) : (
                  <Text style={styles.emptyText}>-</Text>
                )}
              </View>
              <View style={styles.listItem}>
                <Text style={styles.listLabel}>Category</Text>
                {category ? (
                  <View style={styles.tag}>
                    <Text style={styles.tagText}>{category}</Text>
                  </View>
                ) : (
                  <Text style={styles.emptyText}>-</Text>
                )}
              </View>
            </View>
            <View style={styles.footer}>
              <View style={styles.checkBoxContainer}>
                <TouchableOpacity onPress={handleToggleSkipRemind}>
                  <View style={styles.checkBoxContent}>
                    <CheckBoxRect checked={isSkipRemind} size={18} />
                    <Text style={styles.checkBoxText}>
                      Skip this page next time
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>
              <Button
                type="primary"
                onPress={() => {
                  onOpenDapp?.(displayUrl || origin);
                }}
                title={'Open'}
              />
            </View>
          </BottomSheetScrollView>
        ) : null}
      </AutoLockView>
    </AppBottomSheetModal>
  );
};

export const BottomSheetDappInfoPopup: React.FC = () => {
  const { browserState, setPartialBrowserState, openTab } = useBrowser();
  return (
    <DappInfoPopup
      visible={browserState.isShowDappInfo}
      url={browserState.dappInfoUrl}
      onClose={() => {
        setPartialBrowserState({
          isShowDappInfo: false,
          dappInfoUrl: '',
        });
      }}
      onOpenDapp={(url: string) => {
        openTab(url, {
          isDapp: true,
        });
        setPartialBrowserState({
          isShowDappInfo: false,
          dappInfoUrl: '',
        });
      }}
    />
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
      paddingBottom: 48,
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
    favoriteButton: {},
    openButtonTitle: {
      paddingHorizontal: 8,
      textAlign: 'center',
      width: '100%',
      fontFamily: 'SF Pro Rounded',
      fontWeight: '700',
      fontSize: 17,
      lineHeight: 22,
      color: colors2024['neutral-InvertHighlight'],
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
    emptyText: {
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
