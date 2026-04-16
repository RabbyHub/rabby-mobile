/**
 * Sample React Native SampleScreen
 * https://github.com/facebook/react-native
 *
 * @format
 */

import React from 'react';
import type { PropsWithChildren } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, View } from 'react-native';
import { useThemeColors } from '@/hooks/theme';
import { Text } from '@/components/Typography';

// Local components (react-native/Libraries/NewAppScreen was removed in RN 0.81+)
const Header = () => (
  <View style={localStyles.header}>
    <Text style={localStyles.headerText}>Welcome to React Native</Text>
  </View>
);

const ReloadInstructions = () => (
  <Text>Press Cmd + R on iOS or Cmd + M on Android to reload.</Text>
);

const DebugInstructions = () => (
  <Text>
    Press Cmd + D on iOS or Cmd + M on Android to open developer menu.
  </Text>
);

const LearnMoreLinks = () => (
  <View style={localStyles.links}>
    <Text>Learn more at reactnative.dev</Text>
  </View>
);

const localStyles = StyleSheet.create({
  header: {
    padding: 20,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
  },
  headerText: {
    fontSize: 24,
    fontWeight: '600',
  },
  links: {
    padding: 20,
  },
});

type SectionProps = PropsWithChildren<{
  title: string;
}>;

function Section({ children, title }: SectionProps): JSX.Element {
  const colors = useThemeColors();

  return (
    <View style={styles.sectionContainer}>
      <Text
        style={[
          styles.sectionTitle,
          {
            color: colors['neutral-title-1'],
          },
        ]}>
        {title}
      </Text>
      <Text
        style={[
          styles.sectionDescription,
          {
            color: colors['neutral-body'],
          },
        ]}>
        {children}
      </Text>
    </View>
  );
}

function SampleScreen(): JSX.Element {
  const colors = useThemeColors();

  const backgroundStyle = {
    backgroundColor: colors['neutral-bg-1'],
  };

  return (
    <SafeAreaView style={backgroundStyle}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        style={backgroundStyle}>
        <Header />
        <View
          style={{
            backgroundColor: colors['neutral-bg-1'],
          }}>
          <Section title="Step One">
            Edit <Text style={styles.highlight}>SampleScreen.tsx</Text> to
            change this screen and then come back to see your edits.
          </Section>
          <Section title="See Your Changes">
            <ReloadInstructions />
          </Section>
          <Section title="Debug">
            <DebugInstructions />
          </Section>
          <Section title="Learn More">
            Read the docs to discover what to do next:
          </Section>
          <LearnMoreLinks />
        </View>
      </ScrollView>
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

export default SampleScreen;
