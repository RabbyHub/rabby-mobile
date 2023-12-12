import { Text } from '@/components';
import RootScreenContainer from '@/components/ScreenContainer/RootScreenContainer';
import { ScreenColors } from '@/constant/layout';
import { useThemeColors } from '@/hooks/theme';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { AddressInput } from './components/AddressInput';

export const ImportSuccessScreen = () => {
  const colors = useThemeColors();
  const styles = React.useMemo(
    () =>
      StyleSheet.create({
        rootContainer: {
          display: 'flex',
          backgroundColor: ScreenColors.homeHeaderBlue,
        },
        titleContainer: {
          width: '100%',
          height: 320,
          flexShrink: 0,
          backgroundColor: ScreenColors.homeHeaderBlue,
        },
        inputContainer: {
          backgroundColor: colors['neutral-bg-2'],
          height: '100%',
          paddingVertical: 24,
          paddingHorizontal: 20,
        },
      }),

    [colors],
  );

  return (
    <RootScreenContainer style={styles.rootContainer}>
      <View style={styles.titleContainer}>
        <Text>Added successfully</Text>
      </View>
      <View style={styles.inputContainer}>
        <AddressInput />
      </View>
    </RootScreenContainer>
  );
};
