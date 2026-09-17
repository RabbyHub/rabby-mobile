import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { colord } from 'colord';
import { Button } from '@/components2024/Button';
import { ThemeColors2024 } from '@/constant/theme';
import {
  getPerpsProDialogActionStyles,
  PERPS_PRO_DIALOG_TOKENS,
} from './perpsProDialogVisual';

let mockThemeMode: 'light' | 'dark' = 'light';

jest.mock('@/components/Typography', () => ({
  Text: require('react-native').Text,
}));
jest.mock('react-native-size-matters', () => ({
  moderateScale: (value: number) => value,
}));

jest.mock(
  '@/assets2024/icons/swap/loading-cc.svg',
  () => require('react-native').View,
);
jest.mock('@/hooks/theme', () => ({
  useTheme2024: ({ getStyle }: any = {}) => {
    const colors2024 =
      require('@/constant/theme').ThemeColors2024[mockThemeMode];
    const context = {
      colors2024,
      isLight: mockThemeMode === 'light',
      safeAreaInsets: { bottom: 0 },
    };
    return { ...context, styles: getStyle?.getStyles(context) };
  },
}));

describe.each(['light', 'dark'] as const)('Pro primary action (%s)', mode => {
  it.each([40, 52])(
    'keeps the real %ipx Button paints and press guard correct across disabled/loading/recovery',
    height => {
      mockThemeMode = mode;
      const styles = getPerpsProDialogActionStyles(ThemeColors2024[mode]);
      const onPress = jest.fn();
      const content = (disabled: boolean, loading: boolean) => (
        <Button
          buttonStyle={[
            styles.button,
            (disabled || loading) && styles.buttonDisabled,
          ]}
          disabled={disabled}
          disabledTitleStyle={styles.buttonDisabledTitle}
          height={height}
          loading={loading}
          loadingProps={{ color: styles.buttonDisabledTitle.color }}
          onPress={onPress}
          title="Confirm"
          titleStyle={styles.buttonTitle}
          type="primary"
        />
      );
      const view = render(content(false, false));
      const readButtonStyle = () => {
        const stylesInTree = screen
          .UNSAFE_getAllByType(View)
          .map(node => StyleSheet.flatten(node.props.style));
        return stylesInTree.find(style => style?.borderWidth === 1)!;
      };
      expect(readButtonStyle()).toMatchObject({
        height,
        backgroundColor: PERPS_PRO_DIALOG_TOKENS.actionBackground,
      });
      fireEvent.press(screen.getByRole('button'));
      expect(onPress).toHaveBeenCalledTimes(1);

      for (const [disabled, loading] of [
        [true, false],
        [true, true],
        [false, true],
      ]) {
        view.rerender(content(disabled, loading));
        const actual = readButtonStyle();
        expect(colord(actual.backgroundColor as string).toRgb()).toEqual({
          ...colord(PERPS_PRO_DIALOG_TOKENS.actionBackground).toRgb(),
          a: 0.4,
        });
        expect(actual.opacity).toBeUndefined();
        if (loading) {
          expect(screen.UNSAFE_getByType(ActivityIndicator).props.color).toBe(
            PERPS_PRO_DIALOG_TOKENS.actionForeground,
          );
        } else {
          expect(
            StyleSheet.flatten(screen.getByText('Confirm').props.style).color,
          ).toBe(PERPS_PRO_DIALOG_TOKENS.actionForeground);
        }
        fireEvent.press(screen.getByRole('button'));
        expect(onPress).toHaveBeenCalledTimes(1);
      }

      view.rerender(content(false, false));
      expect(readButtonStyle().backgroundColor).toBe(
        PERPS_PRO_DIALOG_TOKENS.actionBackground,
      );
      expect(
        StyleSheet.flatten(screen.getByText('Confirm').props.style).color,
      ).toBe(PERPS_PRO_DIALOG_TOKENS.actionForeground);
      fireEvent.press(screen.getByRole('button'));
      expect(onPress).toHaveBeenCalledTimes(2);
    },
  );
});
