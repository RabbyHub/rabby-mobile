const mockReport = jest.fn();

jest.mock('@/constant', () => ({
  APP_VERSIONS: { fromNative: '1.2.3' },
}));
jest.mock('@/utils/stats', () => ({
  stats: { report: (...args: unknown[]) => mockReport(...args) },
}));

import type { PerpsCloseAllPositionsCommand } from '@/hooks/perps/actions/closeAllPositions';
import type { PerpsClosePositionCommand } from '@/hooks/perps/actions/closePosition';
import type {
  PerpsPositionTpSlCommand,
  PerpsPositionTpSlResult,
} from '@/hooks/perps/actions/positionTpSl';

import type { PerpsProOpenOrderCommand } from '../actions/openOrder';
import type { PerpsProAttachedTpSlCommand } from '../actions/openOrderWithAttachedTpSl';
import {
  buildPerpsProManualTradeHistoryPayload,
  reportPerpsProAttachedOrderHistory,
  reportPerpsProCloseAllHistory,
  reportPerpsProClosePositionHistory,
  reportPerpsProOpenOrderHistory,
  reportPerpsProPositionTpSlHistory,
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
        tradeType: 'pro market',
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
      trade_type: 'pro market',
      trade_usd_value: '20.10',
      user_addr: account.address,
    });
  });

  it('reports direct Market and Limit orders with Pro-prefixed types', () => {
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
    expect(mockReport).toHaveBeenCalledTimes(2);
    expect(mockReport.mock.calls[0]?.[1]).toMatchObject({
      price: '101',
      size: '0.2',
      trade_side: 'open long',
      trade_type: 'pro market',
    });
    expect(mockReport.mock.calls[1]?.[1]).toMatchObject({
      trade_side: 'close long',
      trade_type: 'pro limit',
    });
  });

  it.each([
    ['conditionalMarket', 'tp', '110', 'pro take profit market'],
    ['conditionalMarket', 'sl', '90', 'pro stop loss market'],
    ['conditionalLimit', 'tp', '108', 'pro take profit limit'],
    ['conditionalLimit', 'sl', '92', 'pro stop loss limit'],
  ] as const)('reports %s %s as %s', (kind, tpsl, price, tradeType) => {
    const execution =
      kind === 'conditionalMarket'
        ? {
            kind,
            referencePrice: '100',
            tpsl,
            triggerPrice: tpsl === 'tp' ? '110' : '90',
          }
        : {
            kind,
            limitPrice: price,
            referencePrice: '100',
            tpsl,
            triggerPrice: tpsl === 'tp' ? '110' : '90',
          };
    expect(
      reportPerpsProOpenOrderHistory(
        openCommand({ execution, orderType: 'conditional' }),
        { acceptance: 'resting', oid: 3, price, size: '0.2' },
      ),
    ).toBe(true);
    expect(mockReport.mock.lastCall?.[1]).toMatchObject({
      price,
      trade_type: tradeType,
    });
  });

  it.each([
    ['market', 'pro take profit in market', 'pro stop loss in market'],
    ['limit', 'pro take profit in limit', 'pro stop market in limit'],
  ] as const)(
    'reports accepted attached children for a %s parent',
    (executionKind, tpTradeType, slTradeType) => {
      const command = {
        attached: {
          sl: { triggerPrice: '90' },
          tp: { triggerPrice: '110' },
        },
        parent: openCommand({
          execution:
            executionKind === 'market'
              ? { kind: 'market', slippageReferenceMidPrice: '100' }
              : { kind: 'limit', limitPrice: '99', tif: 'Gtc' },
          orderType: executionKind,
        }),
        reviewFacts: { leverage: 5, marginMode: 'cross' },
      } as PerpsProAttachedTpSlCommand;
      expect(
        reportPerpsProAttachedOrderHistory(
          command,
          {
            acceptance: 'filled',
            oid: 10,
            price: '102',
            size: '0.2',
          },
          [
            { acceptance: 'resting', oid: 11, role: 'takeProfit' },
            { acceptance: 'resting', oid: 12, role: 'stopLoss' },
          ],
        ),
      ).toBe(3);
      expect(mockReport.mock.calls.slice(-3).map(call => call[1])).toEqual([
        expect.objectContaining({ trade_type: `pro ${executionKind}` }),
        expect.objectContaining({
          price: '110',
          size: '0.2',
          trade_side: 'close long',
          trade_type: tpTradeType,
        }),
        expect.objectContaining({
          price: '90',
          size: '0.2',
          trade_side: 'close long',
          trade_type: slTradeType,
        }),
      ]);
    },
  );

  it('requires accepted parent evidence before reporting attached children', () => {
    const command = {
      attached: { tp: { triggerPrice: '110' } },
      parent: openCommand(),
      reviewFacts: { leverage: 5, marginMode: 'cross' },
    } as PerpsProAttachedTpSlCommand;
    expect(
      reportPerpsProAttachedOrderHistory(command, undefined, [
        { acceptance: 'resting', oid: 11, role: 'takeProfit' },
      ]),
    ).toBe(0);
    expect(mockReport).not.toHaveBeenCalled();
  });

  it('reports only successful new Position TP/SL legs', () => {
    const command = {
      account,
      coin: 'BTC',
      direction: 'short',
      expectedPositionSize: '1',
      legs: [
        {
          kind: 'takeProfit',
          replaceOid: null,
          size: '0.4',
          triggerPrice: '90',
        },
        {
          kind: 'stopLoss',
          replaceOid: 7,
          size: '0.4',
          triggerPrice: '110',
        },
      ],
      scope: 'partial',
    } as PerpsPositionTpSlCommand;
    const result = {
      kind: 'success',
      legs: [
        {
          cancel: 'notRequired',
          create: 'success',
          kind: 'takeProfit',
          replacedOid: null,
        },
        {
          cancel: 'success',
          create: 'success',
          kind: 'stopLoss',
          replacedOid: 7,
        },
      ],
    } as PerpsPositionTpSlResult;
    expect(
      reportPerpsProPositionTpSlHistory(command, result, {
        leverage: 3,
        marginMode: 'isolated',
      }),
    ).toBe(1);
    expect(mockReport).toHaveBeenCalledTimes(1);
    expect(mockReport.mock.calls[0]?.[1]).toMatchObject({
      leverage: '3',
      margin_mode: 'isolated',
      price: '90',
      size: '0.4',
      trade_side: 'close short',
      trade_type: 'pro partial position take profit',
    });

    mockReport.mockClear();
    expect(
      reportPerpsProPositionTpSlHistory(
        {
          ...command,
          direction: 'long',
          legs: [
            {
              kind: 'stopLoss',
              replaceOid: null,
              size: null,
              triggerPrice: '80',
            },
          ],
          scope: 'position',
        },
        {
          kind: 'success',
          legs: [
            {
              cancel: 'notRequired',
              create: 'success',
              kind: 'stopLoss',
              replacedOid: null,
            },
          ],
        },
        { leverage: 5, marginMode: 'cross' },
      ),
    ).toBe(1);
    expect(mockReport.mock.calls[0]?.[1]).toMatchObject({
      price: '80',
      size: '1',
      trade_side: 'close long',
      trade_type: 'pro position stop loss',
    });
  });

  it('classifies 100% fixed-size orders by Partial command scope', () => {
    expect(
      reportPerpsProPositionTpSlHistory(
        {
          account,
          coin: 'BTC',
          direction: 'long',
          expectedPositionSize: '1',
          legs: [
            {
              kind: 'stopLoss',
              replaceOid: null,
              size: '1',
              triggerPrice: '80',
            },
          ],
          scope: 'partial',
        } as PerpsPositionTpSlCommand,
        {
          kind: 'success',
          legs: [
            {
              cancel: 'notRequired',
              create: 'success',
              kind: 'stopLoss',
              replacedOid: null,
            },
          ],
        } as PerpsPositionTpSlResult,
        { leverage: 5, marginMode: 'cross' },
      ),
    ).toBe(1);
    expect(mockReport.mock.calls[0]?.[1]).toMatchObject({
      size: '1',
      trade_type: 'pro partial position stop loss',
    });
  });

  it.each([
    ['market', 'pro close market'],
    ['limit', 'pro close limit'],
  ] as const)(
    'reports explicit %s closes with frozen position facts',
    (orderType, tradeType) => {
      const command = {
        account,
        coin: 'BTC',
        direction: 'short',
        orderType,
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
        trade_type: tradeType,
      });
    },
  );

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
        trade_type: 'pro close all market',
      }),
      expect.objectContaining({
        coin: 'ETH',
        trade_side: 'close short',
        trade_type: 'pro close all market',
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
