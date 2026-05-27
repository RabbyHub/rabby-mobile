import RcIconHistory from '@/assets2024/singleHome/history.svg';
import { CustomTouchableOpacity } from '@/components/CustomTouchableOpacity';
import { useTheme2024 } from '@/hooks/theme';
import React from 'react';
import {
  GestureResponderEvent,
  StyleProp,
  View,
  ViewStyle,
} from 'react-native';

import { HomePendingBadge } from './HomePending';

const historyHitSlop = {
  top: 4,
  bottom: 4,
  left: 4,
  right: 4,
};

type HistoryCount = {
  success: number;
  fail: number;
};

export function HeaderRightHistoryButton({
  pendingTxCount,
  historyCount,
  onPress,
  style,
  rightSpace = 16,
}: {
  pendingTxCount: number;
  historyCount?: HistoryCount;
  onPress: (event?: GestureResponderEvent) => void;
  style?: StyleProp<ViewStyle>;
  rightSpace?: number;
}) {
  const { colors2024 } = useTheme2024();

  return (
    <CustomTouchableOpacity
      style={style}
      hitSlop={historyHitSlop}
      onPress={onPress}>
      {pendingTxCount > 0 ? (
        <View
          style={{
            marginRight: rightSpace,
            position: 'relative',
            paddingVertical: 4,
          }}>
          <HomePendingBadge number={pendingTxCount} />
        </View>
      ) : (
        <View
          style={{
            marginRight: rightSpace,
            position: 'relative',
            paddingVertical: 4,
          }}>
          <RcIconHistory
            color={colors2024['neutral-title-1']}
            width={20}
            height={20}
          />
          {Boolean(historyCount?.success || historyCount?.fail) && (
            <View
              style={{
                width: 6,
                height: 6,
                borderRadius: 3,
                backgroundColor:
                  colors2024[
                    historyCount?.fail ? 'red-default' : 'green-default'
                  ],
                position: 'absolute',
                top: 0,
                right: -4,
              }}
            />
          )}
        </View>
      )}
    </CustomTouchableOpacity>
  );
}
