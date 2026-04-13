import React from 'react';
import { renderHook } from '@testing-library/react-native';

import {
  useComponentByAsProp,
  useComponentRefByAsProp,
} from './useComponentAsProp';

describe('useComponentAsProp', () => {
  const originalDev = (globalThis as any).__DEV__;

  beforeEach(() => {
    (globalThis as any).__DEV__ = originalDev;
  });

  afterAll(() => {
    (globalThis as any).__DEV__ = originalDev;
  });

  it('returns the mapped component and a typed ref holder', () => {
    const Primary = () => null;
    const Secondary = React.forwardRef<View, {}>(function Secondary(_, ref) {
      return <>{ref ? null : null}</>;
    });
    const asMap = {
      primary: Primary,
      secondary: Secondary,
    };

    const { result: byAs } = renderHook(() =>
      useComponentByAsProp('primary', asMap),
    );
    const { result: withRef } = renderHook(() =>
      useComponentRefByAsProp('secondary', asMap),
    );

    expect(byAs.current.Component).toBe(Primary);
    expect(withRef.current.Component).toBe(Secondary);
    expect(withRef.current.comRef.current).toBeNull();
  });

  it('throws in dev mode for an invalid as prop', () => {
    (globalThis as any).__DEV__ = true;
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
    const asMap = {
      primary: () => null,
    };

    expect(() =>
      renderHook(() => useComponentByAsProp('secondary' as any, asMap)),
    ).toThrow('Invalid as prop: secondary for Components: primary');
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('warns and falls back to Fragment in non-dev mode for an invalid as prop', () => {
    (globalThis as any).__DEV__ = false;
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
    const asMap = {
      primary: () => null,
    };

    const { result } = renderHook(() =>
      useComponentByAsProp('secondary' as any, asMap),
    );

    expect(result.current.Component).toBe(React.Fragment);
    expect(warnSpy).toHaveBeenCalledWith(
      'Invalid as prop: secondary for Components: primary',
    );
  });
});
