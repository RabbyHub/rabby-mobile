import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { RcIconLogoBlue } from '@/assets/icons/common';
import { useTheme2024, useThemeColors } from '@/hooks/theme';
// import { Button } from '@rneui/themed';
// import { Button } from '@/components/Button';
import { Button } from '@/components2024/Button';
import { useNavigation } from '@react-navigation/native';
import {
  createGetStyles2024,
  makeDebugBorder,
  makeProdBorder,
} from '@/utils/styles';
import TouchableText from '@/components/Touchable/TouchableText';
import NormalScreenContainer from '@/components/ScreenContainer/NormalScreenContainer';
import { FontNames } from '@/core/utils/fonts';
import { ThemeColors, ThemeColors2024 } from '@/constant/theme';

const FONTS_CONFIG = [
  {
    label: 'System',
    fontFamily: 'System',
    fontSizes: [24, 22, 20, 18, 16, 14].reverse(),
  },
  {
    label: 'SF Pro Rounded Regular',
    fontFamily: FontNames.sf_pro_rounded_regular,
    fontSizes: [24, 22, 20, 18, 16, 14].reverse(),
  },
  {
    label: 'SF Pro Rounded Medium',
    fontFamily: FontNames.sf_pro_rounded_medium,
    fontSizes: [24, 22, 20, 18, 16, 14].reverse(),
  },
  {
    label: 'SF Pro Rounded Bold',
    fontFamily: FontNames.sf_pro_rounded_bold,
    fontSizes: [24, 22, 20, 18, 16, 14].reverse(),
  },
  {
    label: 'SF Pro Rounded Heavy',
    fontFamily: FontNames.sf_pro_rounded_heavy,
    fontSizes: [24, 22, 20, 18, 16, 14].reverse(),
  },
];

const COLORS_CONFIG = [
  {
    label: 'Classical Light',
    colors: ThemeColors.light,
  },
  {
    label: 'Classical Dark',
    colors: ThemeColors.dark,
    isDark: true,
  },
  {
    label: '2024 Light',
    colors: ThemeColors2024.light,
  },
  {
    label: '2024 Dark',
    colors: ThemeColors2024.dark,
    isDark: true,
  },
];

