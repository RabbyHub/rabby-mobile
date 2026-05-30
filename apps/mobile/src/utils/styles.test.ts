jest.mock('@/core/native/utils', () => ({
  IS_IOS: false,
}));

jest.mock('@/core/utils/fonts', () => ({
  FontNames: {
    sf_pro: 'SF-Pro',
    sf_pro_rounded_bold: 'SF-Pro-Rounded-Bold',
    sf_pro_rounded_heavy: 'SF-Pro-Rounded-Heavy',
    sf_pro_rounded_medium: 'SF-Pro-Rounded-Medium',
    sf_pro_rounded_regular: 'SF-Pro-Rounded-Regular',
  },
  FontWeightEnum: {
    bold: 'bold',
    heavy: 'heavy',
    medium: 'medium',
    normal: 'normal',
  },
  getFontWeightType: (fontWeight?: string | number) => {
    if (fontWeight === '900' || fontWeight === 900) {
      return { supertype: 'heavy' };
    }
    if (fontWeight === '700' || fontWeight === 700 || fontWeight === 'bold') {
      return { supertype: 'bold' };
    }
    if (fontWeight === '500' || fontWeight === 500) {
      return { supertype: 'medium' };
    }
    return { supertype: 'normal' };
  },
}));

import {
  createGetStyles,
  createGetStyles2024,
  makeDebugBorder,
  makeDevOnlyStyle,
  makeProdBorder,
  makeTriangleStyle,
  mutateStyles,
} from './styles';

const colors = {
  blueDefault: '#0000ff',
} as any;

const ctx = {
  classicalColors: colors,
  colors,
  colors2024: {
    neutral: '#111111',
  },
  isLight: true,
  safeAreaInsets: {
    bottom: 4,
    left: 1,
    right: 2,
    top: 3,
  },
} as any;

describe('style utilities', () => {
  it('creates directional triangle styles with transparent opposite borders', () => {
    expect(makeTriangleStyle()).toMatchObject({
      borderBottomColor: 'blue',
      borderLeftColor: 'transparent',
      borderRightColor: 'transparent',
      borderTopColor: 'transparent',
      borderWidth: 6,
      height: 0,
      width: 0,
    });
    expect(makeTriangleStyle('down')).toMatchObject({
      borderTopColor: 'blue',
    });
    expect(
      makeTriangleStyle({
        backgroundColor: '#fff',
        color: '#f00',
        dir: 'right',
        size: 10,
      }),
    ).toMatchObject({
      borderLeftColor: '#f00',
      borderRightColor: '#fff',
      borderWidth: 10,
    });
  });

  it('mutates SF Pro font families for Android while preserving the input shape', () => {
    const styles = mutateStyles({
      roundedBold: {
        fontFamily: 'SF Pro Rounded',
        fontWeight: '700',
      },
      roundedRegular: {
        fontFamily: 'SFProRounded',
      },
      sfPro: {
        fontFamily: 'SF Pro Display',
        fontWeight: '500',
      },
    });

    expect(styles.roundedBold).toEqual({
      fontFamily: 'SF-Pro-Rounded-Bold',
    });
    expect(styles.roundedRegular).toEqual({
      fontFamily: 'SF-Pro-Rounded-Regular',
    });
    expect(styles.sfPro).toEqual({
      fontFamily: 'SF-Pro',
      fontWeight: '500',
    });
  });

  it('creates style factories that run through mutateStyles', () => {
    const getStyles = createGetStyles(inputColors => ({
      title: {
        color: inputColors.blueDefault,
        fontFamily: 'SF Pro Rounded',
        fontWeight: '900',
      },
    }));

    expect(getStyles(colors, ctx)).toEqual({
      title: {
        color: '#0000ff',
        fontFamily: 'SF-Pro-Rounded-Heavy',
      },
    });
  });

  it('creates 2024 style factories and preserves reanimated style functions', () => {
    const reanimatedStyle = jest.fn(() => ({ opacity: 1 }));
    const styles = createGetStyles2024(
      {
        reanimatedStyles: {
          fade: reanimatedStyle,
        },
      },
      inputCtx => ({
        panel: {
          color: inputCtx.colors2024.neutral,
          paddingBottom: inputCtx.safeAreaInsets.bottom,
        },
      }),
    );

    expect(styles.getStyles(ctx)).toEqual({
      panel: {
        color: '#111111',
        paddingBottom: 4,
      },
    });
    expect(styles.getReanimatedStyles.fade).toBe(reanimatedStyle);
    expect(createGetStyles2024().getStyles(ctx)).toEqual({});
  });

  it('returns dev-only and production border helpers', () => {
    const input = { opacity: 0.5 };

    expect(makeDevOnlyStyle(input)).toBe(input);
    expect(makeDebugBorder('red')).toEqual({
      borderColor: 'red',
      borderWidth: 1,
    });
    expect(makeProdBorder('green')).toEqual({
      borderColor: 'green',
      borderWidth: 1,
    });
  });
});
