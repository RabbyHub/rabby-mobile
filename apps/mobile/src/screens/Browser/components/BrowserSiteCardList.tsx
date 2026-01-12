import { DappInfo } from '@/core/services/dappService';
import { useThemeColors } from '@/hooks/theme';
import React from 'react';
import { FlatListProps, FlatList, StyleSheet, Text, View } from 'react-native';
import {
  SimultaneousGesture,
  TouchableOpacity,
} from 'react-native-gesture-handler';
import { BrowserSiteCard } from './BrowserSiteCard';
import RcIconDelete from '@/assets2024/icons/common/delete-cc.svg';
import { BottomSheetFlatList } from '@gorhom/bottom-sheet';
import { DraggableScrollable } from '@/components2024/DragableScrollable';

export const BrowserSiteCardList = ({
  data,
  onPress,
  onFavoritePress,
  onDeletePress,
  ListEmptyComponent,
  ListHeaderComponent,
  style,
  isShowDelete,
  isInBottomSheet,
  scrollableGesture,
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
  style?: FlatListProps<DappInfo>['style'];
  isShowDelete?: boolean;
  isInBottomSheet?: boolean;
  scrollableGesture?: SimultaneousGesture;
}) => {
  const colors = useThemeColors();
  const styles = React.useMemo(() => getStyles(colors), [colors]);

  const Component = isInBottomSheet ? BottomSheetFlatList : FlatList;

  return (
    <DraggableScrollable scrollableGesture={scrollableGesture}>
      <Component
        data={data}
        style={[styles.list, style]}
        keyExtractor={item => item.url || item.origin}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          { flexGrow: 1 },
          data.length ? null : { justifyContent: 'center' },
        ]}
        renderItem={({ item }) => {
          return (
            <View style={styles.listItem}>
              {isShowDelete ? (
                <TouchableOpacity
                  onPress={() => {
                    onDeletePress?.(item);
                  }}>
                  <RcIconDelete width={20} height={20} />
                </TouchableOpacity>
              ) : null}
              <View style={styles.listItemContent}>
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
    </DraggableScrollable>
  );
};

const getStyles = (colors: ReturnType<typeof useThemeColors>) =>
  StyleSheet.create({
    list: {
      paddingBottom: 20,
    },
    listItem: {
      marginBottom: 12,
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 16,
    },
    listItemContent: {
      width: '100%',
    },
  });
