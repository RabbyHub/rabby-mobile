/**
 * Sample React Native HomeScreen
 * https://github.com/facebook/react-native
 *
 * @format
 */
import {RcIconHeaderSettings, RcIconSignatureRecord} from '@/assets/icons/home';
import RootScreenContainer from '@/components/ScreenContainer/RootScreenContainer';
import {ScreenLayouts} from '@/constant/layout';
import {useThemeColors} from '@/hooks/theme';
import React from 'react';
import type {PropsWithChildren} from 'react';
import {
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from 'react-native';

import {
  Colors,
  DebugInstructions,
  LearnMoreLinks,
  ReloadInstructions,
} from 'react-native/Libraries/NewAppScreen';

type SectionProps = PropsWithChildren<{
  title: string;
}>;

function Section({children, title}: SectionProps): JSX.Element {
  const isDarkMode = useColorScheme() === 'dark';

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

function HeaderArea() {
  const colors = useThemeColors();

  return (
    <View
      style={{
        height: 44,
        paddingLeft: 20,
        paddingRight: 20,
        flexDirection: 'row',
        justifyContent: 'space-between',
        flexShrink: 0,
      }}>
      <View
        style={{
          // width: 255,
          width: '100%',
          flexShrink: 1,
          padding: 8,
          flexDirection: 'row',
          justifyContent: 'center',
          alignItems: 'center',
          borderRadius: 6,
          backgroundColor: 'rgba(255, 255, 255, 0.10)',
        }}>
        <Text
          style={{
            color: colors['neutral-title-2'],
            fontFamily: 'SF Pro',
            fontSize: 16,
            fontStyle: 'normal',
            fontWeight: '500',
          }}>
          Left Account Switcher
        </Text>
      </View>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingLeft: 38,
          flexShrink: 0,
        }}>
        <RcIconSignatureRecord />
        <RcIconHeaderSettings style={{marginLeft: 16}} />
      </View>
    </View>
  );
}

function AssetsSummary() {
  return (
    <View
      style={{
        height: '100%',
        flexShrink: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <Text
        style={{
          fontSize: 18,
          color: 'white',
        }}>
        This is Assets Summary
      </Text>
    </View>
  );
}

function AssetsScrollList() {
  const isDarkMode = useColorScheme() === 'dark';

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
  const isDarkMode = useColorScheme() === 'dark';

  const backgroundStyle = {
    backgroundColor: isDarkMode ? Colors.darker : Colors.lighter,
  };

  return (
    <SafeAreaView style={backgroundStyle}>
      <RootScreenContainer>
        <View
          style={{
            backgroundColor: '#434EB9',
            width: '100%',
            height: 280,
            flexShrink: 0,
          }}>
          <HeaderArea />
          <AssetsSummary />
        </View>
        <AssetsScrollList />
      </RootScreenContainer>
    </SafeAreaView>
  );
}

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
