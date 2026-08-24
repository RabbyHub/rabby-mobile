import { act, renderHook } from '@testing-library/react-native';

import { createPerpsProAttachedTpSlDraft } from '../model/tpsl';
import { usePerpsProTpSl } from './usePerpsProTpSl';

const order = {
  bboEnabled: false,
  orderType: 'market' as const,
  reduceOnly: false,
  tif: 'Gtc' as const,
};

describe('usePerpsProTpSl', () => {
  it('preserves raw values and modes when an incompatible state disables it', () => {
    const onChange = jest.fn();
    renderHook(() =>
      usePerpsProTpSl({
        draft: {
          enabled: true,
          sl: { mode: 'pnl', rawMagnitude: '10' },
          tp: { mode: 'roi', rawMagnitude: '20' },
        },
        leverage: 10,
        onChange,
        order: { ...order, reduceOnly: true },
        pxDecimals: 2,
        previewFacts: { buy: null, sell: null },
        szDecimals: 2,
      }),
    );

    expect(onChange).toHaveBeenCalledWith({
      enabled: false,
      sl: { mode: 'pnl', rawMagnitude: '10' },
      tp: { mode: 'roi', rawMagnitude: '20' },
    });
  });

  it('does not automatically enable again after compatibility returns', () => {
    const onChange = jest.fn();
    const draft = {
      ...createPerpsProAttachedTpSlDraft(),
      sl: { mode: 'price' as const, rawMagnitude: '90' },
    };
    const hook = renderHook(
      ({ reduceOnly }) =>
        usePerpsProTpSl({
          draft,
          leverage: 10,
          onChange,
          order: { ...order, reduceOnly },
          pxDecimals: 2,
          previewFacts: { buy: null, sell: null },
          szDecimals: 2,
        }),
      { initialProps: { reduceOnly: true } },
    );
    onChange.mockClear();
    hook.rerender({ reduceOnly: false });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('refuses explicit enabling while the order state is incompatible', () => {
    const onChange = jest.fn();
    const hook = renderHook(() =>
      usePerpsProTpSl({
        draft: createPerpsProAttachedTpSlDraft(),
        leverage: 10,
        onChange,
        order: { ...order, tif: 'Ioc', orderType: 'limit' },
        previewFacts: { buy: null, sell: null },
        pxDecimals: 2,
        szDecimals: 2,
      }),
    );
    act(() => hook.result.current.setEnabled(true));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('derives both Buy and Sell previews without writing derived values', () => {
    const onChange = jest.fn();
    const hook = renderHook(() =>
      usePerpsProTpSl({
        draft: {
          enabled: true,
          sl: { mode: 'pnl', rawMagnitude: '20' },
          tp: { mode: 'roi', rawMagnitude: '100' },
        },
        leverage: 10,
        onChange,
        order,
        pxDecimals: 2,
        previewFacts: {
          buy: { baseSize: '2', expectedEntryPrice: '100' },
          sell: { baseSize: '2', expectedEntryPrice: '100' },
        },
        szDecimals: 2,
      }),
    );

    expect(hook.result.current.previews.buy).toMatchObject({
      sl: { triggerPrice: '90' },
      tp: { triggerPrice: '110' },
    });
    expect(hook.result.current.previews.sell).toMatchObject({
      sl: { triggerPrice: '110' },
      tp: { triggerPrice: '90' },
    });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('clears market-specific raw values but preserves each mode', () => {
    const onChange = jest.fn();
    const hook = renderHook(() =>
      usePerpsProTpSl({
        draft: {
          enabled: true,
          sl: { mode: 'pnl', rawMagnitude: '10' },
          tp: { mode: 'roi', rawMagnitude: '20' },
        },
        leverage: 10,
        onChange,
        order,
        pxDecimals: 2,
        previewFacts: { buy: null, sell: null },
        szDecimals: 2,
      }),
    );
    act(() => hook.result.current.clearForMarketChange());
    expect(onChange).toHaveBeenCalledWith({
      enabled: false,
      sl: { mode: 'pnl', rawMagnitude: '' },
      tp: { mode: 'roi', rawMagnitude: '' },
    });
  });

  it('clears only the switched leg and does not reinterpret its raw value', () => {
    const onChange = jest.fn();
    const onModeChange = jest.fn();
    const hook = renderHook(() =>
      usePerpsProTpSl({
        draft: {
          enabled: true,
          sl: { mode: 'pnl', rawMagnitude: '20' },
          tp: { mode: 'price', rawMagnitude: '100' },
        },
        leverage: 10,
        onChange,
        onModeChange,
        order,
        pxDecimals: 2,
        previewFacts: { buy: null, sell: null },
        szDecimals: 2,
      }),
    );

    act(() => hook.result.current.setMode('tp', 'roi'));

    expect(onChange).toHaveBeenCalledWith({
      enabled: true,
      sl: { mode: 'pnl', rawMagnitude: '20' },
      tp: { mode: 'roi', rawMagnitude: '' },
    });
    expect(onModeChange).toHaveBeenCalledWith('tp', 'roi');
  });

  it('limits Opening PnL and ROI magnitudes to two decimals', () => {
    const onChange = jest.fn();
    const hook = renderHook(() =>
      usePerpsProTpSl({
        draft: {
          enabled: true,
          sl: { mode: 'roi', rawMagnitude: '' },
          tp: { mode: 'pnl', rawMagnitude: '' },
        },
        leverage: 10,
        onChange,
        order,
        pxDecimals: 4,
        previewFacts: { buy: null, sell: null },
        szDecimals: 2,
      }),
    );

    act(() => hook.result.current.setRawMagnitude('tp', '12.3456'));
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        tp: { mode: 'pnl', rawMagnitude: '12.34' },
      }),
    );
    act(() => hook.result.current.setRawMagnitude('sl', '9.876'));
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        sl: { mode: 'roi', rawMagnitude: '9.87' },
      }),
    );
  });

  it('preserves the raw value when the selected mode does not change', () => {
    const onChange = jest.fn();
    const onModeChange = jest.fn();
    const hook = renderHook(() =>
      usePerpsProTpSl({
        draft: {
          enabled: true,
          sl: { mode: 'pnl', rawMagnitude: '20' },
          tp: { mode: 'price', rawMagnitude: '100' },
        },
        leverage: 10,
        onChange,
        onModeChange,
        order,
        pxDecimals: 2,
        previewFacts: { buy: null, sell: null },
        szDecimals: 2,
      }),
    );

    act(() => hook.result.current.setMode('tp', 'price'));

    expect(onChange).not.toHaveBeenCalled();
    expect(onModeChange).toHaveBeenCalledWith('tp', 'price');
  });

  it('keeps the leg focused when its value is cleared while editing', () => {
    const hook = renderHook(() =>
      usePerpsProTpSl({
        draft: createPerpsProAttachedTpSlDraft(),
        leverage: 10,
        onChange: jest.fn(),
        order,
        pxDecimals: 2,
        previewFacts: { buy: null, sell: null },
        szDecimals: 2,
      }),
    );

    act(() => hook.result.current.setFocusedLeg('tp'));
    act(() => hook.result.current.setRawMagnitude('tp', ''));

    expect(hook.result.current.focusedLeg).toBe('tp');
  });

  it('keeps a newer leg focused when an older input blurs late', () => {
    const onFocusChange = jest.fn();
    const hook = renderHook(() =>
      usePerpsProTpSl({
        draft: { ...createPerpsProAttachedTpSlDraft(), enabled: true },
        leverage: 10,
        onChange: jest.fn(),
        onFocusChange,
        order,
        pxDecimals: 2,
        previewFacts: { buy: null, sell: null },
        szDecimals: 2,
      }),
    );

    act(() => hook.result.current.setFocusedLeg('tp'));
    act(() => hook.result.current.setFocusedLeg('sl'));
    act(() => hook.result.current.blurFocusedLeg('tp'));

    expect(hook.result.current.focusedLeg).toBe('sl');
    expect(onFocusChange.mock.calls).toEqual([
      ['tp', true],
      ['tp', false],
      ['sl', true],
    ]);
  });
});
