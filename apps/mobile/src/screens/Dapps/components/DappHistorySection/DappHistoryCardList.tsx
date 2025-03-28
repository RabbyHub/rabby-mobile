import { ContextMenuView } from '@/components2024/ContextMenuView/ContextMenuView';
import { DappInfo } from '@/core/services/dappService';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { stringUtils } from '@rabby-wallet/base-utils';
import { noop } from 'lodash';
import React from 'react';
import { View } from 'react-native';
import { FlatList, TouchableOpacity } from 'react-native-gesture-handler';
import { DappCardInner } from '../DappCard';

export const DappHistoryCardList = ({
  data,
  onPress,
  onFavoritePress,
  onDeletePress,
  ListEmptyComponent,
  ListHeaderComponent,
}: {
  data: DappInfo[];
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
    <FlatList
      data={data}
      style={styles.list}
      keyExtractor={item => item.origin}
      showsVerticalScrollIndicator={false}
      renderItem={({ item }) => {
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
                <DappCardInner data={item} onFavoritePress={onFavoritePress} />
              </TouchableOpacity>
            </ContextMenuView>
          </View>
        );
      }}
      ListHeaderComponent={ListHeaderComponent}
      ListEmptyComponent={ListEmptyComponent}
    />
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  list: {
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  listItem: {
    marginBottom: 12,
  },
  deleteText: {
    color: colors2024['red-default'],
  },
}));
