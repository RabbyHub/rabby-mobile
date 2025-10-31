import { Skeleton } from '@rneui/themed';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { getActionsStyle } from '../Actions';
import { useTheme2024, useThemeColors } from '@/hooks/theme';
import { Card } from '../Actions/components/Card';
import { Divide } from '../Actions/components/Divide';
import { SubTable } from '../Actions/components/SubTable';

const rowStyles = StyleSheet.create({
  title: {
    width: 60,
    height: 15,
    borderRadius: 6,
  },
  row: {
    gap: 8,
  },
  rowLine: {
    gap: 4,
    flexDirection: 'row',
  },
  item1: {
    width: 16,
    height: 16,
    borderRadius: 16,
  },
  item2: {
    width: 140,
    height: 16,
    borderRadius: 2,
  },
  titleItem: {
    width: 220,
    height: 22,
    borderRadius: 6,
  },
  titleRightItem: {
    width: 73,
    height: 22,
    borderRadius: 6,
  },
  leftItem: {
    width: 60,
    height: 22,
    borderRadius: 6,
  },
  headerRightItem: {
    width: 70,
    height: 22,
    borderRadius: 6,
  },
  tableItem: {
    width: 125,
    height: 15,
    borderRadius: 6,
  },
  tokenBalanceChange: {
    marginTop: 14,
  },
});

const RowLoading: React.FC<{
  itemCount?: number;
}> = ({ itemCount = 1, ...props }) => {
  return (
    <>
      {Array.from({ length: itemCount }).map((_, index) => (
        <View
          key={index}
          style={StyleSheet.flatten({
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          })}>
          <Skeleton width={80} height={16} />
          <Skeleton style={rowStyles.item2} />
        </View>
      ))}
    </>
  );
};

const Loading = () => {
  const { styles } = useTheme2024({
    getStyle: getActionsStyle,
  });
  return (
    <>
      <View style={styles.actionWrapper}>
        <Card>
          <View
            style={StyleSheet.flatten({
              flexDirection: 'row',
              gap: 8,
              alignItems: 'center',
              justifyContent: 'center',
              paddingVertical: 10,
            })}>
            <Skeleton style={rowStyles.item1} />
            <Skeleton style={rowStyles.item2} />
          </View>
          <Divide />
          <View
            style={StyleSheet.flatten({
              gap: 20,
              paddingHorizontal: 16,
              paddingVertical: 10,
            })}>
            <Skeleton width={100} height={16} />

            <View style={rowStyles.rowLine}>
              <Skeleton style={rowStyles.item1} />
              <Skeleton style={rowStyles.item2} />
            </View>
            <View style={rowStyles.rowLine}>
              <Skeleton style={rowStyles.item1} />
              <Skeleton style={rowStyles.item2} />
            </View>
          </View>
        </Card>
        <Card>
          <View
            style={StyleSheet.flatten({
              paddingHorizontal: 16,
              paddingVertical: 10,
            })}>
            <Skeleton style={rowStyles.item2} />
          </View>
          <Divide />
          <View
            style={StyleSheet.flatten({
              gap: 20,
              paddingHorizontal: 16,
              paddingVertical: 10,
            })}>
            <RowLoading itemCount={5} />
            <SubTable>
              <RowLoading itemCount={2} />
            </SubTable>
          </View>
        </Card>
        <Card>
          <View
            style={StyleSheet.flatten({
              paddingHorizontal: 16,
              paddingVertical: 10,
            })}>
            <Skeleton style={rowStyles.item2} />
          </View>
        </Card>
      </View>
    </>
  );
};

export default Loading;
