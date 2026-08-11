import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import { StyleSheet } from 'react-native';

jest.mock('@/assets2024/icons/common/checkbox-empty-cc.svg', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return (props: object) => ReactModule.createElement(View, props);
});

jest.mock('@/assets2024/icons/common/checkbox-filled-brand.svg', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return (props: object) => ReactModule.createElement(View, props);
});

jest.mock('@/assets2024/icons/perps/PerpsProPrecisionCaret.svg', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return (props: object) => ReactModule.createElement(View, props);
});

jest.mock('@/assets2024/icons/perps/PerpsProTpSlTooltipTail.svg', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return (props: object) => ReactModule.createElement(View, props);
});

jest.mock('@/components/Typography', () => ({
  Text: require('react-native').Text,
  TextInput: require('react-native').TextInput,
}));

jest.mock('@/hooks/theme', () => ({
  useTheme2024: ({ getStyle }: { getStyle: (input: object) => object }) => {
    const colors2024 = new Proxy({}, { get: (_target, key) => String(key) });
    return { colors2024, styles: getStyle({ colors2024 }) };
  },
}));

jest.mock('@/utils/styles', () => ({
  createGetStyles2024: (getStyle: unknown) => getStyle,
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key.split('.').pop() || key }),
}));

jest.mock('../common/PerpsProDottedUnderlineText', () => ({
  PerpsProDottedUnderlineText: require('react-native').Text,
}));

jest.mock('../common/usePerpsProDismissKeyboard', () => ({
  usePerpsProDismissKeyboard: () => (action: () => void) => action(),
}));

jest.mock('./PerpsProTpSlModeSheet', () => ({
  PerpsProTpSlModeSheet: ({
    onSelect,
    visible,
  }: {
    onSelect: (mode: 'roi') => void;
    visible: boolean;
  }) => {
    if (!visible) return null;
    const ReactModule = require('react');
    const { Pressable } = require('react-native');
    return ReactModule.createElement(Pressable, {
      onPress: () => onSelect('roi'),
      testID: 'mock-tpsl-mode-sheet',
    });
  },
}));

import type { PerpsProTpSlController } from '../../scene/usePerpsProTpSl';
import { PerpsProTpSlFields } from './PerpsProTpSlFields';

const draft = {
  enabled: true,
  sl: { mode: 'pnl' as const, rawMagnitude: '20' },
  tp: { mode: 'price' as const, rawMagnitude: '110' },
};

const evaluated = (kind: 'sl' | 'tp', triggerPrice: string) => ({
  estimatedPnl: kind === 'tp' ? '20' : '-20',
  estimatedRoi: kind === 'tp' ? '100' : '-100',
  kind,
  mode: draft[kind].mode,
  rawMagnitude: draft[kind].rawMagnitude,
  triggerPrice,
});

const controller = (overrides: Partial<PerpsProTpSlController> = {}) =>
  ({
    clearForMarketChange: jest.fn(),
    compatibilityError: null,
    disabled: false,
    focusedLeg: null,
    previews: {
      buy: { sl: evaluated('sl', '90'), tp: evaluated('tp', '110') },
      sell: { sl: evaluated('sl', '110'), tp: evaluated('tp', '90') },
    },
    setEnabled: jest.fn(),
    setFocusedLeg: jest.fn(),
    setMode: jest.fn(),
    setRawMagnitude: jest.fn(),
    setSubmitErrors: jest.fn(),
    submitContext: { liquidationPrice: null, side: null },
    submitErrors: [],
    ...overrides,
  } as PerpsProTpSlController);

