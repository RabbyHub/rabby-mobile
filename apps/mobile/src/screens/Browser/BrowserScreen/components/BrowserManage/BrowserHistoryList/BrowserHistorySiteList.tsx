import { ContextMenuView } from '@/components2024/ContextMenuView/ContextMenuView';
import { DappInfo } from '@/core/services/dappService';
import { useTheme2024 } from '@/hooks/theme';
import { BrowserSiteCardInner } from '@/screens/Browser/components/BrowserSiteCard';
import { createGetStyles2024 } from '@/utils/styles';
import { BottomSheetSectionList } from '@gorhom/bottom-sheet';
import { stringUtils } from '@rabby-wallet/base-utils';
import { noop } from 'lodash';
import React from 'react';
import { SectionList, Text, View } from 'react-native';
import { FlatList, TouchableOpacity } from 'react-native-gesture-handler';

export const BrowserHistorySiteItem = ({
  item,
  onDeletePress,
  onFavoritePress,
  onPress,
}: {
  item: DappInfo;
  onDeletePress?: (item: DappInfo) => void;
  onFavoritePress?: (item: DappInfo) => void;
  onPress?: (item: DappInfo) => void;
}) => {
  const { styles } = useTheme2024({
    getStyle,
  });

  return (
    <View style={styles.listItem}>
      <ContextMenuView
        triggerProps={{ action: 'longPress' }}
        preViewBorderRadius={20}
        menuConfig={{
          menuTitle: stringUtils.unPrefix(item.origin, 'https://'),
          menuActions: [
            {
              title: 'Delete',
              icon: require('@/assets/icons/ios_ic_rabby_icons/ic_rabby_menu_delete.png'),
              androidIconName: 'ic_rabby_menu_delete',
              key: 'delete',
              action: () => {
                onDeletePress?.(item);
              },
            },
          ],
        }}>
        <TouchableOpacity
          onPress={() => {
            onPress?.(item);
          }}
          delayLongPress={100}
          onLongPress={noop}>
          <BrowserSiteCardInner data={item} onFavoritePress={onFavoritePress} />
        </TouchableOpacity>
      </ContextMenuView>
    </View>
  );
};

export const BrowserHistorySiteList = ({
  data,
  onPress,
  onFavoritePress,
  onDeletePress,
  ListEmptyComponent,
  ListHeaderComponent,
}: {
  data: {
    title: string;
    data: DappInfo[];
  }[];
  onPress?: (dapp: DappInfo) => void;
  onFavoritePress?: (dapp: DappInfo) => void;
  onDeletePress?: (dapp: DappInfo) => void;
  ListHeaderComponent?:
    | React.ComponentType<any>
    | React.ReactElement<any, string | React.JSXElementConstructor<any>>
    | null
    | undefined;
  ListEmptyComponent?:
    | React.ComponentType<any>
    | React.ReactElement<any, string | React.JSXElementConstructor<any>>
    | null
    | undefined;
}) => {
  const { styles } = useTheme2024({
    getStyle,
  });

  return (
    <BottomSheetSectionList
      sections={data}
      style={styles.list}
      showsVerticalScrollIndicator={false}
      stickySectionHeadersEnabled={false}
      renderItem={({ item }) => (
        <BrowserHistorySiteItem
          item={item}
          onDeletePress={onDeletePress}
          onFavoritePress={onFavoritePress}
          onPress={onPress}
        />
      )}
      renderSectionHeader={({ section: { title } }) => (
        <Text style={styles.sectionTitle}>{title}</Text>
      )}
      contentContainerStyle={
        data?.length
          ? null
          : {
              flexGrow: 1,
              justifyContent: 'center',
            }
      }
      ListHeaderComponent={ListHeaderComponent}
      ListEmptyComponent={ListEmptyComponent}
    />
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  list: {
    // marginBottom: 20,
    paddingHorizontal: 20,
  },
  listItem: {
    marginBottom: 12,
  },
  deleteText: {
    color: colors2024['red-default'],
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 20,
    fontFamily: 'SF Pro Rounded',
    color: colors2024['neutral-secondary'],
    paddingHorizontal: 8,
    marginBottom: 12,
  },
}));
