import React from 'react';
import NormalScreenContainer from '@/components/ScreenContainer/NormalScreenContainer';

import {StyleSheet, View} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import HeaderTitleText from '@/components/ScreenHeader/HeaderTitleText';
import {useThemeColors} from '@/hooks/theme';

function DappsScreen(): JSX.Element {
  const navigation = useNavigation();
  const colors = useThemeColors();

  const getHeaderTitle = React.useCallback(() => {
    return <HeaderTitleText>Dapps</HeaderTitleText>;
  }, []);

  React.useEffect(() => {
    navigation.setOptions({
      headerTitle: getHeaderTitle,
    });
  }, [navigation, getHeaderTitle]);

  return (
    <NormalScreenContainer
      style={{
        backgroundColor: colors['neutral-bg-2'],
      }}>
      <View
        style={{
          width: '100%',
          flexShrink: 0,
        }}
      />
    </NormalScreenContainer>
  );
}

const styles = StyleSheet.create({});

export default DappsScreen;
