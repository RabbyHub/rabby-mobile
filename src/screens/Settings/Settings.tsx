import React from 'react';
import NormalScreenContainer from '@/components/ScreenContainer/NormalScreenContainer';

import {StyleSheet, View, Text} from 'react-native';

function SettingsStack(): JSX.Element {
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
            },
          ]}>
          Settings Screen
        </Text>
      </View>
    </NormalScreenContainer>
  );
}

const styles = StyleSheet.create({});

export default SettingsStack;
