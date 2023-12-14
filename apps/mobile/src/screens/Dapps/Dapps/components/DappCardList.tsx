import { SectionList, StyleSheet, Text, View } from 'react-native';
import { SwipeableDappCard } from './SwipeableDappCard';
import { Colors } from '@/constant/theme';
import { useThemeColors } from '@/hooks/theme';
import React from 'react';
import { EmptyDapps } from './EmptyDapps';
import { DappInfo } from '@rabby-wallet/service-dapp';

const DATA = [
  {
    title: '',
    data: ['Pizza', 'Burger', 'Risotto'],
  },
  {
    title: 'Favorite',
    data: ['Pizza', 'Burger', 'Risotto'],
  },
  {
    title: 'Sides',
    data: ['French Fries', 'Onion Rings', 'Fried Shrimps'],
  },
  {
    title: 'Drinks',
    data: ['Water', 'Coke', 'Beer'],
  },
  {
    title: 'Desserts',
    data: ['Cheese Cake', 'Ice Cream'],
  },
];

export const DappCardList = ({
  sections,
}: {
  sections: { title: string; data: DappInfo[] }[];
}) => {
  const colors = useThemeColors();
  const styles = React.useMemo(() => getStyles(colors), [colors]);

  return (
    <SectionList
      sections={sections}
      style={styles.list}
      // keyExtractor={(item, index) => item + index}
      renderItem={({ item }) => {
        return (
          <View style={styles.listItem}>
            <SwipeableDappCard />
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

const getStyles = (colors: Colors) =>
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
