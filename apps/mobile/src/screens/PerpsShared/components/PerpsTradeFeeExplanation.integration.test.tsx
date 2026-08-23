import { Text } from '@/components/Typography';
import {
  useHideTipsPopup,
  useShowTipsPopup,
  useTipsPopup,
} from '@/hooks/useTipsPopup';
import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import { Pressable, View } from 'react-native';

import { useShowPerpsTradeFeeExplanation } from './PerpsTradeFeeExplanation';

let triggerRenderCount = 0;

const FeeExplanationTrigger = () => {
  const showFeeExplanation = useShowPerpsTradeFeeExplanation();
  triggerRenderCount += 1;

  return (
    <Pressable
      onPress={() => showFeeExplanation(false)}
      testID="open-fee-explanation">
      <Text>Open fee explanation</Text>
    </Pressable>
  );
};

const ScopedTipsControls = () => {
  const hideHistoryTips = useHideTipsPopup('perps-pro-history-fee');
  const showHistoryFeeExplanation = useShowPerpsTradeFeeExplanation(
    'perps-pro-history-fee',
  );
  const showTipsPopup = useShowTipsPopup();

  return (
    <View>
      <Pressable
        onPress={() => showHistoryFeeExplanation(false)}
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

const TipsPopupStateProbe = () => {
  const { hideTipsPopup, state } = useTipsPopup();

  return (
    <View>
      <Pressable onPress={hideTipsPopup} testID="close-fee-explanation">
        <Text>Close fee explanation</Text>
      </Pressable>
      <Text testID="fee-explanation-state">
        {state.visible
          ? `${state.title}:${state.buttonType}:${React.isValidElement(
              state.desc,
            )}`
          : 'closed'}
      </Text>
    </View>
  );
};

const FeeExplanationHarness = () => (
  <View>
    <FeeExplanationTrigger />
    <ScopedTipsControls />
    <TipsPopupStateProbe />
  </View>
);

describe('Perps Trade Fee explanation integration', () => {
  it('publishes the shared explanation through the real Tips atom', () => {
    triggerRenderCount = 0;
    render(<FeeExplanationHarness />);

    expect(triggerRenderCount).toBe(1);
    expect(screen.getByTestId('fee-explanation-state')).toHaveTextContent(
      'closed',
    );

    fireEvent.press(screen.getByTestId('open-fee-explanation'));
    expect(screen.getByTestId('fee-explanation-state')).toHaveTextContent(
      'page.perps.historyDetail.feeTitle:hyperliquid:true',
    );
    expect(triggerRenderCount).toBe(1);

    fireEvent.press(screen.getByTestId('close-fee-explanation'));
    expect(screen.getByTestId('fee-explanation-state')).toHaveTextContent(
      'closed',
    );
  });

  it('lets History close only the Fee explanation it owns', () => {
    render(<FeeExplanationHarness />);

    fireEvent.press(screen.getByTestId('open-owned-fee-explanation'));
    expect(screen.getByTestId('fee-explanation-state')).toHaveTextContent(
      'page.perps.historyDetail.feeTitle:hyperliquid:true',
    );
    fireEvent.press(screen.getByTestId('close-owned-fee-explanation'));
    expect(screen.getByTestId('fee-explanation-state')).toHaveTextContent(
      'closed',
    );

    fireEvent.press(screen.getByTestId('open-other-explanation'));
    expect(screen.getByTestId('fee-explanation-state')).toHaveTextContent(
      'Other title:undefined:false',
    );
    fireEvent.press(screen.getByTestId('close-owned-fee-explanation'));
    expect(screen.getByTestId('fee-explanation-state')).toHaveTextContent(
      'Other title:undefined:false',
    );
  });
});
