import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React, { useCallback } from 'react';
import { Text } from 'react-native';
import { Button } from '@/components2024/Button';
import AutoLockView from '@/components/AutoLockView';
import { useMode } from '../hooks/useMode';

export const ManageEmodeModal = ({ onClose }: { onClose: () => void }) => {
  const { styles } = useTheme2024({ getStyle: getStyles });
  const { emodeEnabled } = useMode();

  const handlePressManageEMode = useCallback(() => {
    console.log('CUSTOM_LOGGER:=>: handlePressManageEMode');
    onClose?.();
  }, [onClose]);

  return (
    <AutoLockView as="View" style={styles.container}>
      <Text style={styles.title}>Efficiency mode (E-Mode)</Text>
      <Text style={styles.description}>
        E-Mode increases your LTV for a selected category of assets.{' '}
      </Text>
      <Button
        containerStyle={styles.button}
        buttonStyle={[emodeEnabled && styles.disabledButton]}
        titleStyle={[emodeEnabled && styles.disabledTitle]}
        title="Manage E-Mode"
        onPress={handlePressManageEMode}
      />
    </AutoLockView>
  );
};
const getStyles = createGetStyles2024(ctx => ({
  container: {
    paddingHorizontal: 25,
    height: '100%',
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    backgroundColor: ctx.colors2024['neutral-bg-1'],
  },
  title: {
    color: ctx.colors2024['neutral-title-1'],
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 24,
    textAlign: 'center',
    fontFamily: 'SF Pro Rounded',
  },
  description: {
    fontSize: 16,
    lineHeight: 24,
    color: ctx.colors2024['neutral-foot'],
    fontFamily: 'SF Pro Rounded',
    marginTop: 8,
    paddingHorizontal: 20,
    textAlign: 'center',
  },
  button: {
    position: 'absolute',
    bottom: 56,
    width: '100%',
  },
  disabledButton: {
    backgroundColor: ctx.colors2024['neutral-line'],
  },
  disabledTitle: {
    color: ctx.colors2024['neutral-title-1'],
  },
}));
