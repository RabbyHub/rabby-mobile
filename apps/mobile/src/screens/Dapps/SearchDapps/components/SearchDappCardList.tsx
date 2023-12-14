import { Colors } from '@/constant/theme';
import { useThemeColors } from '@/hooks/theme';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { FlatList } from 'react-native-gesture-handler';
import { DappCard } from '../../components/DappCard';

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

export const SearchDappCardList = () => {
  const colors = useThemeColors();
  const styles = React.useMemo(() => getStyles(colors), [colors]);

  return (
    <FlatList
      data={DATA}
      style={styles.list}
      renderItem={({ item }) => {
        return (
          <View style={styles.listItem}>
            <DappCard />
          </View>
        );
      }}
    />
  );
};

const getStyles = (colors: Colors) =>
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
