import React from 'react';
import { View } from 'react-native';
import { Text } from '@/components/Typography';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';

export const FooterTip: React.FC<{
  message: string;
  action?: React.ReactNode;
  neutral?: boolean;
  showArrow?: boolean;
}> = ({ message, action, neutral = false, showArrow = true }) => {
  const { styles } = useTheme2024({ getStyle });

  return (
    <View style={[styles.container, neutral && styles.neutralContainer]}>
      {showArrow && (
        <View style={[styles.triangle, neutral && styles.neutralTriangle]} />
      )}
      <View style={[styles.textWrap, !!action && styles.textWrapWithAction]}>
        <Text style={[styles.text, neutral && styles.neutralText]}>
          {message}
        </Text>
      </View>
      {action}
    </View>
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  container: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingLeft: 12,
    paddingRight: 5,
    borderRadius: 8,
    position: 'relative',
    marginBottom: 8,
    marginTop: 5,
    // Preserve the existing compact gas-warning bubble height.
    minHeight: 36,
    backgroundColor: colors2024['red-light-1'],
  },
  triangle: {
    position: 'absolute',
    top: -20,
    left: 10,
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderStyle: 'solid',
    borderLeftWidth: 10,
    borderRightWidth: 10,
    borderTopWidth: 10,
    borderBottomWidth: 10,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: 'transparent',
    alignItems: 'center',
    borderBottomColor: colors2024['red-light-1'],
  },
  text: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    fontStyle: 'normal',
    fontWeight: '500',
    lineHeight: 18,
    color: colors2024['red-default'],
    flexShrink: 1,
  },
  textWrap: {
    flex: 1,
    minWidth: 0,
  },
  textWrapWithAction: {
    marginRight: 12,
  },
  neutralContainer: {
    backgroundColor: colors2024['neutral-bg-2'],
  },
  neutralText: {
    color: colors2024['neutral-title-1'],
  },
  neutralTriangle: {
    borderBottomColor: colors2024['neutral-bg-2'],
  },
}));
