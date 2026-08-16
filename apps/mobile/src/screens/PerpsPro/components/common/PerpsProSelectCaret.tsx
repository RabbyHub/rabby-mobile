import RcPrecisionCaret from '@/assets2024/icons/perps/PerpsProPrecisionCaret.svg';
import React from 'react';
import { StyleSheet, View } from 'react-native';

const CARET_WIDTH = 5.69228;
const CARET_HEIGHT = 4.11638;

export const PerpsProSelectCaret: React.FC<{
  color: string;
  testID?: string;
}> = React.memo(({ color, testID }) => (
  <View pointerEvents="none" style={styles.frame} testID={testID}>
    <RcPrecisionCaret
      color={color}
      height={CARET_HEIGHT}
      style={styles.glyph}
      testID={testID ? `${testID}-glyph` : undefined}
      width={CARET_WIDTH}
    />
  </View>
));

PerpsProSelectCaret.displayName = 'PerpsProSelectCaret';

const styles = StyleSheet.create({
  frame: {
    alignItems: 'center',
    flexShrink: 0,
    height: 6,
    justifyContent: 'center',
    width: 8,
  },
  glyph: {
    transform: [{ rotate: '180deg' }],
  },
});
