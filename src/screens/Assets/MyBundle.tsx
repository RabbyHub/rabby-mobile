import React from 'react';
import NormalScreenContainer from '@/components/ScreenContainer/NormalScreenContainer';

import { StyleSheet, View, Text } from 'react-native';

function MyBundleScreen(): JSX.Element {
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
          MyBundle Screen
        </Text>
      </View>
    </NormalScreenContainer>
  );
}

const styles = StyleSheet.create({});

export default MyBundleScreen;
