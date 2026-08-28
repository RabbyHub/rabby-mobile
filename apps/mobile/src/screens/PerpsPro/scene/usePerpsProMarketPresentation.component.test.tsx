import type { MarketData } from '@/hooks/perps/usePerpsStore';
import { act, render, screen } from '@testing-library/react-native';
import React from 'react';
import { Text, View } from 'react-native';

jest.mock('@/hooks/perps/usePerpsStore', () => {
  const { create } = require('zustand');
  return {
    perpsStore: create(() => ({ marketDataMap: {} })),
  };
});

import { perpsStore } from '@/hooks/perps/usePerpsStore';
import { usePerpsProMarketIdentity } from './usePerpsProMarketIdentity';
import { usePerpsProPositionMark } from './usePerpsProPositionMark';

const MarketPresentationProbe = () => {
  const identity = usePerpsProMarketIdentity('hyna:BTC');
  const position = usePerpsProPositionMark('hyna:BTC');

  return (
    <View>
      <Text testID="market-identity">
        {`${identity.displayPair}|${identity.quoteAsset ?? '-'}|${
          identity.sourceTag ?? '-'
        }|${String(identity.metadataReady)}`}
      </Text>
      <Text testID="position-market">
        {`${position.displayPair}|${position.quoteAsset ?? '-'}|${
          position.markPrice ?? '-'
        }|${String(position.metadataReady)}`}
      </Text>
    </View>
  );
};

const hynaBtc: MarketData = {
  dayBaseVlm: '1',
  dayNtlVlm: '100',
  dexId: 'hyna',
  displayName: 'BTC',
  funding: '0',
  index: 0,
  logoUrl: '',
  markPx: '64000',
  maxLeverage: 20,
  maxUsdValueSize: '1000000',
  midPx: '64000',
  minLeverage: 1,
  name: 'hyna:BTC',
  openInterest: '1',
  oraclePx: '64000',
  premium: '0',
  prevDayPx: '63000',
  pxDecimals: 0,
  quoteAsset: 'USDE',
  szDecimals: 5,
};

describe('Perps Pro market presentation hooks', () => {
  const initialMarketDataMap = perpsStore.getState().marketDataMap;

  beforeEach(() => {
    perpsStore.setState({ marketDataMap: {} });
  });

  afterAll(() => {
    perpsStore.setState({ marketDataMap: initialMarketDataMap });
  });

  it('updates the canonical fallback in place when market metadata hydrates', () => {
    render(<MarketPresentationProbe />);

    expect(screen.getByTestId('market-identity')).toHaveTextContent(
      'BTC|-|hyna|false',
    );
    expect(screen.getByTestId('position-market')).toHaveTextContent(
      'BTC|-|-|false',
    );

    act(() => {
      perpsStore.setState({ marketDataMap: { 'hyna:BTC': hynaBtc } });
    });

    expect(screen.getByTestId('market-identity')).toHaveTextContent(
      'BTCUSDE|USDE|hyna|true',
    );
    expect(screen.getByTestId('position-market')).toHaveTextContent(
      'BTCUSDE|USDE|64000|true',
    );
  });
});
