import { DappInfo } from '@/core/services/dappService';
import { useThemeColors } from '@/hooks/theme';
import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { FlatList } from 'react-native-gesture-handler';
import { ContextMenuView } from '@/components2024/ContextMenuView/ContextMenuView';
import { DappCardInner } from '../DappCard';
import { noop } from 'lodash';

export const DappHistoryCardList = ({
  data,
  onPress,
  onFavoritePress,
  ListEmptyComponent,
  ListHeaderComponent,
}: {
  data: DappInfo[];
  onPress?: (dapp: DappInfo) => void;
  onFavoritePress?: (dapp: DappInfo) => void;
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
  const colors = useThemeColors();
  const styles = React.useMemo(() => getStyles(colors), [colors]);

  return (
    <FlatList
      data={data}
      style={styles.list}
      keyExtractor={item => item.origin}
      renderItem={({ item }) => {
        return (
          <View style={styles.listItem}>
            <TouchableOpacity
              onPress={() => {
                onPress?.(item);
              }}
              onLongPress={noop}>
              <ContextMenuView
                menuConfig={{
                  menuTitle: item.origin,
                  menuActions: [
                    {
                      title: 'Delete',
                      icon: require('@/assets/icons/ios_ic_rabby_icons/ic_rabby_menu_favorite.png'),
                      androidIconName: 'ic_rabby_menu_favorite_filled',
                      key: 'favorite',
                      action: () => {
                        console.debug('Favorite clicked');
                        // onPressButtonInternal({ type: 'favorite' });
                      },
                    },
                  ],
                }}>
                <DappCardInner data={item} onFavoritePress={onFavoritePress} />
              </ContextMenuView>
            </TouchableOpacity>
          </View>
        );
      }}
      ListHeaderComponent={ListHeaderComponent}
      ListEmptyComponent={ListEmptyComponent}
    />
  );
};

const getStyles = (colors: ReturnType<typeof useThemeColors>) =>
  StyleSheet.create({
    list: {
      marginBottom: 20,
      paddingHorizontal: 20,
    },
    listItem: {
      marginBottom: 12,
    },
  });
