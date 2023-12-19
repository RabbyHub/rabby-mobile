import React, { useCallback, useMemo, memo } from 'react';
import {
  StyleSheet,
  View,
  Pressable,
  FlatList,
  Image,
  VirtualizedList,
} from 'react-native';
import FastImage from 'react-native-fast-image';
import { colord } from 'colord';

import { Colors } from '@/consts';
import { ListItem, Card, Text } from '@/components';
import { useThemeColors, useSwitch } from '@/hooks';
import { numFormat } from '@/utils';

type CoinShow = (Coin | Tokens) & {
  _value: number;
  _percent: string;
};

type CoinListProps = {
  data?: Array<CoinShow>;
};

class PureCoinItem extends React.PureComponent<CoinItemProps> {
  render() {
    return <CoinItem {...this.props} />;
  }
}

// including padding
const ITEM_HEIGHT = 46;

export const CoinList = ({ data }: CoinListProps) => {
  const colors = useThemeColors();
  const styles = getStyle(colors);
  const { on, toggle } = useSwitch();

  const renderItem = useCallback(
    ({ item }: { item: CoinShow }) => (
      <PureCoinItem data={item} isPercent={on} />
    ),
    [on],
  );

  const getItemLayout = useCallback(
    (_data, index) => ({
      length: ITEM_HEIGHT,
      offset: ITEM_HEIGHT * index,
      index,
    }),
    [],
  );

  return (
    <Card style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Assets / Debts</Text>
        <Pressable onPress={toggle} hitSlop={40}>
          <Text style={styles.headerTitle}>
            <Text style={{ color: !on ? colors.primary : undefined }}>
              Value
            </Text>
            <Text>{' / '}</Text>
            <Text style={{ color: on ? colors.primary : undefined }}>%</Text>
          </Text>
        </Pressable>
      </View>
      <VirtualizedList<CoinShow>
        getItem={(list, index) => list[index]}
        getItemCount={() => data?.length ?? 0}
        data={data}
        keyExtractor={(item, i) => item?.id! + i}
        renderItem={renderItem}
        getItemLayout={getItemLayout}
        windowSize={5}
        extraData={on}
        maxToRenderPerBatch={15}
        initialNumToRender={15}
      />
    </Card>
  );
};

type CoinItemProps = {
  data: CoinShow;
  isPercent: boolean;
};

const CoinItem = ({ data, isPercent }: CoinItemProps) => {
  const colors = useThemeColors();
  const styles = getStyle(colors);

  const bgStyle = useMemo(() => {
    const backgroundColor = colord(
      data._value > 0 ? colors.pureGreen : colors.pureRed,
    )
      .alpha(0.08)
      .toRgbString();
    const width = data._percent.replace(/^-/, '');

    return { width, backgroundColor };
  }, [data, colors]);

  return (
    <View style={styles.coinContainer}>
      <View style={styles.bgProgressWrap}>
        <View style={[styles.bgProgress, bgStyle]} />
      </View>
      <ListItem
        containerStyle={styles.coinWrap}
        avatar={
          (data as Coin).logo || (data as Tokens).logo_url ? (
            <FastImage
              source={{ uri: (data as Coin).logo || (data as Tokens).logo_url }}
              style={styles.coinAvatar}
            />
          ) : (
            <View style={[styles.logoHolder, styles.coinAvatar]} />
          )
        }>
        <View style={styles.coinInner}>
          <Text style={styles.coinSymbol}>{data.symbol}</Text>
          <Text style={styles.coinSymbol}>
            {isPercent ? data._percent : numFormat(data._value, 0, '$')}
          </Text>
        </View>
      </ListItem>
    </View>
  );
};

const getStyle = (colors: Colors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      marginBottom: 160,
    },
    header: {
      paddingHorizontal: 11,
      paddingVertical: 9,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    headerTitle: {
      fontSize: 12,
      color: colors.midBlue,
    },
    scrollView: {},
    coinContainer: {
      position: 'relative',
      paddingBottom: 2,
      height: 46,
    },
    coinWrap: {
      minHeight: 44,
      height: 44,
      paddingHorizontal: 10,
      paddingVertical: 0,
      backgroundColor: 'transparent',
    },
    coinInner: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
      justifyContent: 'space-between',
    },
    coinAvatar: {
      width: 28,
      height: 28,
      marginRight: 8,
      borderRadius: 10,
    },
    logoHolder: {
      backgroundColor: colors.bg,
    },
    coinSymbol: {
      fontSize: 14,
      color: colors.darkBlue,
      fontWeight: '500',
    },
    bgProgressWrap: {
      position: 'absolute',
      top: 0,
      bottom: 2,
      left: 2,
      right: 2,
    },
    bgProgress: {
      height: '100%',
    },
  });
