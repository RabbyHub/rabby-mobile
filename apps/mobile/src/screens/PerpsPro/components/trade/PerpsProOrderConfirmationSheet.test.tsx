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

jest.mock('@/components/customized/BottomSheet', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return {
    AppBottomSheetModal: ReactModule.forwardRef(
      (
        { children }: { children: React.ReactNode },
        ref: React.Ref<unknown>,
      ) => {
        ReactModule.useImperativeHandle(ref, () => ({
          close: jest.fn(),
          present: jest.fn(),
        }));
        return ReactModule.createElement(View, null, children);
      },
    ),
  };
});

jest.mock('@/components/Typography', () => ({
  Text: require('react-native').Text,
}));

jest.mock('@/components2024/Button', () => {
  const ReactModule = require('react');
  const { Pressable, Text } = require('react-native');
  return {
    Button: ({ onPress, title }: { onPress: () => void; title: string }) =>
      ReactModule.createElement(
        Pressable,
        { accessibilityRole: 'button', onPress },
        ReactModule.createElement(Text, null, title),
      ),
  };
});

jest.mock('@/components2024/GlobalBottomSheetModal/utils-help', () => ({
  makeBottomSheetProps: () => ({}),
}));

jest.mock('@/constant/layout', () => ({
  BOTTOM_BUTTON_SINGLE_HEIGHT: 52,
  BOTTOM_BUTTON_TITLE_STYLE: {},
  BOTTOM_BUTTON_TOP_OFFSET: 12,
  getBottomButtonBottomOffset: () => 20,
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

jest.mock('@gorhom/bottom-sheet', () => ({
  BottomSheetView: require('react-native').View,
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key.split('.').pop() || key }),
}));

import type { PerpsProOpenOrderCommand } from '../../actions/openOrder';
import type { PerpsProAttachedTpSlCommand } from '../../actions/openOrderWithAttachedTpSl';
import type { PerpsProMarket } from '../../model/market';
import { PerpsProOrderConfirmationSheet } from './PerpsProOrderConfirmationSheet';

const parent: PerpsProOpenOrderCommand = {
  account: { address: '0x1', type: 'watch' },
  baseSize: '1',
  coin: 'BTC',
  dexId: '',
  execution: { kind: 'limit', limitPrice: '100', tif: 'Gtc' },
  marketKey: 'hyperliquid::BTC',
  orderType: 'limit',
  quoteAmount: '100',
  reduceOnly: false,
  side: 'buy',
  type: 'openOrder',
};

const attached: PerpsProAttachedTpSlCommand = {
  accountRuntimeGeneration: 1,
  attached: {
    errors: [],
    expectedEntryPrice: '100',
    liquidationPrice: '50',
    normalizedBaseSize: '1',
    side: 'buy',
    sl: {
      estimatedPnl: '-10',
      estimatedRoi: '-100',
      kind: 'sl',
      mode: 'price',
      rawMagnitude: '90',
      triggerPrice: '90',
    },
    tp: {
      estimatedPnl: '10',
      estimatedRoi: '100',
      kind: 'tp',
      mode: 'price',
      rawMagnitude: '110',
      triggerPrice: '110',
    },
  },
  cloids: {
    parent: '0x11111111111111111111111111111111',
    stopLoss: '0x33333333333333333333333333333333',
    takeProfit: '0x22222222222222222222222222222222',
  },
  commandId: 'command-1',
  marketSnapshot: {
    bookTime: 1,
    expectedEntryPrice: '100',
    normalizedBaseSize: '1',
    sessionKey: 'BTC:1',
  },
  parent,
  parentFingerprint: 'parent-1',
  positionIdentity: { entryPx: '', marginUsed: '', szi: '0' },
  reviewFacts: {
    amountUnit: 'quote',
    displayBase: 'BTC',
    displayPair: 'BTCUSDC',
    expectedEntryPrice: '100',
    leverage: 10,
    liquidationGap: -0.5,
    liquidationPrice: '50',
    marginMode: 'isolated',
    markPrice: '100',
    maxLeverage: 20,
    pxDecimals: 2,
    quoteAsset: 'USDC',
    szDecimals: 2,
  },
  runtimeGeneration: 1,
  runtimeIdentity: '0x1::watch',
  type: 'openOrderWithAttachedTpSl',
};

const market = {
  displayBase: 'BTC',
  displayPair: 'BTCUSDC',
  marketData: { markPx: '100', pxDecimals: 2, szDecimals: 2 },
  quoteAsset: 'USDC',
} as PerpsProMarket;

const renderSheet = (
  command: PerpsProAttachedTpSlCommand | PerpsProOpenOrderCommand,
) =>
  render(
    <PerpsProOrderConfirmationSheet
      amountUnit="quote"
      command={command}
      estimatedLiquidation={{ gap: -0.5, price: '50' }}
      leverage={10}
      marginMode="isolated"
      market={market}
      onClose={jest.fn()}
      onConfirm={jest.fn()}
      onToggleSkip={jest.fn()}
      pending={false}
      skipConfirmation={false}
    />,
  );

describe('PerpsProOrderConfirmationSheet attached execution', () => {
  it('uses frozen execution facts, PnL/ROI and a full-fill warning', () => {
    renderSheet(attached);
    expect(screen.getByText('confirmAttachedTpSl')).toBeTruthy();
    expect(screen.getByText('estimatedEntryPrice')).toBeTruthy();
    expect(screen.getByText('estimatedTpPnlRoi')).toBeTruthy();
    expect(screen.getByText('+10.00 USDC / +100.00%')).toBeTruthy();
    expect(screen.getByText('-10.00 USDC / -100.00%')).toBeTruthy();
    expect(screen.getByText('tpSlFullFillWarning')).toBeTruthy();
    expect(screen.getByText('submitAttachedTpSl')).toBeTruthy();
    expect(screen.queryByText('skipConfirmation')).toBeNull();
  });

  it('keeps the existing confirmation preference for an ordinary order', () => {
    renderSheet(parent);
    expect(screen.getByText('confirmOrder')).toBeTruthy();
    expect(screen.getByText('skipConfirmation')).toBeTruthy();
    expect(screen.queryByText('submitAttachedTpSl')).toBeNull();
  });
});
