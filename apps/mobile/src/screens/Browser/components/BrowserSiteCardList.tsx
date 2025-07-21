import { DappInfo } from '@/core/services/dappService';
import { useThemeColors } from '@/hooks/theme';
import React from 'react';
import { FlatListProps, StyleSheet, Text, View } from 'react-native';
import { FlatList } from 'react-native-gesture-handler';
import { BrowserSiteCard } from './BrowserSiteCard';

export const BrowserSiteCardList = ({
  data,
  onPress,
  onFavoritePress,
  ListEmptyComponent,
  ListHeaderComponent,
  style,
  isShowDelete,
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
  style?: FlatListProps<DappInfo>['style'];
  isShowDelete?: boolean;
}) => {
  const colors = useThemeColors();
  const styles = React.useMemo(() => getStyles(colors), [colors]);

  return (
    <FlatList
      data={data}
      style={[styles.list, style]}
      keyExtractor={item => item.url || item.origin}
      showsVerticalScrollIndicator={false}
      renderItem={({ item }) => {
        return (
          <View style={styles.listItem}>
            {isShowDelete ? <Text>删除</Text> : null}
            <View
              style={{
                width: '100%',
              }}>
              <BrowserSiteCard
                data={item}
                onPress={onPress}
                onFavoritePress={onFavoritePress}
              />
            </View>
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
    },
    listItem: {
      marginBottom: 12,
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 16,
    },
  });
