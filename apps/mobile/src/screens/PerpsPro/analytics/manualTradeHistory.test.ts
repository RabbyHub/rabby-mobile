const mockReport = jest.fn();

jest.mock('@/constant', () => ({
  APP_VERSIONS: { fromNative: '1.2.3' },
}));
jest.mock('@/utils/stats', () => ({
  stats: { report: (...args: unknown[]) => mockReport(...args) },
}));

import type { PerpsCloseAllPositionsCommand } from '@/hooks/perps/actions/closeAllPositions';
import type { PerpsClosePositionCommand } from '@/hooks/perps/actions/closePosition';

import type { PerpsProOpenOrderCommand } from '../actions/openOrder';
import type { PerpsProAttachedTpSlCommand } from '../actions/openOrderWithAttachedTpSl';
import {
  buildPerpsProManualTradeHistoryPayload,
  reportPerpsProAttachedParentHistory,
  reportPerpsProCloseAllHistory,
  reportPerpsProClosePositionHistory,
  reportPerpsProOpenOrderHistory,
} from './manualTradeHistory';

const account = {
  address: '0x1111111111111111111111111111111111111111',
  type: 'PrivateKeyring',
};

const openCommand = (overrides: Partial<PerpsProOpenOrderCommand> = {}) =>
  ({
    account,
    baseSize: '0.2',
    coin: 'BTC',
    dexId: '',
    execution: { kind: 'market', slippageReferenceMidPrice: '100' },
    marketKey: ':BTC',
    orderType: 'market',
    quoteAmount: '20',
    reduceOnly: false,
    reviewFacts: { leverage: 5, marginMode: 'cross' },
    side: 'buy',
    type: 'openOrder',
    ...overrides,
  } as PerpsProOpenOrderCommand);

describe('Perps Pro manual trade history', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('builds the legacy payload without Pro schema extensions', () => {
    expect(
      buildPerpsProManualTradeHistoryPayload({
        account,
        coin: 'hyna:BTC',
        createdAt: 123,
        isBuy: true,
        leverage: 5,
        marginMode: 'cross',
        price: '100.50',
        reduceOnly: false,
        size: '0.2',
        tradeType: 'market',
      }),
    ).toEqual({
      address_type: 'PrivateKeyring',
      app_version: '1.2.3',
      coin: 'hyna:BTC',
      created_at: 123,
      leverage: '5',
      margin_mode: 'cross',
      price: '100.5',
      service_provider: 'hyperliquid',
      size: '0.2',
      trade_side: 'open long',
      trade_type: 'market',
      trade_usd_value: '20.10',
      user_addr: account.address,
    });
  });

  it('reports direct Market/Limit orders and excludes Conditional', () => {
    expect(
      reportPerpsProOpenOrderHistory(openCommand(), {
        acceptance: 'filled',
        oid: 1,
        price: '101',
        size: '0.2',
      }),
    ).toBe(true);
    expect(
      reportPerpsProOpenOrderHistory(
        openCommand({
          execution: { kind: 'limit', limitPrice: '99', tif: 'Gtc' },
          orderType: 'limit',
          reduceOnly: true,
          side: 'sell',
        }),
        { acceptance: 'resting', oid: 2, price: '99', size: '0.2' },
      ),
    ).toBe(true);
    expect(
      reportPerpsProOpenOrderHistory(
        openCommand({
          execution: {
            kind: 'conditionalMarket',
            referencePrice: '100',
            tpsl: 'tp',
            triggerPrice: '110',
          },
          orderType: 'conditional',
        }),
        { acceptance: 'resting', oid: 3, price: '110', size: '0.2' },
      ),
    ).toBe(false);

    expect(mockReport).toHaveBeenCalledTimes(2);
    expect(mockReport.mock.calls[0]?.[1]).toMatchObject({
      price: '101',
      size: '0.2',
      trade_side: 'open long',
      trade_type: 'market',
    });
    expect(mockReport.mock.calls[1]?.[1]).toMatchObject({
      trade_side: 'close long',
      trade_type: 'limit',
    });
  });

  it('reports only the accepted parent of an attached order', () => {
    const command = {
      parent: openCommand(),
    } as PerpsProAttachedTpSlCommand;
    expect(
      reportPerpsProAttachedParentHistory(command, {
        acceptance: 'filled',
        oid: 10,
        price: '102',
        size: '0.2',
      }),
    ).toBe(true);
    expect(mockReport).toHaveBeenCalledTimes(1);
    expect(mockReport.mock.calls[0]?.[1]).toMatchObject({
      trade_type: 'market',
    });
  });

  it('reports explicit closes with frozen position facts', () => {
    const command = {
      account,
      coin: 'BTC',
      direction: 'short',
      orderType: 'limit',
      reportingFacts: { leverage: 3, marginMode: 'isolated' },
    } as PerpsClosePositionCommand;
    expect(
      reportPerpsProClosePositionHistory(command, {
        acceptance: 'resting',
        oid: 20,
        price: '98',
        size: '0.1',
      }),
    ).toBe(true);
    expect(mockReport.mock.calls[0]?.[1]).toMatchObject({
      leverage: '3',
      margin_mode: 'isolated',
      trade_side: 'close short',
      trade_type: 'close limit',
    });
  });

  it('reports only confirmed Close All fills with correct directions', () => {
    const command = {
      account,
      clearinghouseState: {
        assetPositions: [
          {
            position: {
              coin: 'BTC',
              leverage: { type: 'cross', value: 5 },
            },
          },
          {
            position: {
              coin: 'ETH',
              leverage: { type: 'isolated', value: 3 },
            },
          },
        ],
      },
    } as PerpsCloseAllPositionsCommand;
    expect(
      reportPerpsProCloseAllHistory(command, [
        {
          coin: 'BTC',
          price: '100',
          signedSize: '0.2',
          size: '0.2',
        },
        {
          coin: 'ETH',
          price: '50',
          signedSize: '-0.4',
          size: '0.4',
        },
      ]),
    ).toBe(2);
    expect(mockReport.mock.calls.map(call => call[1])).toEqual([
      expect.objectContaining({
        coin: 'BTC',
        trade_side: 'close long',
        trade_type: 'close all market',
      }),
      expect.objectContaining({
        coin: 'ETH',
        trade_side: 'close short',
        trade_type: 'close all market',
      }),
    ]);
  });

  it('does not report malformed confirmed values', () => {
    expect(
      reportPerpsProOpenOrderHistory(openCommand(), {
        acceptance: 'filled',
        price: '',
        size: '0.2',
      }),
    ).toBe(false);
    expect(mockReport).not.toHaveBeenCalled();
  });
});
