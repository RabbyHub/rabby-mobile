import { Skeleton } from '@rneui/themed';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Col, Row, Table } from '../Actions/components/Table';
import { getStyle } from '../Actions';
import { useThemeColors } from '@/hooks/theme';

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
  },
  item2: {
    width: 113,
    height: 15,
    borderRadius: 6,
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
    <Col {...props}>
      <Row isTitle>
        <Skeleton style={rowStyles.title} />
      </Row>
      <Row style={rowStyles.row}>
        <View style={rowStyles.rowLine}>
          <Skeleton style={rowStyles.item1} />
          <Skeleton style={rowStyles.item2} />
        </View>
        {Array.from({ length: itemCount }).map((_, index) => (
          <View key={index}>
            <Skeleton style={rowStyles.item2} />
          </View>
        ))}
      </Row>
    </Col>
  );
};

const Loading = () => {
  const colors = useThemeColors();
  const styles = React.useMemo(() => getStyle(colors), [colors]);

  return (
    <>
      <View style={styles.signTitle}>
        <View>
          <Skeleton style={rowStyles.titleItem} />
        </View>
        <View style={styles.signTitleRight}>
          <Skeleton style={rowStyles.titleRightItem} />
        </View>
      </View>
      <View style={styles.actionWrapper}>
        <View style={styles.actionHeader}>
          <View>
            <Skeleton style={rowStyles.leftItem} />
          </View>
          <View style={styles.actionHeaderRight}>
            <Skeleton style={rowStyles.headerRightItem} />
          </View>
        </View>
        <View style={styles.container}>
          <Table>
            <RowLoading itemCount={1} />
            <RowLoading itemCount={2} />
          </Table>

          <Table style={rowStyles.tokenBalanceChange}>
            <Col key="1">
              <Row>
                <Skeleton style={rowStyles.tableItem} />
              </Row>
            </Col>
            <RowLoading key="2" itemCount={0} />
          </Table>
        </View>
      </View>
    </>
  );
};

export default Loading;
