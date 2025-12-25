import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { RcIconLogoBlue } from '@/assets/icons/common';
import { useTheme2024, useThemeColors } from '@/hooks/theme';
import { Button } from '@/components2024/Button';
import { useNavigation } from '@react-navigation/native';
import {
  createGetStyles2024,
  makeDebugBorder,
  makeProdBorder,
} from '@/utils/styles';
import NormalScreenContainer from '@/components/ScreenContainer/NormalScreenContainer';
import { FontNames } from '@/core/utils/fonts';
import TickerTexts, { TickItem } from '@/components/Animated/TickerText';
import { Slider } from '@rneui/themed';
import { useCreationWithDeepCompare } from '@/hooks/common/useMemozied';

const NUMS_CONFIG = [
  {
    label: 'USD, CNY, JPY',
    currencies: ['$', '¥'],
  },
  {
    label: 'CNY, EUR',
    currencies: ['¥', '€'],
  },
  {
    label: 'JPY, USD',
    currencies: ['¥', '$'],
  },
];

const CURRENCIES = [
  ...new Set(
    Object.values(NUMS_CONFIG)
      .map(p => p.currencies)
      .flat(),
  ),
];
function getRandom(min: number, max: number) {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function makeNewState(currencies = [...CURRENCIES]) {
  return {
    currency: currencies[getRandom(0, currencies.length - 1)],
    value: getRandom(0, 10000000),
  };
}

function SampleRow({
  animated = false,
  duration = 750,
  refreshTime = 500,
  currencies,
}: {
  animated?: boolean;
  duration?: number;
  refreshTime?: number;
  currencies: string[];
}) {
  const [state, setState] = useState(makeNewState(currencies));

  const timerRef = React.useRef<any | null>(null);
  const cachedcurrencies = useCreationWithDeepCompare(
    () => currencies,
    [currencies],
  );
  useEffect(() => {
    if (animated) {
      timerRef.current = setInterval(() => {
        setState(makeNewState(cachedcurrencies));
      }, refreshTime);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }

    return () => clearInterval(timerRef.current);
  }, [refreshTime, animated, cachedcurrencies]);

  const { styles, colors } = useTheme2024({
    getStyle: getStyles,
    isLight: true,
  });

  return (
    <TickerTexts textStyle={styles.text} duration={duration}>
      <TickItem rotateItems={CURRENCIES}>{state.currency}</TickItem>
      {state.value.toLocaleString()}
    </TickerTexts>
  );
}

function DevUIAnimatedTextAndView(): JSX.Element {
  const { styles, colors2024 } = useTheme2024({
    getStyle: getStyles,
    isLight: true,
  });
  const [animated, setAnimated] = useState(true);
  const [refreshTime, setRefreshTime] = useState(2000);
  const [duration, setDuration] = useState(750);

  return (
    <NormalScreenContainer style={styles.screen}>
      <ScrollView
        nestedScrollEnabled={false}
        contentContainerStyle={styles.screenScrollableView}
        horizontal={false}>
        <Text style={styles.areaTitle}>Animated Text</Text>
        <View
          style={{
            marginBottom: 8,
          }}>
          <View
            style={{
              marginBottom: 20,
              paddingRight: 20,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}>
            <Text style={{ marginRight: 12 }}>
              Refresh Time: {refreshTime.toString().padStart(4, '0')} ms
            </Text>
            <View style={styles.sliderContainer}>
              <View style={styles.sliderWrapper}>
                <Slider
                  value={refreshTime}
                  onValueChange={setRefreshTime}
                  minimumValue={500}
                  maximumValue={5000}
                  step={10}
                  style={styles.slider}
                  // trackStyle={styles.sliderTrack}
                  minimumTrackTintColor={colors2024['brand-default']}
                  maximumTrackTintColor={colors2024['neutral-line']}
                  thumbStyle={styles.thumbStyle}
                  thumbProps={() => {
                    return {
                      children: (
                        <View>
                          <View
                            style={[
                              styles.outerThumb,
                              styles.outerThumbRelative,
                            ]}>
                            <View style={styles.innerThumb} />
                          </View>
                        </View>
                      ),
                    };
                  }}
                />
              </View>
            </View>
          </View>
          <View
            style={{
              marginBottom: 20,
              paddingRight: 20,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}>
            <Text style={{ marginRight: 12 }}>
              Duration: {duration.toString().padStart(4, '0')} ms
            </Text>
            <View style={styles.sliderContainer}>
              <View style={styles.sliderWrapper}>
                <Slider
                  value={duration}
                  onValueChange={setDuration}
                  minimumValue={500}
                  maximumValue={2000}
                  step={10}
                  style={styles.slider}
                  // trackStyle={styles.sliderTrack}
                  minimumTrackTintColor={colors2024['brand-default']}
                  maximumTrackTintColor={colors2024['neutral-line']}
                  thumbStyle={styles.thumbStyle}
                  thumbProps={() => {
                    return {
                      children: (
                        <View>
                          <View
                            style={[
                              styles.outerThumb,
                              styles.outerThumbRelative,
                            ]}>
                            <View style={styles.innerThumb} />
                          </View>
                        </View>
                      ),
                    };
                  }}
                />
              </View>
            </View>
          </View>

          <Button
            style={{ marginBottom: 20 }}
            onPress={() => setAnimated(prev => !prev)}
            type={animated ? 'ghost' : 'primary'}
            title={animated ? 'Stop Animation' : 'Start Animation'}
          />
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator
          contentContainerStyle={styles.showCaseRowsContainer}>
          {NUMS_CONFIG.map((numSample, index) => {
            const key = `numSample-${index}-${numSample.label}`;

            return (
              <View key={key} style={styles.displayRow}>
                <View style={styles.rowHeader}>
                  <Text style={[styles.fontSizeShowCaseLabel]}>
                    {numSample.label}
                  </Text>
                </View>
                <View style={styles.numSamples}>
                  <View
                    style={[
                      styles.numSampleItem,
                      index === 0 && styles.numSampleItemFirstRow,
                      styles.numSampleItemFirstCol,
                    ]}>
                    <SampleRow
                      currencies={numSample.currencies}
                      animated={animated}
                      refreshTime={refreshTime}
                      duration={duration}
                    />
                  </View>
                </View>
              </View>
            );
          })}
        </ScrollView>
      </ScrollView>
    </NormalScreenContainer>
  );
}

const ROW_CELL_H = 120;

const getStyles = createGetStyles2024(ctx => {
  return {
    screen: {
      backgroundColor: ctx.colors['neutral-card1'],
      flexDirection: 'column',
      justifyContent: 'center',
      // height: '100%',
    },
    areaTitle: {
      fontSize: 36,
      marginBottom: 12,
      color: ctx.colors2024['neutral-title-1'],
    },
    sliderContainer: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
      position: 'relative',
      gap: 8,
    },
    sliderWrapper: {
      flex: 1,
    },
    slider: {
      height: 4,
    },
    sliderTrack: {
      height: 4,
      borderRadius: 2,
    },
    // For bubble slider
    thumbStyle: {
      justifyContent: 'center',
      alignItems: 'center',
      width: 14,
      height: 14,
      backgroundColor: ctx.colors2024['blue-default'],
    },
    outerThumb: {
      width: 14,
      height: 14,
      borderRadius: 14,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: ctx.colors2024['neutral-bg-1'],
    },
    outerThumbRelative: {
      position: 'relative',
    },
    innerThumb: {
      width: 10,
      height: 10,
      borderRadius: 10,
      backgroundColor: ctx.colors2024['brand-default'],
    },

    screenScrollableView: {
      // height: '100%',
      flexDirection: 'column',
      justifyContent: 'flex-start',
      marginTop: 0,
      paddingHorizontal: 12,
      // ...makeDebugBorder(),
    },
    showCaseRowsContainer: {
      flexDirection: 'column',
      alignItems: 'flex-start',
      justifyContent: 'flex-start',
      maxHeight: '100%',
    },
    displayRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
    },
    rowHeader: {
      width: 120,
      alignItems: 'flex-start',
      justifyContent: 'center',
    },
    fontSizeShowCaseLabel: {
      fontSize: 20,
      // lineHeight: 36,
      maxWidth: 100,
      flexWrap: 'wrap',
      height: ROW_CELL_H,

      justifyContent: 'center',
    },
    text: {
      fontFamily: 'SF Pro Rounded',
      fontSize: 40,
      lineHeight: 48,
      fontWeight: '900',
      color: ctx.colors2024['neutral-title-1'],
    },
    numSamples: {
      display: 'flex',
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'flex-start',
      marginLeft: 0,
      height: '100%',
    },
    numSampleItem: {
      flexDirection: 'column',
      alignItems: 'flex-start',
      justifyContent: 'flex-start',
      width: 150,
      maxWidth: 150,
      height: ROW_CELL_H,

      borderBottomWidth: 1,
      borderBottomColor: ctx.colors['neutral-body'],
      borderLeftWidth: 1,
      borderLeftColor: ctx.colors['neutral-body'],
    },
    numSampleItemFirstRow: {
      borderTopWidth: 1,
      borderTopColor: ctx.colors['neutral-body'],
    },
    numSampleItemFirstCol: {
      borderLeftWidth: 0,
    },
    numSampleInner: {
      paddingLeft: 12,
      height: '100%',
      alignItems: 'flex-start',
      justifyContent: 'center',
    },

    showCaseColsContainer: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'flex-start',
      gap: 12,
      paddingBottom: 24,
    },
  };
});

export default DevUIAnimatedTextAndView;
