import { ThemeColors2024 } from '@/constant/theme';
import { StyleSheet } from 'react-native';
import {
  getPerpsProDialogStyles as getDialogStyles,
  PERPS_PRO_DIALOG_TOKENS,
  getPerpsProDialogActionStyles,
  resolvePerpsProDialogFieldBackground,
  resolvePerpsProDialogCardBackground,
  getPerpsProDialogCheckboxStyles,
} from './perpsProDialogVisual';

describe('Pro dialog surfaces', () => {
  it.each(['light', 'dark'] as const)(
    'keeps unselected cards distinct from the %s sheet without changing selection geometry',
    mode => {
      const colors = ThemeColors2024[mode];
      const styles = getDialogStyles(colors, 0, mode === 'light');
      const inactive = StyleSheet.flatten([
        styles.option,
        styles.optionInactive,
      ]);
      const active = StyleSheet.flatten([styles.option, styles.optionActive]);

      const field = resolvePerpsProDialogFieldBackground(
        colors,
        mode === 'light',
      );
      const card = resolvePerpsProDialogCardBackground(
        colors,
        mode === 'light',
      );
      expect(field).toBe(
        mode === 'light' ? 'rgba(246, 247, 247, 1)' : 'rgba(47, 49, 53, 0.5)',
      );
      expect(card).not.toBe(field);
      expect(
        getPerpsProDialogCheckboxStyles(colors).checkboxText,
      ).toMatchObject({ color: colors['neutral-foot'], flexShrink: 1 });
      expect(
        getPerpsProDialogCheckboxStyles(colors).checkboxText,
      ).not.toHaveProperty('flex');
      const actions = getPerpsProDialogActionStyles(colors);
      expect(styles.button).toEqual(actions.button);
      expect(actions.button.backgroundColor).toBe(
        PERPS_PRO_DIALOG_TOKENS.actionBackground,
      );
      expect(actions.buttonTitle.color).toBe(
        PERPS_PRO_DIALOG_TOKENS.actionForeground,
      );
      expect(actions.buttonDisabled.backgroundColor).toBe(
        colors['brand-disable'],
      );
      expect(actions.buttonDisabledTitle.color).toBe(
        colors['neutral-InvertHighlight'],
      );
      expect(styles.background.backgroundColor).toBe(colors['neutral-bg-0']);
      expect(inactive.backgroundColor).toBe(
        colors[mode === 'light' ? 'neutral-bg-1' : 'neutral-bg-2'],
      );
      expect(inactive.backgroundColor).not.toBe(
        styles.background.backgroundColor,
      );
      expect(active.backgroundColor).toBe(
        PERPS_PRO_DIALOG_TOKENS.selectedBackground,
      );
      expect(active.borderColor).toBe(PERPS_PRO_DIALOG_TOKENS.selectedBorder);
      expect(inactive.borderColor).toBe('transparent');
      expect({
        ...active,
        backgroundColor: inactive.backgroundColor,
        borderColor: inactive.borderColor,
      }).toEqual(inactive);
    },
  );
});

describe('Pro dialog font mapping', () => {
  it.each(['ios', 'android'])(
    'resolves Heavy titles and Bold buttons through the real %s style factory',
    platform => {
      jest.isolateModules(() => {
        jest.doMock('@/core/native/utils', () => ({
          IS_ANDROID: platform === 'android',
          IS_IOS: platform === 'ios',
        }));
        const { createGetStyles2024 } = require('@/utils/styles');
        const { getPerpsProDialogStyles } = require('./perpsProDialogVisual');
        const styles = createGetStyles2024(
          ({ colors2024, safeAreaInsets }: any) =>
            getPerpsProDialogStyles(colors2024, safeAreaInsets.bottom, true),
        ).getStyles({
          colors2024: ThemeColors2024.light,
          safeAreaInsets: { bottom: 0 },
        });
        expect(styles.title).toMatchObject({
          fontFamily:
            platform === 'ios' ? 'SF Pro Rounded' : 'SF-Pro-Rounded-Heavy',
        });
        expect(styles.buttonTitle).toMatchObject({
          fontFamily:
            platform === 'ios' ? 'SF Pro Rounded' : 'SF-Pro-Rounded-Bold',
        });
        expect(styles.title.fontWeight).toBe(
          platform === 'ios' ? '800' : undefined,
        );
        expect(styles.buttonTitle.fontWeight).toBe(
          platform === 'ios' ? '700' : undefined,
        );
      });
    },
  );
});
