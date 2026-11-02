import { Text } from '@/components/Typography';
import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

export const PerpsProPositionTpSlCancelAction = ({
  disabled,
  label,
  loading,
  onPress,
  style,
  textStyle,
}: {
  disabled: boolean;
  label: string;
  loading: boolean;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
  textStyle: StyleProp<TextStyle>;
}) => (
  <Pressable
    accessibilityLabel={label}
    accessibilityRole="button"
    accessibilityState={{ busy: loading, disabled: disabled || loading }}
    disabled={disabled || loading}
    onPress={onPress}
    style={style}>
    {/* Keep the original text slot so waiting never changes button geometry. */}
    <Text style={[textStyle, loading && styles.hiddenLabel]}>{label}</Text>
    {loading ? (
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        pointerEvents="none"
        style={styles.spinner}>
        <ActivityIndicator
          color={StyleSheet.flatten(textStyle)?.color}
          size="small"
        />
      </View>
    ) : null}
  </Pressable>
);

const styles = StyleSheet.create({
  hiddenLabel: { opacity: 0 },
  spinner: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
