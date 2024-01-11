import { useThemeColors } from '@/hooks/theme';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { FlatList } from 'react-native-gesture-handler';
import { DappCard } from '../../components/DappCard';
import { DappInfo } from '@rabby-wallet/service-dapp';
import { createGlobalBottomSheetModal } from '@/components/GlobalBottomSheetModal/utils';
import { MODAL_NAMES } from '@/components/GlobalBottomSheetModal/types';

export const SearchDappCardList = ({
  data,
  onPress,
  onFavoritePress,
  onEndReached,
  total,
}: {
  data: DappInfo[];
  onPress?: (dapp: DappInfo) => void;
  onFavoritePress?: (dapp: DappInfo) => void;
  onEndReached?: () => void;
  total?: number;
}) => {
  const colors = useThemeColors();
  const styles = React.useMemo(() => getStyles(colors), [colors]);

  return (
    <>
      <FlatList
        ListHeaderComponent={
          <View style={styles.listHeader}>
            <Text style={styles.listHeaderText}>
              Found about {total ?? '-'} results.
            </Text>
            <TouchableOpacity
              onPress={() => {
                createGlobalBottomSheetModal({
                  name: MODAL_NAMES.SWITCH_CHAIN,
                });
              }}>
              <Text>hello</Text>
            </TouchableOpacity>
          </View>
        }
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
    </>
  );
};

const getStyles = (colors: ReturnType<typeof useThemeColors>) =>
  StyleSheet.create({
    list: {
      paddingHorizontal: 20,
    },
    listHeader: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingBottom: 9,
    },
    listHeaderText: {
      color: colors['neutral-body'],
    },
    listItem: {
      marginBottom: 12,
    },
  });
