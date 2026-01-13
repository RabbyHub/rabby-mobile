import React, { useMemo, useState } from 'react';
import { FlatListProps, Text, TouchableOpacity, View } from 'react-native';

import { DappInfo } from '@/core/services/dappService';
import { useBrowserBookmark } from '@/hooks/browser/useBrowserBookmark';
import { useTheme2024 } from '@/hooks/theme';
import { BrowserSiteCardList } from '@/screens/Browser/components/BrowserSiteCardList';
import { createGetStyles2024 } from '@/utils/styles';
import { useTranslation } from 'react-i18next';
import { NativeGesture } from 'react-native-gesture-handler';
import { DappFavoriteSectionEmpty } from '@/screens/Dapps/components/DappFavoriteSection/DappFavoriteSectionEmpty';

export function BrowserFavorite({
  onPress,
  isInBottomSheet,
  scrollableGesture,
  onScroll,
}: {
  onPress?(dapp: DappInfo): void;
  isInBottomSheet?: boolean;
  scrollableGesture?: NativeGesture;
  onScroll?: FlatListProps<DappInfo>['onScroll'];
}) {
  const { styles } = useTheme2024({
    getStyle,
  });
  const { bookmarkList, removeBookmark } = useBrowserBookmark();

  const [isEditing, setIsEditing] = React.useState(false);

  const [removedItems, setRemovedItems] = useState<string[]>([]);

  const list = useMemo(() => {
    return bookmarkList.filter(item => !removedItems.includes(item.origin));
  }, [bookmarkList, removedItems]);

  const { t } = useTranslation();

  const startEditing = () => {
    setIsEditing(true);
    setRemovedItems([]);
  };

  const completeEditing = () => {
    setIsEditing(false);
    removedItems.forEach(url => {
      removeBookmark(url);
    });
  };

  const handleRemoveLocal = (url: string) => {
    setRemovedItems(prev => [...prev, url]);
  };

  const handle = () => {
    if (isEditing) {
      completeEditing();
    } else {
      startEditing();
    }
  };

  return (
    <View style={styles.container}>
      <BrowserSiteCardList
        scrollableGesture={scrollableGesture}
        ListHeaderComponent={
          list?.length ? (
            <View style={styles.header}>
              <Text style={styles.title}>
                {t('page.browser.BrowserSearch.favorite')}
              </Text>
              <TouchableOpacity onPress={handle}>
                <Text style={styles.edit}>
                  {isEditing ? t('global.Done') : t('global.Edit')}
                </Text>
              </TouchableOpacity>
            </View>
          ) : null
        }
        isInBottomSheet={isInBottomSheet}
        data={list}
        onPress={isEditing ? undefined : onPress}
        style={styles.list}
        isShowDelete={isEditing}
        onDeletePress={dapp => handleRemoveLocal(dapp.origin)}
        onScroll={onScroll}
        ListEmptyComponent={DappFavoriteSectionEmpty}
      />

      {/* <View style={styles.grid}>
        {bookmarkList?.map(item => {
          if (removedItems.includes(item.origin)) {
            return null;
          }
          return (
            <View key={item.origin} style={styles.itemWrapper}>
              {isEditing ? (
                <TouchableOpacity
                  onPress={() => handleRemoveLocal(item.origin)}>
                  <RcIconDelete />
                </TouchableOpacity>
              ) : null}
              <BrowserSiteCard
                data={item}
                onPress={isEditing ? undefined : onPress}
                key={item.origin}
                containerStyle={{ width: '100%' }}
              />
            </View>
          );
        })}
      </View> */}
    </View>
  );
}
const getStyle = createGetStyles2024(({ colors2024, isLight }) => ({
  container: {
    flex: 1,
  },
  list: {
    paddingHorizontal: 20,
  },
  header: {
    paddingHorizontal: 8,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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

  itemWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
}));
