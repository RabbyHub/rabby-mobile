import { Text } from '@/components/Typography';
import React from 'react';
import { StyleSheet, View, type StyleProp, type TextStyle } from 'react-native';

/**
 * Invisible single-line copy of a text that reports its unconstrained width.
 * The wide row host keeps Yoga from clamping the text to the visible parent.
 */
export const PerpsProTextWidthProbe: React.FC<{
  onWidth: (width: number) => void;
  style: StyleProp<TextStyle>;
  text: string;
}> = React.memo(({ onWidth, style, text }) => (
  <View
    accessibilityElementsHidden
    importantForAccessibility="no-hide-descendants"
    pointerEvents="none"
    style={styles.host}>
    <Text
      numberOfLines={1}
      onLayout={event => onWidth(event.nativeEvent.layout.width)}
      style={[style, styles.text]}>
      {text}
    </Text>
  </View>
));

PerpsProTextWidthProbe.displayName = 'PerpsProTextWidthProbe';

const styles = StyleSheet.create({
  host: {
    flexDirection: 'row',
    left: 0,
    opacity: 0,
    position: 'absolute',
    top: 0,
    width: 2000,
  },
  // Callers pass the visible text's style; drop its placement so only the
  // font metrics shape the measurement.
  text: {
    bottom: 'auto',
    flexGrow: 0,
    flexShrink: 0,
    left: 'auto',
    position: 'relative',
    right: 'auto',
    top: 'auto',
  },
});
