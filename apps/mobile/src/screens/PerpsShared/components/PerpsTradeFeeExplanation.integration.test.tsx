import { Text } from '@/components/Typography';
import {
  useHideTipsPopup,
  useIsTipsPopupVisible,
  useShowTipsPopup,
  useTipsPopup,
} from '@/hooks/useTipsPopup';
import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import { Pressable, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import type { WsFill } from '@rabby-wallet/hyperliquid-sdk';
import { PerpsProHistoryList } from '@/screens/PerpsProHistory/components/PerpsProHistoryList';
import { mapPerpsProTradeHistoryFact } from '@/screens/PerpsProHistory/model/tradeHistory';

import { useShowPerpsTradeFeeExplanation } from './PerpsTradeFeeExplanation';

let triggerRenderCount = 0;

const currentFill: WsFill = {
  coin: 'BTC',
  px: '10000',
  sz: '1',
  fee: '8.5',
  builderFee: '4',
  feeToken: 'USDC',
  closedPnl: '0',
  crossed: true,
  dir: 'Open Long',
  hash: '0xfill',
  oid: 1,
  side: 'B',
  startPosition: '0',
  tid: 1,
  time: 100,
};
const historicalFill = { ...currentFill, fee: '6.5', builderFee: '2', tid: 2 };

const FeeExplanationTrigger = () => {
  const showFeeExplanation = useShowPerpsTradeFeeExplanation();
  triggerRenderCount += 1;

  return (
    <Pressable
      onPress={() => showFeeExplanation(false, currentFill)}
      testID="open-fee-explanation">
      <Text>Open fee explanation</Text>
    </Pressable>
  );
};

const ScopedTipsControls = () => {
  const hideHistoryTips = useHideTipsPopup('perps-pro-history-fee');
  const showHistoryFeeExplanation = useShowPerpsTradeFeeExplanation({
    owner: 'perps-pro-history-fee',
    variant: 'pro',
  });
  const showTipsPopup = useShowTipsPopup();

  return (
    <View>
      <Pressable
        onPress={() => showHistoryFeeExplanation(false, currentFill)}
        testID="open-owned-fee-explanation"
      />
      <Pressable
        onPress={() =>
          showTipsPopup({
            desc: 'Other description',
            owner: 'other-screen',
            title: 'Other title',
          })
        }
        testID="open-other-explanation"
      />
      <Pressable
        onPress={hideHistoryTips}
        testID="close-owned-fee-explanation"
      />
    </View>
  );
};

const OwnedVisibilityProbe = () => {
  const historyVisible = useIsTipsPopupVisible('perps-pro-history-fee');
  const otherVisible = useIsTipsPopupVisible('other-screen');
  return (
    <Text testID="owned-fee-visibility">
      {`${String(historyVisible)}:${String(otherVisible)}`}
    </Text>
  );
};

const TipsPopupStateProbe = () => {
  const { hideTipsPopup, state } = useTipsPopup();
  const descVariant = React.isValidElement<{ variant?: string }>(state.desc)
    ? state.desc.props.variant
    : undefined;

  return (
    <View>
      <Pressable onPress={hideTipsPopup} testID="close-fee-explanation">
        <Text>Close fee explanation</Text>
      </Pressable>
      <Text testID="fee-explanation-state">
        {state.visible
          ? `${state.title}:${state.buttonType}:${React.isValidElement(
              state.desc,
            )}:${descVariant ?? 'none'}`
          : 'closed'}
      </Text>
      <Text testID="fee-explanation-presentation">{`${state.retainContentOnClose}:${state.buttonTitle}`}</Text>
      {state.visible && React.isValidElement(state.desc) ? state.desc : null}
    </View>
  );
};

const FeeExplanationHarness = ({
  children,
}: {
  children?: React.ReactNode;
}) => (
  <SafeAreaProvider
    initialMetrics={{
      frame: { x: 0, y: 0, width: 390, height: 844 },
      insets: { top: 0, right: 0, bottom: 0, left: 0 },
    }}>
    <FeeExplanationTrigger />
    <ScopedTipsControls />
    <OwnedVisibilityProbe />
    <TipsPopupStateProbe />
    {children}
  </SafeAreaProvider>
);

const HistoryHarness = ({
  fill,
  active = true,
}: {
  fill: WsFill;
  active?: boolean;
}) => (
  <FeeExplanationHarness>
    <PerpsProHistoryList
      active={active}
      amountUnit="base"
      onLoadEarlier={() => undefined}
      onRefresh={() => undefined}
      onRetry={() => undefined}
      state={{
        hasEarlier: false,
        loadingEarlier: false,
        refreshing: false,
        rows: [mapPerpsProTradeHistoryFact(fill, {})],
        status: 'ready',
      }}
      tab="trade"
    />
  </FeeExplanationHarness>
);

describe('Perps Trade Fee explanation integration', () => {
  it('carries each real Pro row through the list, hook and Tips atom without stale fees', () => {
    triggerRenderCount = 0;
    const view = render(<HistoryHarness fill={historicalFill} />);
    fireEvent.press(screen.getByLabelText('page.perps.historyDetail.feeTitle'));
    expect(screen.getByText('0.02%')).toBeTruthy();
    expect(screen.getByText('0.045%')).toBeTruthy();
    expect(screen.queryByText('0.04%')).toBeNull();
    expect(triggerRenderCount).toBe(1);
    expect(screen.getByTestId('owned-fee-visibility')).toHaveTextContent(
      'true:false',
    );
    fireEvent.press(screen.getByTestId('close-owned-fee-explanation'));

    view.rerender(<HistoryHarness fill={currentFill} active={false} />);
    fireEvent.press(screen.getByLabelText('page.perps.historyDetail.feeTitle'));
    expect(screen.getByTestId('fee-explanation-state')).toHaveTextContent(
      'closed',
    );

    view.rerender(<HistoryHarness fill={currentFill} />);
    fireEvent.press(screen.getByLabelText('page.perps.historyDetail.feeTitle'));
    expect(screen.getByText('0.04%')).toBeTruthy();
    expect(screen.queryByText('0.02%')).toBeNull();
    fireEvent.press(screen.getByTestId('close-owned-fee-explanation'));

    for (const builderFee of ['0', undefined, 'invalid', '3']) {
      view.rerender(
        <HistoryHarness fill={{ ...currentFill, builderFee, fee: '0' }} />,
      );
      fireEvent.press(
        screen.getByLabelText('page.perps.historyDetail.feeTitle'),
      );
      expect(screen.getByText('0.04%')).toBeTruthy();
      expect(screen.getByText('0.045%')).toBeTruthy();
      expect(screen.queryByText('0.00%')).toBeNull();
      expect(screen.queryByText('0.02%')).toBeNull();
      expect(screen.queryByText('-')).toBeNull();
      fireEvent.press(screen.getByTestId('close-owned-fee-explanation'));
    }
  });

  it.each(['0', '-10', 'invalid'])(
    'keeps both displayed rates independent of total fee and its currency (%s)',
    fee => {
      render(
        <HistoryHarness fill={{ ...historicalFill, fee, feeToken: 'HYPE' }} />,
      );
      fireEvent.press(
        screen.getByLabelText('page.perps.historyDetail.feeTitle'),
      );
      expect(screen.getByText('0.02%')).toBeTruthy();
      expect(screen.getByText('0.045%')).toBeTruthy();
      fireEvent.press(screen.getByTestId('close-owned-fee-explanation'));
    },
  );

  it('publishes the shared explanation through the real Tips atom', () => {
    triggerRenderCount = 0;
    render(<FeeExplanationHarness />);

    expect(triggerRenderCount).toBe(1);
    expect(screen.getByTestId('fee-explanation-state')).toHaveTextContent(
      'closed',
    );

    fireEvent.press(screen.getByTestId('open-fee-explanation'));
    expect(
      screen.getByTestId('fee-explanation-presentation'),
    ).toHaveTextContent('true:page.perps.pro.funding.gotIt');
    expect(screen.getByTestId('fee-explanation-state')).toHaveTextContent(
      'page.perps.historyDetail.feeTitle:hyperliquid:true:default',
    );
    expect(triggerRenderCount).toBe(1);

    expect(screen.getByText('0.04%')).toBeTruthy();
    expect(screen.getByText('0.045%')).toBeTruthy();
    expect(screen.queryByText('0.02%')).toBeNull();
    expect(screen.queryByTestId('perps-trade-fee-rabby-discount')).toBeNull();
    fireEvent.press(screen.getByTestId('close-fee-explanation'));
    expect(screen.getByTestId('fee-explanation-state')).toHaveTextContent(
      'closed',
    );
  });

  it('lets History close only the Fee explanation it owns', () => {
    render(<FeeExplanationHarness />);

    fireEvent.press(screen.getByTestId('open-owned-fee-explanation'));
    expect(screen.getByText('0.04%')).toBeTruthy();
    expect(screen.queryByTestId('perps-trade-fee-rabby-discount')).toBeNull();
    expect(
      screen.getByTestId('fee-explanation-presentation'),
    ).toHaveTextContent('true:page.perps.pro.funding.gotIt');
    expect(screen.getByTestId('owned-fee-visibility')).toHaveTextContent(
      'true:false',
    );
    expect(screen.getByTestId('fee-explanation-state')).toHaveTextContent(
      'page.perps.historyDetail.feeTitle:hyperliquid:true:pro',
    );
    fireEvent.press(screen.getByTestId('close-owned-fee-explanation'));
    expect(screen.getByTestId('fee-explanation-state')).toHaveTextContent(
      'closed',
    );

    fireEvent.press(screen.getByTestId('open-other-explanation'));
    expect(screen.getByTestId('owned-fee-visibility')).toHaveTextContent(
      'false:true',
    );
    expect(screen.getByTestId('fee-explanation-state')).toHaveTextContent(
      'Other title:undefined:false:none',
    );
    fireEvent.press(screen.getByTestId('close-owned-fee-explanation'));
    expect(screen.getByTestId('fee-explanation-state')).toHaveTextContent(
      'Other title:undefined:false:none',
    );
    fireEvent.press(screen.getByTestId('close-fee-explanation'));
  });
});
