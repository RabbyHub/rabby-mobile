import React, { type ReactNode } from 'react';
import { act, renderHook } from '@testing-library/react-native';
import { createStore } from 'zustand/vanilla';
import type { AssetPosition } from '@rabby-wallet/hyperliquid-sdk';

import { createStoreActivityScope } from '@/core/state/storeActivity';
import { StoreActivityProvider } from '@/hooks/storeActivity/StoreActivityProvider';
import { useActivityStore } from '@/hooks/storeActivity/useActivityStore';
import {
  areHomePerpsPositionsEqual,
  selectHomePerpsPositions,
  type HomePerpsPositionSource,
} from './positionSelector';

function makePosition(coin = 'ETH'): AssetPosition {
  return {
    type: 'oneWay',
    position: {
      coin,
      entryPx: '2000',
      szi: '1',
      positionValue: '2100',
      marginUsed: '500',
      unrealizedPnl: '100',
      liquidationPx: '1500',
      leverage: { type: 'cross', value: 4 },
    },
  } as AssetPosition;
}

function makeSource(): HomePerpsPositionSource {
  return {
    clearinghouseStateMap: {
      '0xabc': { assetPositions: [makePosition()], time: 1 },
    },
    marketDataMap: {
      ETH: {
        quoteAsset: 'USDC',
        logoUrl: 'eth.png',
        displayName: 'Ether',
        markPx: '2100',
      },
      BTC: {
        quoteAsset: 'USDC',
        logoUrl: 'btc.png',
        displayName: 'Bitcoin',
        markPx: '90000',
      },
    },
  } as HomePerpsPositionSource;
}

