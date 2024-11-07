import { DappInfo } from '@/core/services/dappService';
import { useThemeColors } from '@/hooks/theme';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { FlatList } from 'react-native-gesture-handler';
import { DappCard } from '../../components/DappCard';

export const DappCardList = ({
  data,
  onPress,
  onFavoritePress,
  ListEmptyComponent,
}: {
  data: DappInfo[];
  onPress?: (dapp: DappInfo) => void;
  onFavoritePress?: (dapp: DappInfo) => void;
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
            <DappCard
              data={item}
              onPress={onPress}
              onFavoritePress={onFavoritePress}
            />
          </View>
        );
      }}
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
