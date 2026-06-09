import React, { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import NormalScreenContainer from '@/components/ScreenContainer/NormalScreenContainer';
import { Text } from '@/components/Typography';
import { Button } from '@/components2024/Button';
import { CheckBoxRect } from '@/components2024/CheckBox';
import { PillsSwitch } from '@/components2024/PillSwitch';
import { Radio } from '@/components2024/Radio';
import { NextSearchBar } from '@/components2024/SearchBar';
import { E2E_ID } from '@/constant/e2e';
import { useTheme2024 } from '@/hooks/theme';
import TouchableView from '@/components/Touchable/TouchableView';
import { makeTestIDProps } from '@/utils/makeTestIDProps';
import { createGetStyles2024 } from '@/utils/styles';
import AnimatedTickerText from '@/components/Animated/AnimatedTickerText';
import { useSharedValue } from 'react-native-reanimated';

const PILLS_OPTIONS = [
  {
    key: 'portfolio',
    label: 'Portfolio',
    testID: E2E_ID.playground.components2024PillsPortfolio,
  },
  {
    key: 'activity',
    label: 'Activity',
    testID: E2E_ID.playground.components2024PillsActivity,
  },
] as const;

type PillOptionKey = (typeof PILLS_OPTIONS)[number]['key'];
type RadioOptionKey = 'alpha' | 'beta';

const TICKER_SAMPLE_VALUES = [
  '$1,111.11',
  '$8,888.88',
  '<$0.01',
  '-$12,345.67',
  '$1.23K',
  '$45.67M',
  '$890.12B',
  '$3.45T',
];

const TICKER_GLYPHS = [
  '0',
  '1',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  ',',
  '.',
  '<',
  '-',
  '+',
  '$',
  '€',
  '£',
  '¥',
  '₩',
  '₹',
  '₽',
  '₺',
  '฿',
  '₫',
  'K',
  'M',
  'B',
  'T',
  ' ',
];

function Section({
  title,
  children,
}: React.PropsWithChildren<{
  title: string;
}>) {
  const { styles } = useTheme2024({ getStyle: getStyles });

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function TickerGlyphCell({ glyph }: { glyph: string }) {
  const { styles } = useTheme2024({ getStyle: getStyles });
  const value = useSharedValue(glyph);

  useEffect(() => {
    value.value = glyph;
  }, [glyph, value]);

  return (
    <View style={styles.tickerGlyphCell}>
      <AnimatedTickerText
        value={value}
        maxLength={1}
        duration={320}
        lineHeight={46}
        style={styles.tickerText}
        containerStyle={styles.tickerGlyphValue}
        fontSizeByLength={{
          maxFontSize: 38,
          minFontSize: 38,
          threshold: 1,
        }}
      />
      <Text style={styles.tickerGlyphLabel}>
        {glyph === ' ' ? '[space]' : glyph}
      </Text>
    </View>
  );
}

function AnimatedTickerTextShowCase() {
  const { styles } = useTheme2024({ getStyle: getStyles });
  const value = useSharedValue(TICKER_SAMPLE_VALUES[0]);

  useEffect(() => {
    let index = 0;
    const timer = setInterval(() => {
      index = (index + 1) % TICKER_SAMPLE_VALUES.length;
      value.value = TICKER_SAMPLE_VALUES[index];
    }, 1400);

    return () => {
      clearInterval(timer);
    };
  }, [value]);

  return (
    <>
      <View style={styles.tickerPreviewBox}>
        <AnimatedTickerText
          value={value}
          maxLength={16}
          duration={320}
          lineHeight={46}
          style={styles.tickerText}
          fontSizeByLength={{
            maxFontSize: 38,
            minFontSize: 34,
            threshold: 9,
          }}
        />
      </View>
      <View style={styles.tickerGlyphGrid}>
        {TICKER_GLYPHS.map(glyph => (
          <TickerGlyphCell
            key={glyph === ' ' ? 'space' : `glyph-${glyph}`}
            glyph={glyph}
          />
        ))}
      </View>
    </>
  );
}

function DevUIComponents2024ShowCase(): JSX.Element {
  const { styles, colors, colors2024 } = useTheme2024({
    getStyle: getStyles,
    isLight: true,
  });
  const [buttonPressCount, setButtonPressCount] = useState(0);
  const [isLoadingButtonBusy, setIsLoadingButtonBusy] = useState(false);
  const [isChecked, setIsChecked] = useState(false);
  const [selectedRadio, setSelectedRadio] = useState<RadioOptionKey>('alpha');
  const [selectedTab, setSelectedTab] = useState<PillOptionKey>('portfolio');
  const [query, setQuery] = useState('');
  const loadingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (loadingTimerRef.current) {
        clearTimeout(loadingTimerRef.current);
      }
    };
  }, []);

  return (
    <NormalScreenContainer
      style={styles.screen}
      noHeader
      overwriteStyle={{ backgroundColor: colors['neutral-card-1'] }}>
      <ScrollView
        nestedScrollEnabled
        contentContainerStyle={styles.screenScrollableView}
        horizontal={false}
        {...makeTestIDProps(E2E_ID.playground.components2024Screen)}>
        <Text style={styles.areaTitle}>2024 Components</Text>
        <Text style={styles.summaryText}>
          Stable interaction samples for `components2024`, intended for UI
          verification and Maestro smoke coverage.
        </Text>

        <Section title="Button">
          <View style={styles.row}>
            <Button
              title="Primary button"
              onPress={() => {
                setButtonPressCount(prev => prev + 1);
              }}
              containerStyle={styles.buttonContainer}
              {...makeTestIDProps(
                E2E_ID.playground.components2024ButtonPrimary,
              )}
            />
            <Button
              title="Loading button"
              loading={isLoadingButtonBusy}
              onPress={() => {
                setIsLoadingButtonBusy(true);
                if (loadingTimerRef.current) {
                  clearTimeout(loadingTimerRef.current);
                }
                loadingTimerRef.current = setTimeout(() => {
                  setIsLoadingButtonBusy(false);
                }, 1200);
              }}
              containerStyle={styles.buttonContainer}
              type="ghost"
              {...makeTestIDProps(
                E2E_ID.playground.components2024ButtonLoading,
              )}
            />
          </View>

          <Text
            style={styles.stateText}
            {...makeTestIDProps(
              E2E_ID.playground.components2024ButtonPressCount,
            )}>
            {`Button presses: ${buttonPressCount}`}
          </Text>
          <Text
            style={styles.stateText}
            {...makeTestIDProps(
              E2E_ID.playground.components2024ButtonLoadingState,
            )}>
            {`Loading state: ${isLoadingButtonBusy ? 'busy' : 'idle'}`}
          </Text>
        </Section>

        <Section title="CheckBoxRect">
          <TouchableView
            style={styles.checkboxRow}
            onPress={() => {
              setIsChecked(prev => !prev);
            }}
            {...makeTestIDProps(
              E2E_ID.playground.components2024CheckboxToggle,
            )}>
            <CheckBoxRect checked={isChecked} size={24} />
            <Text style={styles.checkboxLabel}>
              Tap to toggle checkbox state
            </Text>
          </TouchableView>

          <Text
            style={styles.stateText}
            {...makeTestIDProps(E2E_ID.playground.components2024CheckboxState)}>
            {`Checkbox state: ${isChecked ? 'checked' : 'unchecked'}`}
          </Text>
        </Section>

        <Section title="Radio">
          <Radio
            title="Alpha option"
            checked={selectedRadio === 'alpha'}
            onPress={() => {
              setSelectedRadio('alpha');
            }}
            checkedColor={colors2024['brand-default']}
            textStyle={styles.radioLabel}
            {...makeTestIDProps(E2E_ID.playground.components2024RadioAlpha)}
          />
          <Radio
            title="Beta option"
            checked={selectedRadio === 'beta'}
            onPress={() => {
              setSelectedRadio('beta');
            }}
            checkedColor={colors2024['brand-default']}
            textStyle={styles.radioLabel}
            {...makeTestIDProps(E2E_ID.playground.components2024RadioBeta)}
          />

          <Text
            style={styles.stateText}
            {...makeTestIDProps(E2E_ID.playground.components2024RadioState)}>
            {`Radio selection: ${selectedRadio}`}
          </Text>
        </Section>

        <Section title="PillsSwitch">
          <PillsSwitch
            value={selectedTab}
            options={PILLS_OPTIONS}
            onTabChange={key => {
              setSelectedTab(key);
            }}
            containerStyle={styles.pillsContainer}
            {...makeTestIDProps(E2E_ID.playground.components2024PillsContainer)}
          />

          <Text
            style={styles.stateText}
            {...makeTestIDProps(E2E_ID.playground.components2024PillsState)}>
            {`Pills selection: ${selectedTab}`}
          </Text>
        </Section>

        <Section title="AnimatedTickerText">
          <AnimatedTickerTextShowCase />
        </Section>

        <Section title="NextSearchBar">
          <NextSearchBar
            value={query}
            onChangeText={text => {
              setQuery(text);
            }}
            onCancel={() => {
              setQuery('');
            }}
            placeholder="Search components"
            alwaysShowCancel
            {...makeTestIDProps(E2E_ID.playground.components2024SearchInput)}
          />

          <Text
            style={styles.stateText}
            {...makeTestIDProps(E2E_ID.playground.components2024SearchState)}>
            {`Search query: ${query || 'empty'}`}
          </Text>
        </Section>
      </ScrollView>
    </NormalScreenContainer>
  );
}