describe('PerpsProTpSlFields', () => {
  it('matches the expanded TP/SL spacing and input geometry', () => {
    render(
      <PerpsProTpSlFields
        controller={controller()}
        draft={draft}
        pxDecimals={2}
        quoteAsset="USDC"
      />,
    );

    expect(
      StyleSheet.flatten(
        screen.getByTestId('perps-pro-tpsl-inputs').props.style,
      ),
    ).toMatchObject({ gap: 16 });
    expect(
      StyleSheet.flatten(
        screen.getByTestId('perps-pro-tpsl-tp-field').props.style,
      ),
    ).toMatchObject({
      borderRadius: 6,
      gap: 6,
      height: 40,
      paddingHorizontal: 8,
    });
    expect(
      StyleSheet.flatten(
        screen.getByTestId('perps-pro-tpsl-tp-mode').props.style,
      ),
    ).toMatchObject({ height: 24, width: 52 });
    expect(
      StyleSheet.flatten(
        screen.getByTestId('perps-pro-tpsl-tp-mode-content').props.style,
      ),
    ).toMatchObject({
      gap: 2,
      height: 16,
      left: 6,
      position: 'absolute',
      top: 4,
      width: 44,
    });
    expect(
      StyleSheet.flatten(
        screen.getByTestId('perps-pro-tpsl-tp-caret').props.style,
      ),
    ).toMatchObject({ height: 6, width: 8 });
    expect(screen.getByTestId('perps-pro-tpsl-tp-unit').props.children).toBe(
      'USDC',
    );
    expect(
      StyleSheet.flatten(
        screen.getByTestId('perps-pro-tpsl-tp-label').props.style,
      ),
    ).toMatchObject({
      fontSize: 10,
      lineHeight: 12,
      textAlign: 'center',
      top: 4,
    });
    expect(
      StyleSheet.flatten(
        screen.getByTestId('perps-pro-tpsl-tp-input').props.style,
      ),
    ).toMatchObject({ height: 40, paddingTop: 12, textAlign: 'center' });
    expect(
      StyleSheet.flatten(screen.getByText('takeProfit').props.style),
    ).toMatchObject({ fontSize: 12, lineHeight: 16 });
    expect(
      screen.getByTestId('perps-pro-trade-checkbox-icon').props,
    ).toMatchObject({ height: 20, width: 20 });
  });

  it('uses a centered overlay placeholder and keeps the input geometry stable on focus', () => {
    const emptyDraft = {
      ...draft,
      tp: { ...draft.tp, mode: 'roi' as const, rawMagnitude: '' },
    };
    render(
      <PerpsProTpSlFields
        controller={controller()}
        draft={emptyDraft}
        pxDecimals={2}
        quoteAsset="USDC"
      />,
    );

    const input = screen.getByTestId('perps-pro-tpsl-tp-input');
    expect(input.props.placeholder).toBeUndefined();
    expect(
      StyleSheet.flatten(
        screen.getByTestId('perps-pro-tpsl-tp-placeholder').props.style,
      ),
    ).toMatchObject({
      fontSize: 14,
      lineHeight: 18,
      textAlign: 'center',
      top: 11,
    });
    expect(screen.getByTestId('perps-pro-tpsl-tp-unit').props.children).toBe(
      '%',
    );

    fireEvent(input, 'focus');

    expect(screen.queryByTestId('perps-pro-tpsl-tp-placeholder')).toBeNull();
    expect(screen.getByTestId('perps-pro-tpsl-tp-label').props.children).toBe(
      'roiInput',
    );
    expect(StyleSheet.flatten(input.props.style)).toMatchObject({
      height: 40,
      paddingTop: 12,
      textAlign: 'center',
    });
  });

  it('routes checkbox, input and independent mode events to the controller', () => {
    const tpSl = controller();
    render(
      <PerpsProTpSlFields
        controller={tpSl}
        draft={draft}
        pxDecimals={2}
        quoteAsset="USDC"
      />,
    );

    fireEvent.press(screen.getByRole('checkbox'));
    expect(tpSl.setEnabled).toHaveBeenCalledWith(false);
    fireEvent.changeText(screen.getByTestId('perps-pro-tpsl-tp-input'), '120');
    expect(tpSl.setRawMagnitude).toHaveBeenCalledWith('tp', '120');
    expect(screen.getByText('−')).toBeTruthy();
    fireEvent.press(screen.getByTestId('perps-pro-tpsl-sl-mode'));
    expect(tpSl.setFocusedLeg).toHaveBeenCalledWith(null);
    fireEvent.press(screen.getByTestId('mock-tpsl-mode-sheet'));
    expect(tpSl.setMode).toHaveBeenCalledWith('sl', 'roi');
  });

  it('shows a live dual-direction tooltip only for the focused valid leg', () => {
    const view = render(
      <PerpsProTpSlFields
        controller={controller({ focusedLeg: null })}
        draft={draft}
        pxDecimals={2}
        quoteAsset="USDC"
      />,
    );
    expect(screen.queryByTestId('perps-pro-tpsl-tooltip')).toBeNull();

    view.rerender(
      <PerpsProTpSlFields
        controller={controller({ focusedLeg: 'tp' })}
        draft={draft}
        pxDecimals={2}
        quoteAsset="USDC"
      />,
    );
    expect(screen.getByTestId('perps-pro-tpsl-tooltip')).toBeTruthy();
    expect(
      StyleSheet.flatten(
        screen.getByTestId('perps-pro-tpsl-tooltip').props.style,
      ),
    ).toMatchObject({ top: -27, width: 206 });
    expect(
      StyleSheet.flatten(
        screen.getByTestId('perps-pro-tpsl-tooltip-body').props.style,
      ),
    ).toMatchObject({ borderRadius: 6, height: 40 });
    expect(screen.getByText(/buyProfit/)).toBeTruthy();
    expect(screen.getByText(/sellProfit/)).toBeTruthy();
  });

  it.each([
    ['buy', evaluated('tp', '110'), null, /buyProfit/, /sellProfit/],
    ['sell', null, evaluated('tp', '90'), /sellProfit/, /buyProfit/],
  ] as const)(
    'keeps a one-line tooltip when only the %s preview is valid',
    (_side, buy, sell, visibleLabel, hiddenLabel) => {
      render(
        <PerpsProTpSlFields
          controller={controller({
            focusedLeg: 'tp',
            previews: {
              buy: { sl: evaluated('sl', '90'), tp: buy },
              sell: { sl: evaluated('sl', '110'), tp: sell },
            },
          })}
          draft={draft}
          pxDecimals={2}
          quoteAsset="USDC"
        />,
      );

      expect(
        StyleSheet.flatten(
          screen.getByTestId('perps-pro-tpsl-tooltip').props.style,
        ),
      ).toMatchObject({ top: -11, width: 206 });
      expect(
        StyleSheet.flatten(
          screen.getByTestId('perps-pro-tpsl-tooltip-body').props.style,
        ),
      ).toMatchObject({ height: 24 });
      expect(
        StyleSheet.flatten(
          screen.getByTestId('perps-pro-tpsl-tooltip-tail').props.style,
        ),
      ).toMatchObject({ top: 20 });
      expect(screen.getByText(visibleLabel)).toBeTruthy();
      expect(screen.queryByText(hiddenLabel)).toBeNull();
    },
  );

  it('hides the tooltip when neither direction has a valid preview', () => {
    render(
      <PerpsProTpSlFields
        controller={controller({
          focusedLeg: 'tp',
          previews: {
            buy: { sl: evaluated('sl', '90'), tp: null },
            sell: { sl: evaluated('sl', '110'), tp: null },
          },
        })}
        draft={draft}
        pxDecimals={2}
        quoteAsset="USDC"
      />,
    );

    expect(screen.queryByTestId('perps-pro-tpsl-tooltip')).toBeNull();
  });

  it('renders structured submit errors at the owning leg', () => {
    render(
      <PerpsProTpSlFields
        controller={controller({
          submitErrors: [{ code: 'outsideLiquidationRange', leg: 'sl' }],
        })}
        draft={draft}
        pxDecimals={2}
        quoteAsset="USDC"
      />,
    );
    expect(screen.getByText('outsideLiquidationRange')).toBeTruthy();
  });
});
