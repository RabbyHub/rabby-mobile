/**
 * Sample React Native HomeScreen
 * https://github.com/facebook/react-native
 *
 * @format
 */
import React from 'react';
import {
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import RootScreenContainer from '@/components/ScreenContainer/RootScreenContainer';
import { RootNames, ScreenColors } from '@/constant/layout';

import { Colors } from 'react-native/Libraries/NewAppScreen';
import TouchableView from '@/components/Touchable/TouchableView';

import HeaderArea from './HeaderArea';
import { useNavigation } from '@react-navigation/native';
import { useGetAppThemeMode, useThemeColors } from '@/hooks/theme';
import { TestWalletConnectView } from './TestWalletConnectView';

function Section({
  children,
  title,
}: React.PropsWithChildren<{
  title: string;
}>): JSX.Element {
  const isDarkMode = useGetAppThemeMode() === 'dark';

  return (
    <View style={styles.sectionContainer}>
      <Text
        style={[
          styles.sectionTitle,
          {
            color: isDarkMode ? Colors.white : Colors.black,
          },
        ]}>
        {title}
      </Text>
      <Text
        style={[
          styles.sectionDescription,
          {
            color: isDarkMode ? Colors.light : Colors.dark,
          },
        ]}>
        {children}
      </Text>
    </View>
  );
}

function AssetsSummary() {
  const navigation = useNavigation();
  const colors = useThemeColors();

  return (
    <View
      style={{
        height: '100%',
        flexShrink: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <View
        style={{
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
        }}>
        <Text
          style={{
            fontSize: 18,
            lineHeight: 18,
            color: 'white',
          }}>
          This is Assets Summary, Go to{' '}
          <TouchableView
            onPress={() => {
              navigation.push(RootNames.AccountTransaction, {
                screen: RootNames.MyBundle,
                params: {},
              });
            }}>
            <Text
              style={{
                color: colors['blue-default'],
                fontSize: 18,
                lineHeight: 18,
              }}>
              My Bundle
            </Text>
          </TouchableView>
        </Text>
      </View>
    </View>
  );
}

function AssetsScrollList() {
  const isDarkMode = useGetAppThemeMode() === 'dark';

  const backgroundStyle = {
    backgroundColor: isDarkMode ? Colors.darker : Colors.lighter,
  };

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{
        ...backgroundStyle,
        height: '100%',
      }}>
      <View
        style={{
          backgroundColor: isDarkMode ? Colors.black : Colors.white,
        }}>
        {Array(100)
          .fill(undefined)
          .map((_, idx) => {
            return (
              <Section title="This One Row" key={`psuedo-row-${idx}`}>
                This One Asset Token Row: {idx + 1}
              </Section>
            );
          })}
      </View>
    </ScrollView>
  );
}

function HomeScreen(): JSX.Element {
  const navigation = useNavigation();

  React.useEffect(() => {
    navigation.setOptions({
      headerTitle: () => <HomeScreen.HeaderArea />,
    });
  }, [navigation]);

  return (
    <RootScreenContainer
      style={{ backgroundColor: ScreenColors.homeHeaderBlue }}>
      <View
        style={{
          width: '100%',
          height: 280,
          flexShrink: 0,
        }}>
        <AssetsSummary />
      </View>
      <TestWalletConnectView />
      <AssetsScrollList />
    </RootScreenContainer>
  );
}

HomeScreen.HeaderArea = HeaderArea;

const styles = StyleSheet.create({
  sectionContainer: {
    marginTop: 32,
    paddingHorizontal: 24,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: '600',
  },
  sectionDescription: {
    marginTop: 8,
    fontSize: 18,
    fontWeight: '400',
  },
  highlight: {
    fontWeight: '700',
  },
});

export default HomeScreen;
