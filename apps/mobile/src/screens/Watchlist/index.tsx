import React from 'react';
import { useTheme2024 } from '@/hooks/theme';
import { useNavigation } from '@react-navigation/core';
import { RootStackParamsList } from '@/navigation-type';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { createGetStyles2024 } from '@/utils/styles';
import NormalScreenContainer2024 from '@/components2024/ScreenContainer/NormalScreenContainer';
import { Text } from 'react-native';
import SearchEntry from './SearchEntry';

type CurrentAddressProps = NativeStackScreenProps<
  RootStackParamsList,
  'StackAddress'
>;

function WatchlistScreen(): JSX.Element {
  const { styles } = useTheme2024({ getStyle });
  const navigation = useNavigation<CurrentAddressProps['navigation']>();

  return (
    <NormalScreenContainer2024
      type="linear"
      overwriteStyle={styles.overwriteStyle}>
      <Text>xxx</Text>
      <SearchEntry />
    </NormalScreenContainer2024>
  );
}

const getStyle = createGetStyles2024(() => ({
  overwriteStyle: {
    paddingTop: 0,
    position: 'relative',
  },
  accountRoot: {
    paddingTop: 0,
    backgroundColor: 'transparent',
    // paddingBottom: 24,
    height: '100%',
    maxHeight: '100%',
  },
}));

export default WatchlistScreen;
