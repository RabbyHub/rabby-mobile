import { DappInfo } from '@/core/services/dappService';
import { useThemeColors } from '@/hooks/theme';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { FlatList } from 'react-native-gesture-handler';
import { DappCard } from './DappCard';
import { DropdownMenuView } from '@/components/WebView/DappWebViewControl2/DropdownMenuView';

export const DappCardList = ({
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
            <DropdownMenuView
              menuConfig={{
                iosMenuTitle: item.origin,
                menuActions: [
                  {
                    title: 'Favorite',
                    iosIconSource: require('@/assets/icons/ios_ic_rabby_icons/ic_rabby_menu_favorite.png'),
                    androidIconName: 'ic_rabby_menu_favorite_filled',
                    key: 'favorite',
                    onSelect: () => {
                      console.debug('Favorite clicked');
                      // onPressButtonInternal({ type: 'favorite' });
                    },
                  },
                ],
              }}>
              <DappCard
                data={item}
                onPress={onPress}
                onFavoritePress={onFavoritePress}
              />
            </DropdownMenuView>
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
