import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';

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

jest.mock('./PerpsProTradeOptionSheet', () => ({
  PerpsProTradeOptionSheet: () => null,
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
    submitErrors: [],
    ...overrides,
  } as PerpsProTpSlController);

describe('PerpsProTpSlFields', () => {
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
    expect(screen.getByTestId('perps-pro-tpsl-fields')).toBeTruthy();
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
    expect(screen.getByText('buyLong')).toBeTruthy();
    expect(screen.getByText('sellShort')).toBeTruthy();
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