function DevUIFontShowCase(): JSX.Element {
  const { styles, colors } = useTheme2024({
    getStyle: getStyles,
    isLight: true,
  });

  const navigation = useNavigation();

  return (
    <NormalScreenContainer style={styles.screen}>
      <ScrollView
        nestedScrollEnabled={false}
        contentContainerStyle={styles.screenScrollableView}
        horizontal={false}>
        <Text style={styles.areaTitle}>Fonts</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator
          contentContainerStyle={styles.showCaseRowsContainer}>
          {FONTS_CONFIG.map((fontConfig, index) => {
            const key = `fontConfig-${index}-${fontConfig.label}`;
            const ffStyle = { fontFamily: fontConfig.fontFamily };
            const fontSizes = fontConfig.fontSizes;

            return (
              <View key={key} style={styles.displayRow}>
                <View style={styles.rowHeader}>
                  <Text style={[styles.fontSizeShowCaseLabel, ffStyle]}>
                    {fontConfig.label}
                  </Text>
                </View>
                {/* <View style={styles.logoWrapper}>
                  <RcIconLogoBlue
                    style={{ width: LOGO_SIZE.width, height: LOGO_SIZE.height }}
                  />
                </View> */}
                <View style={styles.fontSizeSamples}>
                  {fontSizes.map((fontSize, l2_index) => {
                    const fzKey = `fontSize-${l2_index}`;
                    return (
                      <View
                        key={fzKey}
                        style={[
                          styles.fontSizeSampleItem,
                          index === 0 && styles.fontSizeSampleItemFirstRow,
                          l2_index === 0 && styles.fontSizeSampleItemFirstCol,
                        ]}>
                        <View style={styles.fontSizeSampleInner}>
                          <Text
                            style={[
                              { fontSize, lineHeight: fontSize },
                              ffStyle,
                            ]}>
                            Font Size: {fontSize}
                          </Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </View>
            );
          })}
        </ScrollView>

        <Text style={[styles.areaTitle, { marginTop: 24 }]}>Colors</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator
          contentContainerStyle={styles.showCaseColsContainer}>
          {COLORS_CONFIG.map((colorConfig, index) => {
            const key = `colorConfig-${index}-${colorConfig.label}`;
            const ffStyle = { fontFamily: 'system' };
            const colors = colorConfig.colors;

            return (
              <View key={key} style={styles.displayCol}>
                <View style={styles.colHeader}>
                  <Text style={[styles.fontColorShowCaseLabel, ffStyle]}>
                    {colorConfig.label}
                  </Text>
                </View>
                <View style={styles.fontColorSamples}>
                  {Object.entries(colors).map(([key, hexValue], l2_index) => {
                    const fzKey = `fontColor-${l2_index}`;
                    return (
                      <View key={fzKey} style={[styles.fontColorSampleItem]}>
                        <View
                          style={[
                            styles.fontColorSampleInner,
                            // {
                            //   backgroundColor: colorConfig.isDark
                            //     ? ThemeColors.light['neutral-bg1']
                            //     : ThemeColors.dark['neutral-bg1'],
                            // },
                          ]}>
                          <Text
                            style={[
                              ffStyle,
                              {
                                fontSize: 18,
                                lineHeight: 18,
                                color: colorConfig.isDark
                                  ? ThemeColors.dark['neutral-black']
                                  : ThemeColors.light['neutral-black'],
                              },
                            ]}>
                            {key}:
                          </Text>
                          <Text style={{ color: hexValue }}>{hexValue}</Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </View>
            );
          })}
        </ScrollView>
      </ScrollView>
    </NormalScreenContainer>
  );
}

const LOGO_SIZE = {
  wrapperWidth: 156,
  wrapperHeight: 156,
  width: 86,
  height: 76,
};

const ROW_CELL_H = 120;

const getStyles = createGetStyles2024(ctx =>
  StyleSheet.create({
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
    screenScrollableView: {
      // height: '100%',
      flexDirection: 'column',
      justifyContent: 'flex-start',
      marginTop: 12,
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
    logoWrapper: {
      marginTop: 12,
      marginBottom: 12,
      // width: LOGO_SIZE.wrapperWidth,
      // height: LOGO_SIZE.wrapperHeight,
      justifyContent: 'flex-start',
      alignItems: 'center',
      // // leave here for debug
      // ...makeDebugBorder('red'),
    },
    fontSizeSamples: {
      display: 'flex',
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'flex-start',
      marginLeft: 12,
      height: '100%',
    },
    fontSizeSampleItem: {
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
    fontSizeSampleItemFirstRow: {
      borderTopWidth: 1,
      borderTopColor: ctx.colors['neutral-body'],
    },
    fontSizeSampleItemFirstCol: {
      borderLeftWidth: 0,
    },
    fontSizeSampleInner: {
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
    displayCol: {
      flexDirection: 'column',
      alignItems: 'flex-start',
      justifyContent: 'center',
      width: 140,
      // ...makeDebugBorder(),
    },
    colHeader: {
      width: '100%',
      justifyContent: 'flex-start',
      alignItems: 'flex-start',
      // ...makeDebugBorder(),
    },
    fontColorShowCaseLabel: {
      fontSize: 20,
      lineHeight: 28,
      maxWidth: 150,
      flexWrap: 'wrap',
      height: 60,
      alignSelf: 'flex-start',
      // ...makeDebugBorder('red'),
    },
    fontColorSamples: {
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'flex-start',
    },
    fontColorSampleItem: {
      flexDirection: 'column',
      alignItems: 'flex-start',
      justifyContent: 'flex-start',
      paddingTop: 12,
    },
    fontColorSampleInner: {},
  }),
);

export default DevUIFontShowCase;
