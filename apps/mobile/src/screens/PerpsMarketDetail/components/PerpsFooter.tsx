import { Button } from '@/components2024/Button';
import { PositionAndOpenOrder } from '@/hooks/perps/usePerpsStore';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

export const PerpsFooter: React.FC<{
  onLongPress?(): void;
  onShortPress?(): void;
  onClosePress?(): void;
  hasPermission?: boolean;
  isLogin?: boolean;
  hasPosition?: boolean;
  direction?: string;
}> = ({
  onLongPress,
  onShortPress,
  onClosePress,
  hasPermission,
  hasPosition,
  direction,
}) => {
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const { t } = useTranslation();

  if (hasPosition) {
    return (
      <View style={styles.footer}>
        <Button
          type="primary"
          title={`Close ${direction} Position`}
          onPress={onClosePress}
        />
      </View>
    );
  }
  if (hasPermission) {
    return (
      <View style={styles.footer}>
        <View style={styles.btnGroup}>
          <View style={styles.btnContainer}>
            <Button type="primary" title={'Long'} onPress={onLongPress} />
          </View>
          <View style={styles.btnContainer}>
            <Button type="primary" title={'Short'} onPress={onShortPress} />
          </View>
        </View>
      </View>
    );
  }
  return null;
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  footer: {
    backgroundColor: colors2024['neutral-bg-1'],
    paddingTop: 12,
    paddingHorizontal: 16,
    paddingBottom: 56,
  },
  btnGroup: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  btnContainer: {
    flex: 1,
  },
}));
