import { useThemeColors } from '@/hooks/theme';
import { DappInfo } from '@rabby-wallet/service-dapp';
import React from 'react';
import { SectionList, StyleSheet, Text, View } from 'react-native';
import { EmptyDapps } from './EmptyDapps';
import { SwipeableDappCard } from './SwipeableDappCard';

export const DappCardList = ({
  sections,
  onPress,
  onFavoritePress,
  onRemovePress,
  onDisconnectPress,
}: {
  sections: { title: string; data: DappInfo[] }[];
  onPress?: (dapp: DappInfo) => void;
  onFavoritePress?: (dapp: DappInfo) => void;
  onRemovePress?: (dapp: DappInfo) => void;
  onDisconnectPress?: (dapp: DappInfo) => void;
}) => {
  const colors = useThemeColors();
  const styles = React.useMemo(() => getStyles(colors), [colors]);

  return (
    <SectionList
      sections={sections}
      style={styles.list}
      keyExtractor={item => item.origin}
      stickySectionHeadersEnabled={false}
      renderItem={({ item }) => {
        return (
          <View style={styles.listItem}>
            <SwipeableDappCard
              data={item}
              onPress={onPress}
              onFavoritePress={onFavoritePress}
              onRemovePress={onRemovePress}
              onDisconnectPress={onDisconnectPress}
            />
          </View>
        );
      }}
      renderSectionHeader={({ section: { title } }) => {
        return title ? <Text style={styles.listHeader}>{title}</Text> : null;
      }}
      ListEmptyComponent={EmptyDapps}
    />
  );
};

const getStyles = (colors: ReturnType<typeof useThemeColors>) =>
  StyleSheet.create({
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
