import type { UserHistoricalOrders } from '@rabby-wallet/hyperliquid-sdk';
import { render, screen } from '@testing-library/react-native';
import React from 'react';

jest.mock('@/components/Typography', () => ({
  Text: require('react-native').Text,
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
  useTranslation: () => ({ t: (key: string) => key }),
}));

import { mapPerpsProOrderHistoryFact } from '../model/orderHistory';
import { PerpsProHistoryRowView } from './PerpsProHistoryRow';

const makeOrder = (orderType: string): UserHistoricalOrders => ({
  order: {
    children: [],
    cloid: null,
    coin: 'DOGE',
    isPositionTpsl: orderType !== 'Limit',
    isTrigger: orderType !== 'Limit',
    limitPx: '0.2',
    oid: 7,
    orderType,
    origSz: '100',
    reduceOnly: orderType !== 'Limit',
    side: 'A',
    sz: '25',
    tif: 'Gtc',
    timestamp: 90,
    triggerCondition: orderType === 'Limit' ? '' : 'Price above 0.19',
    triggerPx: orderType === 'Limit' ? '0' : '0.19',
  },
  status: 'open',
  statusTimestamp: 100,
});

describe('PerpsProHistoryRowView Orders', () => {
  it('renders Limit Amount and Filled in quote', () => {
    render(
      <PerpsProHistoryRowView
        row={mapPerpsProOrderHistoryFact(makeOrder('Limit'), {})}
      />,
    );

    expect(screen.getByText('20.00 USDC')).toBeTruthy();
    expect(screen.getByText('15.00 USDC')).toBeTruthy();
    expect(screen.getByText('$0.2000')).toBeTruthy();
  });

  it('renders TP/SL Market Amount and Filled in base while Price remains Market', () => {
    render(
      <PerpsProHistoryRowView
        row={mapPerpsProOrderHistoryFact(makeOrder('Take Profit Market'), {})}
      />,
    );

    expect(screen.getByText('100 DOGE')).toBeTruthy();
    expect(screen.getByText('75 DOGE')).toBeTruthy();
    expect(screen.getByText('page.perps.pro.history.market')).toBeTruthy();
    expect(screen.queryByText('20.00 USDC')).toBeNull();
  });
});
