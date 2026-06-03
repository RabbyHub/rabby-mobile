import React from 'react';

jest.mock('react-native-gesture-handler', () => ({
  Text: 'Text',
  TextInput: 'TextInput',
}));
jest.mock('react-native-animateable-text', () => 'Text');
jest.mock('@rneui/base', () => ({ Text: 'Text' }));
jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  default: {
    createAnimatedComponent: (Component: unknown) => Component,
  },
}));
jest.mock('react-native-size-matters', () => ({
  moderateScale: (value: number) => value,
}));

import {
  containsCJKText,
  sanitizeAndroidCJKFontStyle,
} from './textFontFallback';

describe('Text Android CJK font fallback', () => {
  it('detects CJK text in nested children', () => {
    expect(containsCJKText('借款')).toBe(true);
    expect(
      containsCJKText([
        'Borrow ',
        <React.Fragment key="label">借款</React.Fragment>,
      ]),
    ).toBe(true);
    expect(containsCJKText('Borrow')).toBe(false);
  });

  it('drops SF Pro font family for Android CJK text and preserves bold weight', () => {
    const style = sanitizeAndroidCJKFontStyle(
      {
        fontFamily: 'SF-Pro-Rounded-Bold',
        fontSize: 16,
        color: '#fff',
      },
      true,
      'android',
    );

    expect(style).toEqual({
      fontSize: 16,
      color: '#fff',
      fontWeight: '700',
    });
  });

  it('keeps SF Pro font family for non-CJK text', () => {
    const style = sanitizeAndroidCJKFontStyle(
      {
        fontFamily: 'SF-Pro-Rounded-Bold',
        fontSize: 16,
      },
      false,
      'android',
    );

    expect(style).toEqual({
      fontFamily: 'SF-Pro-Rounded-Bold',
      fontSize: 16,
    });
  });

  it('keeps SF Pro font family on iOS', () => {
    const style = sanitizeAndroidCJKFontStyle(
      {
        fontFamily: 'SFProRounded-Bold',
        fontSize: 16,
      },
      true,
      'ios',
    );

    expect(style).toEqual({
      fontFamily: 'SFProRounded-Bold',
      fontSize: 16,
    });
  });
});
