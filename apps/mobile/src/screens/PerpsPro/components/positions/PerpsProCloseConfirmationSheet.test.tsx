import { render, screen } from '@testing-library/react-native';
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
jest.mock('@/components/AutoLockView', () => require('react-native').View);
jest.mock('@/components/Typography', () => ({
  Text: require('react-native').Text,
}));
jest.mock('@/components/customized/BottomSheet', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return {
    AppBottomSheetModal: ReactModule.forwardRef(
      (props: Record<string, unknown>, ref: React.Ref<unknown>) => {
        ReactModule.useImperativeHandle(ref, () => ({
          close: jest.fn(),
          present: jest.fn(),
        }));
        return ReactModule.createElement(View, {
          ...props,
          testID: 'close-confirmation-sheet',
        });
      },
    ),
  };
});
jest.mock('@/components2024/Button', () => {
  const ReactModule = require('react');
  const { Pressable, Text } = require('react-native');
  return {
    Button: ({ title, type }: { title: string; type: string }) =>
      ReactModule.createElement(
        Pressable,
        { testID: 'close-confirmation-button', type },
        ReactModule.createElement(Text, null, title),
      ),
  };
});
jest.mock('@/components2024/GlobalBottomSheetModal/utils-help', () => ({
  makeBottomSheetProps: () => ({}),
}));
jest.mock('@/hooks/theme', () => ({
  useTheme2024: ({ getStyle }: { getStyle: (input: object) => object }) => {
    const colors2024 = new Proxy({}, { get: (_target, key) => String(key) });
    return {
      colors2024,
      styles: getStyle({ colors2024, safeAreaInsets: { bottom: 0 } }),
    };
  },
}));
jest.mock('@/utils/styles', () => ({
  createGetStyles2024: (getStyle: unknown) => getStyle,
}));
jest.mock('@/utils/modalGate', () => ({
  MODAL_GATE_IDS: { perpsProCloseConfirmation: 'close-confirmation' },
  useRegisterBlockingModal: jest.fn(),
}));
jest.mock('@gorhom/bottom-sheet', () => ({
  BottomSheetView: require('react-native').View,
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) =>
      ({
        'global.confirm': 'Confirm',
        'page.perps.pro.openOrders.buy': 'Buy',
        'page.perps.pro.openOrders.sell': 'Sell',
        'page.perps.pro.positions.amount': 'Amount',
        'page.perps.pro.positions.long': 'Long',
        'page.perps.pro.positions.marketPrice': 'Market Price',
        'page.perps.pro.positions.price': 'Price',
        'page.perps.pro.positions.short': 'Short',
        'page.perps.pro.positions.skipLimitConfirmation':
          "Don't display double confirmation for Limit Order again.",
      }[key] ?? key),
  }),
}));

import type { PerpsPositionViewModel } from '../../model/position';
import type { PerpsProCloseDraft } from '../../model/positionAction';
import { PerpsProCloseConfirmationSheet } from './PerpsProCloseConfirmationSheet';

const market = {
  displayBase: 'BTC',
  displayPair: 'BTCUSDC',
  markPrice: '60000',
  midPrice: '60000',
  pxDecimals: 0,
  quoteAsset: 'USDC',
  sourceTag: null,
  szDecimals: 4,
};
const position = {
  direction: 'long',
} as PerpsPositionViewModel;
const draft = {
  inputSource: 'slider',
  limitPrice: '61000',
  midPrice: '60000',
  orderType: 'limit',
  percent: 100,
  referencePrice: '61000',
  size: '0.5',
} satisfies PerpsProCloseDraft;

describe('PerpsProCloseConfirmationSheet', () => {
  it('matches the compact Limit confirmation content and closing direction', () => {
    render(
      <PerpsProCloseConfirmationSheet
        amountUnit="base"
        draft={draft}
        market={market}
        onClose={jest.fn()}
        onConfirm={jest.fn()}
        onToggleSkipLimit={jest.fn()}
        pending={false}
        position={position}
        skipLimitConfirmation={false}
        visible
      />,
    );

    expect(
      screen.getByTestId('close-confirmation-sheet').props.snapPoints,
    ).toEqual([302]);
    expect(screen.getByText('BTCUSDC')).toBeTruthy();
    expect(screen.getByText('Sell')).toBeTruthy();
    expect(screen.getByText('Short')).toBeTruthy();
    expect(screen.getByText('61,000 USDC')).toBeTruthy();
    expect(screen.getByText('0.5000 BTC')).toBeTruthy();
    expect(screen.queryByText('Perp')).toBeNull();
    expect(screen.queryByTestId('perps-pro-close-market-tag')).toBeNull();
    expect(screen.getByTestId('close-confirmation-button').props.type).toBe(
      'primary',
    );
    expect(
      screen.getByText(
        "Don't display double confirmation for Limit Order again.",
      ),
    ).toBeTruthy();
    expect(screen.queryByText('Confirm Close')).toBeNull();
  });

  it('uses Market Price and omits the Limit-only preference', () => {
    render(
      <PerpsProCloseConfirmationSheet
        amountUnit="base"
        draft={{ ...draft, limitPrice: null, orderType: 'market' }}
        market={market}
        onClose={jest.fn()}
        onConfirm={jest.fn()}
        onToggleSkipLimit={jest.fn()}
        pending={false}
        position={position}
        skipLimitConfirmation={false}
        visible
      />,
    );

    expect(
      screen.getByTestId('close-confirmation-sheet').props.snapPoints,
    ).toEqual([262]);
    expect(screen.getByText('Market Price')).toBeTruthy();
    expect(
      screen.queryByText(
        "Don't display double confirmation for Limit Order again.",
      ),
    ).toBeNull();
  });

  it('renders the normalized market source instead of a hardcoded Perp tag', () => {
    render(
      <PerpsProCloseConfirmationSheet
        amountUnit="base"
        draft={draft}
        market={{ ...market, sourceTag: 'xyz' }}
        onClose={jest.fn()}
        onConfirm={jest.fn()}
        onToggleSkipLimit={jest.fn()}
        pending
        position={position}
        skipLimitConfirmation={false}
        visible
      />,
    );

    expect(screen.getByText('xyz')).toBeTruthy();
    expect(screen.queryByText('Perp')).toBeNull();
    expect(screen.getByTestId('close-confirmation-sheet').props).toMatchObject({
      backdropProps: { pressBehavior: 'none' },
      enablePanDownToClose: false,
    });
  });
});
