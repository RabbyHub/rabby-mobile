import React from 'react';
import { Keyboard, Text, View } from 'react-native';

import { useTheme2024, useGetBinaryMode } from '@/hooks/theme';
import MixedFlatChainList from './MixedFlatChainList';
import AutoLockView from '@/components/AutoLockView';
import { createGetStyles2024 } from '@/utils/styles';
import { BottomSheetHandlableView } from '@/components/customized/BottomSheetHandle';

export type ChainListItem = {
  chain: string;
  total: number;
  percentage: number;
};

type SelectSortedChainProps = {
  value?: ChainListItem;
  onChange?: (value: ChainListItem) => void;
  chainList?: ChainListItem[];
  titleText?: string;
};
export default function SelectChainWithDistribute({
  value,
  onChange,
  chainList,
  titleText,
}: RNViewProps & SelectSortedChainProps) {
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const isDark = useGetBinaryMode() === 'dark';
  return (
    <AutoLockView
      style={{
        ...styles.container,
        backgroundColor: isDark
          ? colors2024['neutral-bg-1']
          : colors2024['neutral-bg-0'],
      }}>
      <BottomSheetHandlableView>
        <View style={{ ...styles.titleView, ...styles.titleViewWithText }}>
          {titleText && (
            <View style={styles.titleTextWrapper}>
              <Text style={styles.titleText}>{titleText}</Text>
            </View>
          )}
        </View>
      </BottomSheetHandlableView>

      <View style={[styles.chainListWrapper]}>
        <MixedFlatChainList
          onScrollBeginDrag={() => {
            Keyboard.dismiss();
          }}
          style={styles.innerBlock}
          value={value}
          onChange={onChange}
          chainList={chainList}
        />
      </View>
    </AutoLockView>
  );
}

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  container: {
    height: '100%',
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  titleText: {
    color: colors2024['neutral-title-1'],
    fontSize: 20,
    fontWeight: '800',
    fontFamily: 'SF Pro Rounded',
    textAlign: 'center',
    lineHeight: 24,
  },
  titleTextWrapper: {
    flex: 1,
  },
  innerBlock: {
    paddingHorizontal: 0,
  },

  chainListWrapper: {
    flexShrink: 1,
    height: '100%',
  },

  titleView: {
    display: 'flex',
    flexDirection: 'row',
    width: '100%',
    alignItems: 'center',
    marginBottom: 12,
  },

  titleViewWithText: {
    marginBottom: 34,
  },
}));
