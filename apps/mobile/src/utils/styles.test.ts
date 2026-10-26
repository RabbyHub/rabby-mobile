import { Platform, StyleSheet, type TextStyle } from 'react-native';
import { ThemeColors, ThemeColors2024 } from '@/constant/theme';
import { getRoundedFontStyle } from '@/core/utils/fonts';
import { createGetStyles, createGetStyles2024, mutateStyles } from './styles';

// Unit coverage of the real style factory and mapper together. React Native's
// preset is the platform/StyleSheet boundary; there are no internal mocks.
const platform = Platform.OS === 'ios' ? 'ios' : 'android';
const context = {
  colors: ThemeColors.light,
  classicalColors: ThemeColors.light,
  colors2024: ThemeColors2024.light,
  isLight: true,
  safeAreaInsets: { top: 0, bottom: 0, left: 0, right: 0 },
};

describe('theme font normalization', () => {
  it.each(['400', '500', '700', '900'] as const)(
    'maps logical Rounded %s without changing the source or other style fields',
    fontWeight => {
      const source = {
        title: {
          fontFamily: 'SF Pro Rounded',
          fontWeight,
          fontSize: 20,
          lineHeight: 24,
          color: '#123456',
          fontVariant: ['tabular-nums'] as TextStyle['fontVariant'],
        },
      };
      const result = mutateStyles(source);
      expect(result.title).toEqual({
        ...source.title,
        ...getRoundedFontStyle(fontWeight, platform),
      });
      expect(result).not.toBe(source);
      expect(source.title.fontFamily).toBe('SF Pro Rounded');
      expect(source.title.fontWeight).toBe(fontWeight);
      expect(mutateStyles(result)).toEqual(result);
    },
  );

  it('preserves already resolved iOS Heavy and Android single-weight faces on repeat normalization', () => {
    const source = {
      iosHeavy: { fontFamily: 'ui-rounded', fontWeight: '800' as const },
      androidHeavy: { fontFamily: 'SF-Pro-Rounded-Heavy', fontSize: 24 },
      androidMedium: { fontFamily: 'SF-Pro-Rounded-Medium', fontSize: 14 },
    };
    expect(mutateStyles(source)).toEqual(source);
    expect(mutateStyles(mutateStyles(source))).toEqual(source);
  });

  it('does not remap unrelated fonts or standalone weights', () => {
    const source = {
      inheritedWeight: { fontWeight: '900' as const },
      system: { fontFamily: 'System', fontWeight: '900' as const },
      roboto: { fontFamily: 'Roboto', fontWeight: '500' as const },
      mono: { fontFamily: 'Menlo', fontWeight: '700' as const },
      custom: { fontFamily: 'My SF Pro Icons', fontWeight: '400' as const },
    };
    expect(mutateStyles(source)).toEqual(source);
  });

  it('maps only the exact legacy SF Pro family to the platform system default', () => {
    expect(
      mutateStyles({ body: { fontFamily: 'SF Pro', fontWeight: '500' } }).body,
    ).toEqual({
      fontFamily: platform === 'ios' ? 'System' : 'Roboto',
      fontWeight: '500',
    });
  });

  it('applies the same mapping through both theme factories', () => {
    const logicalStyles = () => ({
      title: {
        fontFamily: 'SF Pro Rounded',
        fontWeight: '900' as const,
        color: '#123456',
      },
    });
    const expected = {
      ...getRoundedFontStyle('900', platform),
      color: '#123456',
    };
    const classical = createGetStyles(logicalStyles)(ThemeColors.light);
    const current = createGetStyles2024(logicalStyles).getStyles(context);
    expect(StyleSheet.flatten(classical.title)).toEqual(expected);
    expect(StyleSheet.flatten(current.title)).toEqual(expected);
  });

  it('keeps explicit reanimated style callbacks unchanged and does not run them during theme construction', () => {
    let evaluations = 0;
    const animatedStyle = () => {
      evaluations += 1;
      return { ...getRoundedFontStyle('500', platform), opacity: 0.5 };
    };
    const factory = createGetStyles2024(
      { reanimatedStyles: { label: animatedStyle } },
      () => ({ title: { fontFamily: 'SF Pro Rounded', fontWeight: '900' } }),
    );
    expect(factory.getReanimatedStyles.label).toBe(animatedStyle);
    expect(StyleSheet.flatten(factory.getStyles(context).title)).toEqual(
      getRoundedFontStyle('900', platform),
    );
    expect(evaluations).toBe(0);
  });
});
