import { ThemeColors, ThemeColors2024 } from '@/constant/theme';
import { getBottomButtonBottomOffset } from '@/constant/layout';
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
      paddingBottom: 23.727184,
      paddingTop: 10,
    });
    expect(StyleSheet.flatten(styles.handleIndicator)).toMatchObject({
      backgroundColor: ThemeColors2024.light['neutral-sheet-handle'],
      borderRadius: 3.136408,
      height: 6.272816,
      width: 50.182529,
    });
    expect(StyleSheet.flatten(styles.title)).toMatchObject({
      fontFamily: 'SF Pro Rounded',
      fontSize: 20,
      fontWeight: '800',
      lineHeight: 24,
    });
    expect(StyleSheet.flatten(styles.directionCard)).toMatchObject({
      backgroundColor: ThemeColors2024.light['neutral-bg-1'],
      borderRadius: 12,
      height: 92,
    });
    expect(StyleSheet.flatten(styles.amountField)).toMatchObject({
      backgroundColor: ThemeColors2024.light['neutral-bg-1'],
      borderRadius: 16,
      height: 82,
    });
    expect(StyleSheet.flatten(styles.tokenPill)).toMatchObject({
      backgroundColor: ThemeColors2024.light['neutral-bg-5'],
      borderRadius: 8,
      height: 40,
      width: 99,
    });
    expect(StyleSheet.flatten(styles.shortcuts)).toMatchObject({
      gap: 8,
      marginTop: 4,
    });
    expect(StyleSheet.flatten(styles.shortcut)).toMatchObject({
      backgroundColor: ThemeColors2024.light['neutral-bg-1'],
      borderRadius: 6,
      height: 40,
    });
    expect(StyleSheet.flatten(styles.shortcutText)).toMatchObject({
      fontFamily: 'SF Pro Rounded',
      fontSize: 14,
      fontWeight: '500',
      lineHeight: 18,
    });
    expect(StyleSheet.flatten(styles.button)).toMatchObject({
      borderRadius: 12,
      elevation: 4,
      shadowColor: 'rgba(112, 132, 255, 0.1)',
      shadowOffset: { height: 8, width: 0 },
      shadowOpacity: 1,
      shadowRadius: 12,
    });
    expect(StyleSheet.flatten(styles.footer)).toMatchObject({
      paddingBottom: getBottomButtonBottomOffset(0),
      paddingTop: 24,
    });
  });

  it('keeps the approved Dark surfaces and handle token', () => {
    const styles = getStyles(false);

    expect(StyleSheet.flatten(styles.directionCard)).toMatchObject({
      backgroundColor: ThemeColors2024.dark['neutral-bg-1'],
    });
    expect(StyleSheet.flatten(styles.amountField)).toMatchObject({
      backgroundColor: ThemeColors2024.dark['neutral-bg-1'],
    });
    expect(StyleSheet.flatten(styles.shortcut)).toMatchObject({
      backgroundColor: ThemeColors2024.dark['neutral-bg-1'],
    });
    expect(StyleSheet.flatten(styles.handleIndicator)).toMatchObject({
      backgroundColor: ThemeColors2024.dark['neutral-sheet-handle'],
    });
  });
});
