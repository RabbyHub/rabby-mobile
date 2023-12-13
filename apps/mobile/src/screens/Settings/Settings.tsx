import React from 'react';
import NormalScreenContainer from '@/components/ScreenContainer/NormalScreenContainer';

import { StyleSheet, View, Text } from 'react-native';
import { Button } from '@/components';
import { useTheme } from '@/core/storage/theme';
import { useThemeColors } from '@/hooks/theme';

function SettingsStack(): JSX.Element {
  const { theme, setTheme } = useTheme();

  const colors = useThemeColors();

  return (
    <NormalScreenContainer>
      <View
        style={[
          {
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
          },
        ]}>
        <Text
          style={[
            {
              fontSize: 16,
              color: colors['neutral-title-1'],
            },
          ]}>
          Settings Screen
        </Text>
        <Text
          style={{
            marginTop: 12,
            marginBottom: 12,
            color: colors['neutral-title-1'],
          }}>
          Current Theme: {theme}{' '}
        </Text>
        <Button
          title="Switch Theme"
          style={{ padding: 12, backgroundColor: colors['blue-default'] }}
          onPress={() => {
            setTheme(theme === 'dark' ? 'light' : 'dark');
          }}
        />
      </View>
    </NormalScreenContainer>
  );
}

const styles = StyleSheet.create({});

export default SettingsStack;
