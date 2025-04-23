import RcIconRight from '@/assets/icons/dapp/icon-right.svg';
import { DappInfo } from '@/core/services/dappService';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React, { useMemo, useState } from 'react';
import {
  Keyboard,
  ScrollView,
  StyleProp,
  Text,
  useWindowDimensions,
  View,
  ViewStyle,
} from 'react-native';
import { TouchableOpacity } from 'react-native-gesture-handler';
import { BrowserBookmarkEmpty } from './BrowserBookmarkEmpty';
import { BrowserBookmarkItem } from './BrowserBookmarkItem';
import { useBrowserBookmark } from '@/hooks/browser/useBrowserBookmark';

export const BrowserBookmarkSection = ({
  onPress,
  style,
}: {
  style?: StyleProp<ViewStyle>;
  onPress?: (dapp: DappInfo) => void;
}) => {
  const { styles } = useTheme2024({ getStyle });
  const [isFold, setIsFold] = useState(true);

  const { bookmarkList: data } = useBrowserBookmark();

  const { list } = useMemo(() => {
    return {
      list: isFold ? (data || []).slice(0, 8) : data || [],
    };
  }, [data, isFold]);

  const { width } = useWindowDimensions();
  const gapStyle = useMemo(() => {
    return {
      columnGap: Math.floor((width - 48 - 56 * 4) / 3),
    };
  }, [width]);

  return (
    <ScrollView
      style={[styles.container, style]}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ flex: 1 }}
      onStartShouldSetResponder={() => {
        Keyboard.dismiss();
        return false;
      }}>
      {list?.length ? (
        <>
          <View style={styles.header}>
            <View style={styles.titleWarper}>
              <Text style={styles.title}>Favorites</Text>
            </View>
            {data?.length && data.length > 8 ? (
              <View
                onStartShouldSetResponder={event => true}
                onTouchEnd={e => {
                  e.stopPropagation();
                }}>
                <TouchableOpacity
                  hitSlop={8}
                  onPress={() => {
                    setIsFold(prev => !prev);
                  }}>
                  {isFold ? (
                    <View style={styles.headerExtra}>
                      <Text style={styles.headerExtraText}>Show All</Text>
                      <RcIconRight style={styles.arrowDown} />
                    </View>
                  ) : (
                    <View style={styles.headerExtra}>
                      <Text style={styles.headerExtraText}>Fold</Text>
                      <RcIconRight style={styles.arrowUp} />
                    </View>
                  )}
                </TouchableOpacity>
              </View>
            ) : null}
          </View>

          <View style={[styles.list, gapStyle]}>
            {list.map(item => {
              return (
                <View key={item.url || item.origin} style={styles.item}>
                  <BrowserBookmarkItem data={item} onPress={onPress} />
                </View>
              );
            })}
          </View>
        </>
      ) : (
        <BrowserBookmarkEmpty />
      )}
    </ScrollView>
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  container: {
    marginTop: 12,
    paddingHorizontal: 0,
    height: '100%',
  },
  header: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 24,
  },
  titleWarper: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginRight: 'auto',
  },
  title: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 24,
    color: colors2024['neutral-title-1'],
  },
  headerExtra: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  headerExtraText: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '500',
    fontFamily: 'SF Pro Rounded',
    color: colors2024['neutral-secondary'],
  },
  list: {
    display: 'flex',
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: 16,
    paddingHorizontal: 24,
  },
  item: {
    // width: '25%',
    width: 56,
  },
  arrowDown: {
    transform: [
      {
        rotate: '90deg',
      },
    ],
  },
  arrowUp: {
    transform: [
      {
        rotate: '-90deg',
      },
    ],
  },
}));
