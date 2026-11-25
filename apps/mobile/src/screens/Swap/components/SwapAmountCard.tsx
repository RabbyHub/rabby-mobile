import BigNumber from 'bignumber.js';
import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import type { TokenItem } from '@rabby-wallet/rabby-api/dist/types';
import { trigger } from 'react-native-haptic-feedback';

import type { Account } from '@/core/startupServices/preference';
import { useValueFromSharedValue } from '@/hooks/reanimated';
import {
  swapFormStore,
  useSwapForm,
} from '@/screens/SwapBridge/state/swapFormStores';
import { swapAmountControl } from '@/screens/SwapBridge/state/swapAmountControl';
import { tokenAmountBn } from '@/screens/SwapBridge/state/swapFormMath';

import { SwapTokenItem } from './Token';

const HAPTIC_STEPS = [0, 50, 100];

export type SwapSliderResolvedAmount = {
  amount: string;
  useGasPrice: boolean;
};

type SwapAmountCardProps = {
  disabled?: boolean;
  sceneActive?: boolean;
  token?: TokenItem;
  onTokenChange: (token: TokenItem) => void;
  account?: Account | null;
  chainId: string;
  excludeTokens?: string[];
  onValueChange: (value: string) => void;
  resolveSliderAmount: (value: number) => SwapSliderResolvedAmount | null;
};

/**
 * The only high-frequency subscriber of the amount store. Slider ticks come
 * from the scene-scoped `swapAmountControl` mutable: the thumb is UI-thread
 * driven, while the card renders the formatted text from the same source.
 */
export const SwapAmountCard = React.memo(function SwapAmountCard(
  props: SwapAmountCardProps,
) {
  const sliderValue = useValueFromSharedValue(swapAmountControl);
  const source = useSwapForm(state => state.source);
  const isDragging = useSwapForm(state => state.isDragging);
  const draft = useSwapForm(state => state.draft);
  const storeToken = useSwapForm(state => state.payToken);
  const token = storeToken ?? props.token;
  const actions = swapFormStore.getState().actions;

  const displayValue = useMemo(() => {
    if (source === 'input') {
      return draft;
    }
    return props.resolveSliderAmount(sliderValue)?.amount ?? '';
  }, [draft, props, sliderValue, source]);

  const insufficient = useMemo(() => {
    const amount = new BigNumber(displayValue || 0);
    if (!token) {
      return new BigNumber(0).lt(amount);
    }
    return tokenAmountBn(token).lt(amount);
  }, [displayValue, token]);

  const previousSliderRef = useRef(0);
  useEffect(() => {
    if (!isDragging) {
      return;
    }
    if (
      sliderValue !== previousSliderRef.current &&
      HAPTIC_STEPS.includes(sliderValue)
    ) {
      trigger('impactLight', {
        enableVibrateFallback: true,
        ignoreAndroidSystemSettings: false,
      });
    }
    previousSliderRef.current = sliderValue;
  }, [isDragging, sliderValue]);

  const handleGestureStart = useCallback(() => {
    previousSliderRef.current = sliderValue;
    actions.beginSlider();
  }, [actions, sliderValue]);

  const handleGestureComplete = useCallback(
    (value: number) => {
      const resolved = props.resolveSliderAmount(value);
      if (!resolved) {
        return;
      }
      actions.endSlider({
        draft: resolved.amount,
        isMax: value === 100,
        passGasPrice: resolved.useGasPrice,
      });
    },
    [actions, props],
  );

  return (
    <SwapTokenItem
      disabled={props.disabled}
      sceneActive={props.sceneActive}
      inSufficient={insufficient}
      slider={sliderValue}
      controlValue={swapAmountControl}
      value={displayValue}
      onValueChange={props.onValueChange}
      onGestureStart={handleGestureStart}
      onGestureComplete={handleGestureComplete}
      token={token}
      onTokenChange={props.onTokenChange}
      account={props.account}
      chainId={props.chainId}
      type={'from'}
      excludeTokens={props.excludeTokens}
    />
  );
});
