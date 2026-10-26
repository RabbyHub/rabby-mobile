// perps.ts imports the SDK singleton and services at module scope, but this
// test exercises only its pure market formatter.
jest.mock('@/core/apis/perps', () => ({ apisPerps: {} }));
jest.mock('@/core/services', () => ({ perpsService: {} }));

import type { Meta } from '@rabby-wallet/hyperliquid-sdk';
import type { PerpTopTokenV3 } from '@rabby-wallet/rabby-api/dist/types';

import { formatMarkData } from '@/utils/perps';

import {
  buildPerpsProMarketRowModel,
  buildPerpsProMarketSlotOrders,
  reconcilePerpsProMarketSelectorProjection,
} from './marketSelectorProjection';

describe('Perps Pro market data completeness', () => {
  it('carries KORUUSDC and its brief from raw catalogue data through search and row projection', () => {
    const nativeUniverse: Meta['universe'] = [
      {
        maxLeverage: 50,
        name: 'BTC',
        szDecimals: 5,
      },
    ];
    const xyzUniverse: Meta['universe'] = [];
    xyzUniverse[103] = {
      maxLeverage: 3,
      name: 'xyz:KORU',
      szDecimals: 2,
    };
    const allMetas: Meta[] = [
      {
        collateralToken: 0,
        marginTables: [],
        universe: nativeUniverse,
      },
      {
        collateralToken: 0,
        marginTables: [],
        universe: xyzUniverse,
      },
    ];
    const topAssets = [
      {
        brief: 'Direxion Daily MSCI South Korea Bull 3X Shares',
        category: 'Stocks',
        category_id: 'stocks',
        dex_id: 'xyz',
        display_name: 'KORU',
        full_logo_url: 'https://example.test/koru.png',
        name: 'xyz:KORU',
        token_id: 103,
      } as unknown as PerpTopTokenV3,
    ];

    const marketData = formatMarkData(allMetas, topAssets, {
      0: '',
      1: 'xyz',
    });
    const storeMap = Object.fromEntries(
      marketData.map(market => [market.name, market]),
    );
    const projection = reconcilePerpsProMarketSelectorProjection(marketData);
    const searchResult = buildPerpsProMarketSlotOrders(
      projection,
      'all',
      [],
      'KORUUSDC',
    ).name.asc;
    const rowModel = buildPerpsProMarketRowModel(marketData[0]);

    expect(marketData).toHaveLength(1);
    expect(storeMap['xyz:KORU']).toBe(marketData[0]);
    expect(searchResult).toEqual([
      expect.objectContaining({
        canonicalCoin: 'xyz:KORU',
        marketKey: 'xyz::xyz:KORU',
      }),
    ]);
    expect(rowModel).toMatchObject({
      canonicalCoin: 'xyz:KORU',
      displayPair: 'KORUUSDC',
      fullName: 'Direxion Daily MSCI South Korea Bull 3X Shares',
    });
  });
});
