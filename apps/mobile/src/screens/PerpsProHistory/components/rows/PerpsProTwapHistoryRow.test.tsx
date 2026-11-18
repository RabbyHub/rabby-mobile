import React from 'react';
import { FlatList, View, StyleSheet } from 'react-native';
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import type { PerpsTwapRecord } from '@/hooks/perps/twap/types';
import { loadPerpsTwapFills } from '@/hooks/perps/twap/twapRepository';
import { PerpsProTwapHistoryRowView } from './PerpsProTwapHistoryRow';
import { PerpsProTwapCard } from '@/screens/PerpsPro/components/twap/PerpsProTwapCard';
import { PerpsProTwapDetailSheet } from '@/screens/PerpsPro/components/twap/PerpsProTwapDetailSheet';

jest.mock('@/components/Typography', () => ({
  Text: require('react-native').Text,
}));
jest.mock('@/components/AutoLockView', () => require('react-native').View);
jest.mock('@/assets2024/icons/common/right-cc.svg', () => {
  const React = require('react');
  return () =>
    React.createElement(require('react-native').View, {
      testID: 'history-arrow',
    });
});
jest.mock(
  '@/assets2024/icons/perps/PerpsHeaderBack.svg',
  () => require('react-native').View,
);
jest.mock('@gorhom/bottom-sheet', () => ({
  BottomSheetFlatList: require('react-native').FlatList,
}));
jest.mock('@/components/customized/BottomSheet', () => ({
  AppBottomSheetModal: ({ children }: React.PropsWithChildren) => children,
}));
jest.mock('@/components2024/GlobalBottomSheetModal/utils-help', () => ({
  makeBottomSheetProps: () => ({}),
}));
jest.mock(
  '@/screens/PerpsPro/components/common/PerpsProDialogBackdrop',
  () => ({ PerpsProDialogBackdrop: () => null }),
);
jest.mock(
  '@/screens/PerpsPro/components/common/perpsProSheetNavigationRegistry',
  () => ({ usePerpsProSheetNavigationRegistration: () => {} }),
);
jest.mock('@/screens/PerpsPro/scene/usePerpsProTradePreferences', () => ({
  usePerpsProTradeAmountUnit: () => 'base',
}));
jest.mock('@/hooks/perps/twap/usePerpsTwapStore', () => ({
  usePerpsTwapRecord: () => null,
  usePerpsTwapFills: () => [],
  addPerpsTwapFills: jest.fn(),
}));
jest.mock('@/hooks/perps/twap/twapRepository', () => ({
  loadPerpsTwapFills: jest.fn(async () => ({ fills: [], complete: true })),
}));
jest.mock('@/hooks/perps/usePerpsStore', () => ({
  perpsStore: jest.requireActual('zustand/vanilla').createStore(() => ({
    marketDataMap: {},
  })),
}));
jest.mock('@/hooks/theme', () => ({
  useTheme2024: ({ getStyle }: { getStyle: (ctx: object) => object }) => {
    const colors2024 = new Proxy({}, { get: (_, key) => String(key) });
    return {
      colors2024,
      styles: getStyle({
        colors2024,
        safeAreaInsets: { bottom: 0 },
        isLight: true,
      }),
    };
  },
}));
jest.mock('@/utils/styles', () => ({
  createGetStyles2024: (factory: unknown) => factory,
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key.split('.').pop() }),
}));

const endedOrder: PerpsTwapRecord = {
  key: 'BTC:42',
  twapId: 42,
  active: false,
  status: 'finished',
  eventTime: 60000,
  endedAt: 60000,
  state: {
    coin: 'BTC',
    user: '0x1',
    side: 'B',
    sz: '10',
    executedSz: '10',
    executedNtl: '100',
    minutes: 5,
    randomize: false,
    reduceOnly: false,
    timestamp: 0,
  },
};

it.each([
  ['finished', 'filled', '10', '100%'],
  ['terminated', 'cancelled', '0', '0%'],
  ['error', 'expired', '3.16', '31.6%'],
])(
  'opens the %s card and restores the history row on back',
  async (status, label, executedSz, percent) => {
    const order = {
      ...endedOrder,
      status,
      state: { ...endedOrder.state, executedSz },
    };
    render(
      <PerpsProTwapHistoryRowView
        active
        amountUnit="base"
        row={{ kind: 'twap', order, time: order.eventTime, key: order.key }}
      />,
    );
    expect(screen.getByText(label)).toBeTruthy();
    expect(screen.getByTestId('history-arrow')).toBeTruthy();
    expect(screen.queryByText(/%$/)).toBeNull();
    expect(!!screen.queryByText(/endedLabel$/)).toBe(status === 'finished');
    fireEvent.press(screen.getByRole('button'));
    await waitFor(() => expect(screen.getByText('noTrades')).toBeTruthy());
    expect(screen.getByText(percent)).toBeTruthy();
    expect(screen.getByText('historyDetailTitle')).toBeTruthy();
    expect(
      screen.UNSAFE_getByType(FlatList).props.showsVerticalScrollIndicator,
    ).toBe(false);
    fireEvent.press(screen.getByRole('button', { name: 'back' }));
    expect(screen.queryByText(percent)).toBeNull();
    expect(screen.getByTestId('history-arrow')).toBeTruthy();
  },
);

it('removes the retry footer when a retry returns partial trades', async () => {
  jest
    .mocked(loadPerpsTwapFills)
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValueOnce({ fills: [], complete: false });
  render(<PerpsProTwapDetailSheet order={endedOrder} onClose={jest.fn()} />);

  fireEvent.press(await screen.findByText('error'));
  await waitFor(() =>
    expect(
      screen.UNSAFE_getByType(FlatList).props.ListFooterComponent,
    ).toBeNull(),
  );
  expect(screen.queryByText('noTrades')).toBeNull();
});

it.each([
  ['runningDetail', 'B'],
  ['runningDetail', 'A'],
  ['openOrder', 'B'],
  ['openOrder', 'A'],
] as const)(
  'renders rounded neutral progress in %s for side %s',
  (variant, side) => {
    const order: PerpsTwapRecord = {
      ...endedOrder,
      active: true,
      status: 'activated',
      endedAt: null,
      state: { ...endedOrder.state, side, executedSz: '3.16' },
    };
    render(
      <PerpsProTwapCard
        order={order}
        amountUnit="base"
        now={0}
        active={false}
        variant={variant}
      />,
    );
    expect(screen.getByText('31.6%')).toBeTruthy();
    expect(!!screen.queryByText('working')).toBe(variant === 'runningDetail');
    expect(screen.queryByTestId('history-arrow')).toBeNull();
    const viewStyles = screen
      .UNSAFE_getAllByType(View)
      .map(view => StyleSheet.flatten(view.props.style));
    expect(viewStyles).toContainEqual(
      expect.objectContaining({ width: 32, height: 2, borderRadius: 1 }),
    );
    expect(viewStyles).toContainEqual(
      expect.objectContaining({
        width: '31.6%',
        backgroundColor: 'neutral-secondary',
        borderRadius: 1,
      }),
    );
  },
);
