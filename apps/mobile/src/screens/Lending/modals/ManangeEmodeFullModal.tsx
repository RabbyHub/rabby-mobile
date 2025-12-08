import React, { useCallback, useState } from 'react';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { Text } from 'react-native';
import AutoLockView from '@/components/AutoLockView';
import { Button } from '@/components2024/Button';
import { useMode } from '../hooks/useMode';
import ManageEmodeOverView from '../components/overviews/ManageEmodeOverView';

const ManageEmodeFullModal = () => {
  const { styles, colors2024 } = useTheme2024({ getStyle: getStyles });
  const { emodeEnabled, emodeCategoryId } = useMode();

  const handlePressManageEMode = useCallback(() => {
    console.log('CUSTOM_LOGGER:=>: handlePressManageEMode');
  }, []);
  const [selectedCategoryId, setSelectedCategoryId] = useState(
    emodeCategoryId || 0,
  );
  return (
    <AutoLockView as="View" style={styles.container}>
      <Text style={styles.title}>Manage E-Mode</Text>
      <Text style={styles.description}>
        Enabling E-Mode allows you to maximize your borrowing power. However,
        borrowing is restricted to assets within the selected category.
      </Text>
      <ManageEmodeOverView
        selectedCategoryId={selectedCategoryId}
        onSelectCategory={setSelectedCategoryId}
      />
    </AutoLockView>
  );
};

export default ManageEmodeFullModal;

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
