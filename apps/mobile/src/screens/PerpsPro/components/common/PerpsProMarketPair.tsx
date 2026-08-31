import { Text } from '@/components/Typography';
import React from 'react';
import {
  Pressable,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import { PerpsProSkeletonBlock } from '../loading/PerpsProSkeletonBlock';

const MARKET_PAIR_SKELETON_STYLE = { borderRadius: 2 } as const;

export const PerpsProMarketPair: React.FC<{
  metadataReady: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  testID: string;
  textStyle?: StyleProp<TextStyle>;
  value: string;
}> = React.memo(
  ({ metadataReady, onPress, style, testID, textStyle, value }) => (
    <Pressable
      accessibilityLabel={metadataReady ? value : undefined}
      accessibilityRole="button"
      accessibilityState={{ disabled: !onPress }}
      disabled={!onPress}
      onPress={onPress}
      style={style}
      testID={testID}>
      {metadataReady ? (
        <Text numberOfLines={1} style={textStyle}>
          {value}
        </Text>
      ) : (
        <PerpsProSkeletonBlock
          height={14}
          style={MARKET_PAIR_SKELETON_STYLE}
          testID={`${testID}-skeleton`}
          width={52}
        />
      )}
    </Pressable>
  ),
);

PerpsProMarketPair.displayName = 'PerpsProMarketPair';