const getStyles = createGetStyles2024(ctx =>
  StyleSheet.create({
    screen: {
      backgroundColor: ctx.colors['neutral-card1'],
      flexDirection: 'column',
      justifyContent: 'center',
    },
    screenScrollableView: {
      paddingHorizontal: 12,
      paddingTop: 16,
      paddingBottom: 64,
      gap: 20,
    },
    areaTitle: {
      fontSize: 36,
      color: ctx.colors2024['neutral-title-1'],
    },
    summaryText: {
      color: ctx.colors2024['neutral-secondary'],
      fontSize: 14,
      lineHeight: 20,
      marginTop: -8,
    },
    section: {
      backgroundColor: ctx.colors2024['neutral-bg-1'],
      borderRadius: 16,
      padding: 16,
      gap: 12,
    },
    sectionTitle: {
      color: ctx.colors2024['brand-default'],
      fontSize: 22,
      fontWeight: '700',
    },
    row: {
      flexDirection: 'row',
      gap: 12,
      flexWrap: 'wrap',
    },
    buttonContainer: {
      flex: 1,
      minWidth: 150,
    },
    stateText: {
      color: ctx.colors2024['neutral-title-1'],
      fontSize: 15,
      lineHeight: 20,
    },
    checkboxRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 4,
    },
    checkboxLabel: {
      color: ctx.colors2024['neutral-title-1'],
      fontSize: 16,
      lineHeight: 20,
      flexShrink: 1,
    },
    radioLabel: {
      color: ctx.colors2024['neutral-title-1'],
      fontSize: 16,
      fontWeight: '600',
    },
    pillsContainer: {
      alignSelf: 'flex-start',
    },
    tickerPreviewBox: {
      alignSelf: 'flex-start',
      minWidth: 220,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 10,
      backgroundColor: ctx.colors2024['neutral-bg-2'],
    },
    tickerText: {
      lineHeight: 46,
      fontWeight: '900',
      color: ctx.colors2024['neutral-title-1'],
      fontFamily: 'SF Pro Rounded',
    },
    tickerGlyphGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    tickerGlyphCell: {
      width: 56,
      height: 82,
      borderRadius: 8,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: ctx.colors2024['neutral-line'],
      backgroundColor: ctx.colors2024['neutral-bg-2'],
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
    },
    tickerGlyphValue: {
      height: 46,
      justifyContent: 'center',
    },
    tickerGlyphLabel: {
      fontSize: 11,
      lineHeight: 14,
      color: ctx.colors2024['neutral-secondary'],
    },
  }),
);

export default DevUIComponents2024ShowCase;
