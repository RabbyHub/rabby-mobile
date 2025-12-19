import React, { useMemo } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

import RcIconDelete from '@/assets2024/icons/browser/delete.svg';
import { DappInfo } from '@/core/services/dappService';
import { useBrowserBookmark } from '@/hooks/browser/useBrowserBookmark';
import { useTheme2024 } from '@/hooks/theme';
import { DappIcon } from '@/screens/Dapps/components/DappIcon';
import { createGetStyles2024 } from '@/utils/styles';
import { useTranslation } from 'react-i18next';

const MAX_COUNT = 8;

export function BrowserFavoriteInHome({
  onMorePress,
  onPress,
  isEditing,
  setIsEditing,
}: {
  onPress?(dapp: DappInfo): void;
  isInBottomSheet?: boolean;
  onMorePress?(): void;
  isEditing?: boolean;
  setIsEditing?(isEditing: boolean): void;
}) {
  const { bookmarkList, removeBookmark } = useBrowserBookmark();
  const { colors2024, styles, isLight } = useTheme2024({
    getStyle,
  });

  const { t } = useTranslation();

  const { filteredList, hasMore, moreCount } = useMemo(() => {
    if (bookmarkList.length > MAX_COUNT) {
      return {
        filteredList: bookmarkList.slice(0, MAX_COUNT - 1),
        hasMore: true,
        moreCount: bookmarkList.length - (MAX_COUNT - 1),
      };
    }
    return {
      filteredList: bookmarkList,
      hasMore: false,
      moreCount: 0,
    };
  }, [bookmarkList]);

  if (!bookmarkList?.length) {
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={styles.grid}>
        {filteredList.map(data => (
          <TouchableOpacity
            onPress={() => {
              onPress?.(data);
            }}
            delayLongPress={200}
            onLongPress={() => {
              setIsEditing?.(true);
            }}
            key={data.url || data.origin}
            style={styles.gridItem}>
            <View style={styles.dappIconContainer}>
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
              {isEditing ? (
                <View
                  onTouchStart={e => {
                    e.stopPropagation();
                  }}>
                  <TouchableOpacity
                    style={styles.deleteBtn}
                    onPress={() => {
                      removeBookmark(data.origin);
                    }}>
                    <RcIconDelete width={16} height={16} />
                  </TouchableOpacity>
                </View>
              ) : null}
            </View>
            <Text style={styles.dappName} numberOfLines={1}>
              {data.info?.name || data?.name}
            </Text>
          </TouchableOpacity>
        ))}

        {hasMore ? (
          <TouchableOpacity
            onPress={() => {
              onMorePress?.();
            }}
            style={[styles.gridItem]}>
            <View style={[styles.dappIcon, styles.more]}>
              <Text style={styles.moreCount} numberOfLines={1}>
                +{moreCount}
              </Text>
            </View>
            <Text style={styles.dappName} numberOfLines={1}>
              {t('page.browser.BrowserFavoriteInHome.more')}
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}
const getStyle = createGetStyles2024(({ colors2024 }) => ({
  container: {
    marginBottom: 24,
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
    flexWrap: 'wrap',
    rowGap: 24,
    width: '100%',
  },
  gridItem: {
    gap: 6,
    justifyContent: 'center',
    alignItems: 'center',
    width: '25%',
  },
  dappIconContainer: {
    position: 'relative',
  },
  dappIcon: {
    height: 56,
    width: 56,
    borderRadius: 16,
    borderCurve: 'continuous',
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
  more: {
    backgroundColor: colors2024['neutral-bg-5'],
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 16,
  },
  moreCount: {
    color: colors2024['neutral-title-1'],
    textAlign: 'center',
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    fontStyle: 'normal',
    fontWeight: '500',
    lineHeight: 20,
  },

  deleteBtn: {
    borderWidth: 2,
    borderColor: colors2024['neutral-bg-1'],
    borderRadius: 1000,
    position: 'absolute',
    bottom: -2,
    right: -2,
  },
}));
