import { ThemeColors, ThemeColors2024 } from '@/constant/theme';
import {
  BOTTOM_BUTTON_BOTTOM_OFFSET,
  getBottomButtonBottomOffset,
} from '@/constant/layout';
import { FontNames } from '@/core/utils/fonts';
import { StyleSheet } from 'react-native';

import { getPerpsProTransferSheetStyles } from './PerpsProTransferSheet.styles';

const getStyles = (isLight: boolean) =>
  getPerpsProTransferSheetStyles.getStyles({
    classicalColors: isLight ? ThemeColors.light : ThemeColors.dark,
    colors: isLight ? ThemeColors.light : ThemeColors.dark,
    colors2024: isLight ? ThemeColors2024.light : ThemeColors2024.dark,
    isLight,
    safeAreaInsets: { bottom: 0, left: 0, right: 0, top: 0 },
  });

describe('PerpsProTransferSheet Figma styles', () => {
  it('matches the exact Light geometry, typography, surfaces, and button treatment', () => {
    const styles = getStyles(true);

    expect(StyleSheet.flatten(styles.handle)).toMatchObject({
      height: 40,
      paddingBottom: 30,
      paddingTop: 6,
    });
    expect(StyleSheet.flatten(styles.handleIndicator)).toMatchObject({
      backgroundColor: '#D1D4DB',
      borderRadius: 2,
      height: 4,
      width: 40,
    });
    expect(StyleSheet.flatten(styles.title)).toMatchObject({
      fontFamily: FontNames.sf_pro,
      fontSize: 16,
      fontWeight: '700',
      lineHeight: 20,
    });
    expect(StyleSheet.flatten(styles.directionCard)).toMatchObject({
      backgroundColor: '#F4F5F5',
      borderRadius: 6,
      height: 76,
    });
    expect(StyleSheet.flatten(styles.amountHeader)).toMatchObject({
      paddingRight: 13,
    });
    expect(StyleSheet.flatten(styles.amountField)).toMatchObject({
      backgroundColor: '#F4F5F5',
      borderRadius: 6,
      height: 72,
    });
    expect(StyleSheet.flatten(styles.tokenPill)).toMatchObject({
      borderColor: ThemeColors2024.light['neutral-info'],
      borderRadius: 8,
      borderWidth: 0.5,
      height: 40,
      width: 100,
    });
    expect(StyleSheet.flatten(styles.shortcuts)).toMatchObject({
      gap: 8,
      paddingLeft: 3,
    });
    expect(StyleSheet.flatten(styles.shortcut)).toMatchObject({
      backgroundColor: '#F4F5F5',
      borderRadius: 6,
      height: 40,
    });
    expect(StyleSheet.flatten(styles.shortcutText)).toMatchObject({
      fontFamily: FontNames.sf_pro,
      fontSize: 12,
      fontWeight: '500',
      lineHeight: 16,
    });
    expect(StyleSheet.flatten(styles.confirmButton)).toMatchObject({
      borderRadius: 8,
      elevation: 4,
      shadowColor: 'rgba(112, 132, 255, 0.1)',
      shadowOffset: { height: 8, width: 0 },
      shadowOpacity: 1,
      shadowRadius: 12,
    });
    expect(StyleSheet.flatten(styles.footer)).toMatchObject({
      paddingBottom:
        getBottomButtonBottomOffset(0) - (BOTTOM_BUTTON_BOTTOM_OFFSET - 30),
      paddingTop: 12,
    });
  });

  it('keeps the approved Dark surfaces and handle token', () => {
    const styles = getStyles(false);

    expect(StyleSheet.flatten(styles.directionCard)).toMatchObject({
      backgroundColor: ThemeColors2024.dark['neutral-bg-2'],
    });
    expect(StyleSheet.flatten(styles.amountField)).toMatchObject({
      backgroundColor: ThemeColors2024.dark['neutral-bg-2'],
    });
    expect(StyleSheet.flatten(styles.shortcut)).toMatchObject({
      backgroundColor: ThemeColors2024.dark['neutral-bg-2'],
    });
    expect(StyleSheet.flatten(styles.handleIndicator)).toMatchObject({
      backgroundColor: ThemeColors2024.dark['neutral-line'],
    });
  });
});
