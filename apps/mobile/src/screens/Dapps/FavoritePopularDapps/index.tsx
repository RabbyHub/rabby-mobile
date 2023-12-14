import React from 'react';
import NormalScreenContainer from '@/components/ScreenContainer/NormalScreenContainer';

import {
  StyleSheet,
  View,
  ScrollView,
  Text,
  Button,
  Pressable,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import HeaderTitleText from '@/components/ScreenHeader/HeaderTitleText';
import { useThemeColors } from '@/hooks/theme';
import RcIconSearch from '@/assets/icons/dapp/icon-search.svg';
import TouchableItem from '@/components/Touchable/TouchableItem';
import { Colors } from '@/constant/theme';
import { PrimaryButton } from '@/components/Button';
import { FavoriteDappCardList } from './components/FavoriteDappCardList';

export function FavoritePopularDappsScreen(): JSX.Element {
  const navigation = useNavigation();
  const colors = useThemeColors();
  const styles = React.useMemo(() => getStyles(colors), [colors]);

  const getHeaderTitle = React.useCallback(() => {
    return <HeaderTitleText>Favorite Popular Dapp</HeaderTitleText>;
  }, []);

  React.useEffect(() => {
    navigation.setOptions({
      headerTitle: getHeaderTitle,
    });
  }, [navigation, getHeaderTitle]);

  return (
    <NormalScreenContainer style={styles.page}>
      <View style={styles.container}>
        <FavoriteDappCardList />
      </View>
      <View style={styles.footer}>
        <PrimaryButton
          onPress={() => {
            console.log('//todo');
          }}
          title={'Favorite'}
        />
      </View>
    </NormalScreenContainer>
  );
}

const getStyles = (colors: Colors) =>
  StyleSheet.create({
    page: {
      backgroundColor: colors['neutral-bg-2'],
      flexDirection: 'column',
      gap: 8,
    },
    container: {
      flex: 1,
    },
    footer: {
      // position: 'absolute',
      // bottom: 0,
      // left: 0,
      // right: 0,
      flexShrink: 0,
      backgroundColor: '#FFFFFF',
      padding: 20,
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      borderTopColor: colors['neutral-line'],
      borderTopWidth: 0.5,
      borderTopStyle: 'solid',
    },
  });
