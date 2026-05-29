import React from 'react';
import { renderHook } from '@testing-library/react-native';

import { useInputBlurOnTouchaway } from './hooks';

jest.mock('@/components/Typography', () => ({}));

describe('useInputBlurOnTouchaway', () => {
  it('blurs a single input ref when touchaway is emitted', () => {
    const blur = jest.fn();
    const inputRef = { current: { blur } };

    const { result } = renderHook(() =>
      useInputBlurOnTouchaway(inputRef as React.RefObject<any>),
    );

    result.current.onTouchInputAway();

    expect(blur).toHaveBeenCalledTimes(1);
  });

  it('blurs every input in an input ref list', () => {
    const firstBlur = jest.fn();
    const secondBlur = jest.fn();
    const refs = [
      { current: { blur: firstBlur } },
      { current: null },
      { current: { blur: secondBlur } },
    ];

    const { result } = renderHook(() =>
      useInputBlurOnTouchaway(refs as React.RefObject<any>[]),
    );

    result.current.onTouchInputAway();

    expect(firstBlur).toHaveBeenCalledTimes(1);
    expect(secondBlur).toHaveBeenCalledTimes(1);
  });

  it('removes listeners on unmount', () => {
    const blur = jest.fn();
    const inputRef = { current: { blur } };
    const { result, unmount } = renderHook(() =>
      useInputBlurOnTouchaway(inputRef as React.RefObject<any>),
    );

    const { onTouchInputAway } = result.current;

    unmount();
    onTouchInputAway();

    expect(blur).not.toHaveBeenCalled();
  });
});
