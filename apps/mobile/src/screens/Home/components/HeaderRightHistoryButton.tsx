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

export function HeaderRightHistoryButton({
  pendingTxCount,
  onPress,
  style,
  rightSpace = 16,
}: {
  pendingTxCount: number;
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
          }}>
          <HomePendingBadge number={pendingTxCount} />
        </View>
      ) : (
        <View
          style={{
            marginRight: rightSpace,
            position: 'relative',
          }}>
          <RcIconHistory
            color={colors2024['neutral-title-1']}
            width={20}
            height={20}
          />
        </View>
      )}
    </CustomTouchableOpacity>
  );
}
