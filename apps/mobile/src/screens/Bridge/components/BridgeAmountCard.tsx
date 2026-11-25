import BigNumber from 'bignumber.js';
import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import type { TokenItem } from '@rabby-wallet/rabby-api/dist/types';
import { trigger } from 'react-native-haptic-feedback';

import type { Account } from '@/core/startupServices/preference';
import { useValueFromSharedValue } from '@/hooks/reanimated';
import type { TokenItemMaybeWithOwner } from '@/databases/hooks/token';
import { CHAINS_ENUM } from '@debank/common';
import {
  bridgeAmountStore,
  useBridgeAmount,
} from '../state/bridgeAmountStores';
import { bridgeAmountControl } from '../state/bridgeAmountControl';
import { tokenAmountBn } from '@/screens/SwapBridge/state/swapFormMath';
import type { SwapSliderResolvedAmount } from '@/screens/Swap/components/SwapAmountCard';

import BridgeToken from './BridgeToken';

const HAPTIC_STEPS = [0, 50, 100];

type BridgeAmountCardProps = {
  sceneActive?: boolean;
  disabled?: boolean;
  account: Account | null;
  chain?: CHAINS_ENUM;
  token?: TokenItemMaybeWithOwner;
  isMaxRef?: React.MutableRefObject<boolean>;
  clickMaxBtnCount?: number;
  handleMax: () => void;
  onSliderScrollEnabledChange?: (enabled: boolean) => void;
  onChangeToken: (token: TokenItemMaybeWithOwner) => void;
  onChangeChain: (chain: CHAINS_ENUM) => void;
  value: string;
  onInputChange: (value: string) => void;
  excludeChains?: CHAINS_ENUM[];
  resolveSliderAmount: (value: number) => SwapSliderResolvedAmount | null;
};

export const BridgeAmountCard = React.memo(function BridgeAmountCard(
  props: BridgeAmountCardProps,
) {
  const sliderValue = useValueFromSharedValue(bridgeAmountControl);
  const source = useBridgeAmount(state => state.source);
  const isDragging = useBridgeAmount(state => state.isDragging);
  const draft = useBridgeAmount(state => state.draft);
  const actions = bridgeAmountStore.getState().actions;

  const displayValue = useMemo(() => {
    if (source === 'input') {
      return draft;
    }
    return props.resolveSliderAmount(sliderValue)?.amount ?? '';
  }, [draft, props, sliderValue, source]);

  const insufficient = useMemo(() => {
    const amount = new BigNumber(displayValue || 0);
    if (!props.token) {
      return new BigNumber(0).lt(amount);
    }
    return tokenAmountBn(props.token).lt(amount);
  }, [displayValue, props.token]);

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
    <BridgeToken
      type={'from'}
      sceneActive={props.sceneActive}
      disabled={props.disabled}
      account={props.account}
      chain={props.chain}
      token={props.token}
      isMaxRef={props.isMaxRef}
      clickMaxBtnCount={props.clickMaxBtnCount}
      handleMax={props.handleMax}
      onSliderScrollEnabledChange={props.onSliderScrollEnabledChange}
      onChangeToken={props.onChangeToken}
      onChangeChain={props.onChangeChain}
      value={displayValue}
      onInputChange={props.onInputChange}
      excludeChains={props.excludeChains}
      inSufficient={insufficient}
      slider={sliderValue}
      controlValue={bridgeAmountControl}
      onGestureStart={handleGestureStart}
      onGestureComplete={handleGestureComplete}
    />
  );
});
