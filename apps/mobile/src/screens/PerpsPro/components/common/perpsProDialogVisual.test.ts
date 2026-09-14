import { ThemeColors2024 } from '@/constant/theme';

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
            getPerpsProDialogStyles(colors2024, safeAreaInsets.bottom),
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
