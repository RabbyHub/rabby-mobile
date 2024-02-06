import { DappInfo } from '@/core/services/dappService';
import { useThemeColors } from '@/hooks/theme';
import { useEventEmitter } from 'ahooks';
import React from 'react';
import { SectionList, StyleSheet, Text, View } from 'react-native';
import { TouchableWithoutFeedback } from 'react-native-gesture-handler';
import { SwipeableDappCard } from './SwipeableDappCard';

export const DappCardList = ({
  sections,
  onPress,
  onFavoritePress,
  onRemovePress,
  onClosePress,
  onDisconnectPress,
  ListEmptyComponent,
}: {
  sections: { title: string; data: DappInfo[]; type?: string }[];
  onPress?: (dapp: DappInfo) => void;
  onFavoritePress?: (dapp: DappInfo) => void;
  onRemovePress?: (dapp: DappInfo) => void;
  onClosePress?: (dapp: DappInfo) => void;
  onDisconnectPress?: (dapp: DappInfo) => void;
  ListEmptyComponent?:
    | React.ComponentType<any>
    | React.ReactElement<any, string | React.JSXElementConstructor<any>>
    | null
    | undefined;
}) => {
  const colors = useThemeColors();
  const styles = React.useMemo(() => getStyles(colors), [colors]);
  const close$ = useEventEmitter<void>();

  return (
    <TouchableWithoutFeedback
      style={styles.container}
      onPress={() => {
        close$.emit();
      }}>
      <SectionList
        sections={sections}
        style={styles.list}
        keyExtractor={item => item.origin}
        stickySectionHeadersEnabled={false}
        renderItem={({ item, section }) => {
          return (
            <View style={styles.listItem}>
              <SwipeableDappCard
                isActive={section.type === 'active'}
                data={item}
                onPress={onPress}
                onFavoritePress={onFavoritePress}
                onRemovePress={
                  section.key === 'inUse' ? onClosePress : onRemovePress
                }
                onDisconnectPress={onDisconnectPress}
                close$={close$}
              />
            </View>
          );
        }}
        renderSectionHeader={({ section: { title } }) => {
          return title ? <Text style={styles.listHeader}>{title}</Text> : null;
        }}
        ListEmptyComponent={ListEmptyComponent}
      />
    </TouchableWithoutFeedback>
  );
};

const getStyles = (colors: ReturnType<typeof useThemeColors>) =>
  StyleSheet.create({
    container: {
      height: '100%',
      width: '100%',
    },
    list: {
      marginBottom: 20,
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
