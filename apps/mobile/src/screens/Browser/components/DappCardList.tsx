import { DappInfo } from '@/core/services/dappService';
import { useThemeColors } from '@/hooks/theme';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { FlatList } from 'react-native-gesture-handler';
import { DappCard } from './DappCard';

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
      showsVerticalScrollIndicator={false}
      renderItem={({ item }) => {
        return (
          <View style={styles.listItem}>
            <DappCard
              data={item}
              onPress={onPress}
              onFavoritePress={onFavoritePress}
            />
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
      paddingHorizontal: 16,
    },
    listItem: {
      marginBottom: 12,
    },
  });
