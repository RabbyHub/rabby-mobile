import { useThemeColors } from '@/hooks/theme';
import { DappInfo } from '@rabby-wallet/service-dapp';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { FlatList } from 'react-native-gesture-handler';
import { DappCard } from '../../components/DappCard';

export const FavoriteDappCardList = ({
  data,
  onPress,
}: {
  data: DappInfo[];
  onPress?: (dapp: DappInfo) => void;
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
              onFavoritePress={onPress}
              // eslint-disable-next-line react-native/no-inline-styles
              style={{
                borderColor: item.isFavorite
                  ? colors['blue-default']
                  : 'transparent',
              }}
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
