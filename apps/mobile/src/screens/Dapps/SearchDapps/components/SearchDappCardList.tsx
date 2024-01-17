import { useThemeColors } from '@/hooks/theme';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { FlatList } from 'react-native-gesture-handler';
import { DappCard } from '../../components/DappCard';
import { DappInfo } from '@/core/services/dappService';

export const SearchDappCardList = ({
  data,
  onPress,
  onFavoritePress,
  onEndReached,
}: {
  data: DappInfo[];
  onPress?: (dapp: DappInfo) => void;
  onFavoritePress?: (dapp: DappInfo) => void;
  onEndReached?: () => void;
}) => {
  const colors = useThemeColors();
  const styles = React.useMemo(() => getStyles(colors), [colors]);

  return (
    <FlatList
      data={data}
      style={styles.list}
      keyExtractor={item => item.origin}
      onEndReached={onEndReached}
      onEndReachedThreshold={0.8}
      renderItem={({ item }) => {
        return (
          <View style={styles.listItem}>
            <DappCard
              data={item}
              onFavoritePress={onFavoritePress}
              onPress={onPress}
            />
          </View>
        );
      }}
    />
  );
};

const getStyles = (colors: ReturnType<typeof useThemeColors>) =>
  StyleSheet.create({
    list: {
      paddingHorizontal: 20,
    },
    listHeader: {
      fontSize: 14,
      lineHeight: 17,
      color: colors['neutral-foot'],
      paddingBottom: 8,
      paddingTop: 12,
    },
    listItem: {
      marginBottom: 12,
    },
  });