// JS integration: the real scene selector, activity scope, React hook and
// vanilla Zustand publication cooperate. This does not exercise the Perps
// websocket/service runtime or native rendering performance.
describe('Home Perps position selection and activity publication', () => {
  function setup() {
    const store = createStore<HomePerpsPositionSource>(() => makeSource());
    const scope = createStoreActivityScope({
      active: true,
      label: 'home-perps-position-selection-test',
    });
    const published = jest.fn();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <StoreActivityProvider scope={scope}>{children}</StoreActivityProvider>
    );
    const view = renderHook(
      () => {
        const snapshot = useActivityStore(
          store,
          selectHomePerpsPositions,
          areHomePerpsPositionsEqual,
        );
        published(snapshot);
        return snapshot;
      },
      { wrapper },
    );
    return {
      ...view,
      store,
      scope,
      published,
      cleanup: () => {
        view.unmount();
        scope.dispose();
      },
    };
  }

  it('ignores unrelated markets and held-coin ticker-only changes', () => {
    const view = setup();
    try {
      const initial = view.result.current;
      const initialPublications = view.published.mock.calls.length;
      for (const coin of ['BTC', 'ETH']) {
        act(() => {
          view.store.setState(state => ({
            marketDataMap: {
              ...state.marketDataMap,
              [coin]: { ...state.marketDataMap[coin], markPx: '99999' },
            },
          }));
        });
        expect(view.result.current).toBe(initial);
        expect(view.published).toHaveBeenCalledTimes(initialPublications);
        expect(view.store.getState().marketDataMap[coin].markPx).toBe('99999');
      }
      act(() => {
        view.store.setState(state => ({
          marketDataMap: {
            ...state.marketDataMap,
            BTC: { ...state.marketDataMap.BTC, displayName: 'New Bitcoin' },
          },
        }));
      });
      expect(view.result.current).toBe(initial);
      expect(view.published).toHaveBeenCalledTimes(initialPublications);
      expect(Object.keys(initial.marketMetadataByCoin)).toEqual(['ETH']);
      expect(initial.marketMetadataByCoin.ETH).not.toHaveProperty('markPx');
    } finally {
      view.cleanup();
    }
  });

  it.each([
    ['quoteAsset', 'USDH'],
    ['logoUrl', 'new-eth.png'],
    ['displayName', 'New Ether'],
  ] as const)('publishes held-coin %s changes', (field, value) => {
    const view = setup();
    try {
      const initial = view.result.current;
      act(() => {
        view.store.setState(state => ({
          marketDataMap: {
            ...state.marketDataMap,
            ETH: { ...state.marketDataMap.ETH, [field]: value },
          },
        }));
      });
      expect(view.result.current).not.toBe(initial);
      expect(view.result.current.marketMetadataByCoin.ETH?.[field]).toBe(value);
    } finally {
      view.cleanup();
    }
  });

  it.each([
    { positionValue: '2400' },
    { leverage: { type: 'isolated', value: 3 } },
    { liquidationPx: '1700' },
    { unrealizedPnl: '400' },
  ] as Partial<AssetPosition['position']>[])(
    'publishes every real position snapshot without hiding risk changes: %j',
    change => {
      const view = setup();
      try {
        const previous = view.result.current;
        const position = makePosition();
        const updated = {
          ...position,
          position: { ...position.position, ...change },
        };
        act(() => {
          view.store.setState(state => ({
            clearinghouseStateMap: {
              ...state.clearinghouseStateMap,
              '0xabc': {
                ...state.clearinghouseStateMap['0xabc']!,
                assetPositions: [updated],
                time: 2,
              },
            },
          }));
        });
        expect(view.result.current).not.toBe(previous);
        expect(
          view.result.current.clearinghouseStateMap['0xabc']!.assetPositions[0],
        ).toBe(updated);
      } finally {
        view.cleanup();
      }
    },
  );

  it('tracks position add, removal, all closed and missing/arriving metadata', () => {
    const view = setup();
    try {
      for (const coins of [['ETH', 'BTC', 'SOL'], ['BTC', 'SOL'], []]) {
        act(() => {
          view.store.setState(state => ({
            clearinghouseStateMap: {
              '0xabc': {
                ...state.clearinghouseStateMap['0xabc']!,
                assetPositions: coins.map(makePosition),
              },
            },
          }));
        });
        expect(Object.keys(view.result.current.marketMetadataByCoin)).toEqual(
          coins,
        );
      }
      act(() => {
        view.store.setState(state => ({
          clearinghouseStateMap: {
            '0xabc': {
              ...state.clearinghouseStateMap['0xabc']!,
              assetPositions: [makePosition('SOL')],
            },
          },
        }));
      });
      expect(view.result.current.marketMetadataByCoin.SOL).toBeUndefined();
      act(() => {
        view.store.setState(state => ({
          marketDataMap: {
            ...state.marketDataMap,
            SOL: { ...state.marketDataMap.ETH, displayName: 'Solana' },
          },
        }));
      });
      expect(view.result.current.marketMetadataByCoin.SOL?.displayName).toBe(
        'Solana',
      );
      act(() => view.store.setState({ clearinghouseStateMap: {} }));
      expect(view.result.current.clearinghouseStateMap).toEqual({});
      expect(view.result.current.marketMetadataByCoin).toEqual({});
    } finally {
      view.cleanup();
    }
  });

  it('keeps metadata for a coin still held by another account', () => {
    const view = setup();
    try {
      act(() => {
        view.store.setState(state => ({
          clearinghouseStateMap: {
            ...state.clearinghouseStateMap,
            '0xdef': {
              ...state.clearinghouseStateMap['0xabc']!,
              assetPositions: [makePosition()],
            },
          },
        }));
      });
      expect(Object.keys(view.result.current.marketMetadataByCoin)).toEqual([
        'ETH',
      ]);
      act(() => {
        view.store.setState(state => ({
          clearinghouseStateMap: {
            ...state.clearinghouseStateMap,
            '0xabc': {
              ...state.clearinghouseStateMap['0xabc']!,
              assetPositions: [],
            },
          },
        }));
      });
      expect(Object.keys(view.result.current.marketMetadataByCoin)).toEqual([
        'ETH',
      ]);
      expect(
        view.result.current.clearinghouseStateMap['0xdef']!.assetPositions,
      ).toHaveLength(1);
    } finally {
      view.cleanup();
    }
  });

  it('retains the existing inactive boundary and catches up once to latest', () => {
    const view = setup();
    try {
      const initial = view.result.current;
      act(() => view.scope.setActive(false));
      const count = view.published.mock.calls.length;
      for (const value of ['2200', '2300', '2400']) {
        act(() => {
          view.store.setState(state => ({
            clearinghouseStateMap: {
              '0xabc': {
                ...state.clearinghouseStateMap['0xabc']!,
                assetPositions: [
                  {
                    ...makePosition(),
                    position: {
                      ...makePosition().position,
                      positionValue: value,
                    },
                  },
                ],
              },
            },
            marketDataMap: {
              ...state.marketDataMap,
              ETH: {
                ...state.marketDataMap.ETH,
                displayName: `Ether ${value}`,
              },
            },
          }));
        });
      }
      expect(view.result.current).toBe(initial);
      expect(view.published).toHaveBeenCalledTimes(count);
      expect(
        view.store.getState().clearinghouseStateMap['0xabc']!.assetPositions[0]
          .position.positionValue,
      ).toBe('2400');
      act(() => view.scope.setActive(true));
      expect(view.published).toHaveBeenCalledTimes(count + 1);
      expect(
        view.result.current.clearinghouseStateMap['0xabc']!.assetPositions[0]
          .position.positionValue,
      ).toBe('2400');
      expect(view.result.current.marketMetadataByCoin.ETH?.displayName).toBe(
        'Ether 2400',
      );
    } finally {
      view.cleanup();
    }
  });
});
