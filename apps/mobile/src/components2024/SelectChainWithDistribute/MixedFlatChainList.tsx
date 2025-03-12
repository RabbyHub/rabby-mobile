import React from 'react';
import { View, NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { createGetStyles2024 } from '@/utils/styles';
import { useTheme2024 } from '@/hooks/theme';
import ChainItem from './ChainItem';
import { BottomSheetFlatList } from '@gorhom/bottom-sheet';
import { ChainListItem } from './index';

export default function MixedFlatChainList({
  style,
  value,
  onChange,
  onScrollBeginDrag,
  chainList,
}: RNViewProps & {
  value?: ChainListItem;
  onChange?(value: ChainListItem): void;
  chainList?: ChainListItem[];
  onScrollBeginDrag?:
    | ((event: NativeSyntheticEvent<NativeScrollEvent>) => void)
    | undefined;
}) {
  const { styles } = useTheme2024({ getStyle });

  return (
    <BottomSheetFlatList<ChainListItem>
      data={chainList}
      onScrollBeginDrag={onScrollBeginDrag}
      style={style}
      ListFooterComponent={<View style={{ height: 32 }} />}
      keyExtractor={item => item.chain}
      renderItem={({ item, index }) => {
        const isSectionFirst = index === 0;
        const isSectionLast = index === (chainList?.length || 0) - 1;
        return (
          <View
            style={[
              isSectionFirst && styles.sectionFirst,
              isSectionLast && styles.sectionLast,
            ]}>
            <ChainItem data={item} value={value} onPress={onChange} />
          </View>
        );
      }}
    />
  );
}

const RADIUS_VALUE = 24;

const getStyle = createGetStyles2024(() => ({
  sectionFirst: {
    borderTopLeftRadius: RADIUS_VALUE,
    borderTopRightRadius: RADIUS_VALUE,
  },
  sectionLast: {
    borderBottomLeftRadius: RADIUS_VALUE,
    borderBottomRightRadius: RADIUS_VALUE,
  },
}));
