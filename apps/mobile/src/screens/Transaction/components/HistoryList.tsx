import React from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { HistoryItem } from './HistoryItem';

export const HistoryList = () => {
  const data = [
    { id: 1 },
    { id: 2 },
    { id: 3 },
    { id: 4 },
    { id: 5 },
    { id: 6 },
    { id: 7 },
    { id: 8 },
    { id: 9 },
  ];
  const renderItem = ({ item }: { item: any }) => {
    return <HistoryItem />;
  };

  return (
    <Animated.FlatList
      data={data}
      renderItem={renderItem}
      windowSize={5}
      style={styles.container}
    />
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
  },
});
