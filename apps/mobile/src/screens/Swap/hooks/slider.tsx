import BigNumber from 'bignumber.js';
import { useCallback, useEffect, useRef, useState } from 'react';
import { trigger } from 'react-native-haptic-feedback';
import { tokenAmountBn } from '../utils';
import { TokenItem } from '@rabby-wallet/rabby-api/dist/types';
import {
  type PendingSliderGesture,
  shouldReplayPendingSlider,
} from './pendingSlider';

const sliderHapticTriggerNumbers = [0, 50, 100];

export const useSwapBridgeSlider = ({
  setAmount,
  fromToken,
  handleSlider100,
  currentAmount,
}: {
  setAmount: (s: string) => void;
  handleSlider100: () => void;
  fromToken?: TokenItem;
  /** Current amount text; a manual input wins over a deferred slider gesture. */
  currentAmount?: string;
}) => {
  const [slider, setSlider] = useState<number>(0);

  const [useSlider, setUseSlider] = useState<boolean>(false);

  const [isDraggingSlider, setIsDraggingSlider] = useState<boolean>(false);

  const previousSlider = useRef<number>(0);
  /**
   * The page can be dragged before the from token (and its balance) is loaded.
   * Losing that gesture means no amount is ever set, so no quote is requested
   * even after the token arrives. Keep the last position, scoped to the token
   * it was made on, and replay it once that token's balance is available.
   */
  const pendingSliderRef = useRef<PendingSliderGesture | null>(null);
  const lastTokenKeyRef = useRef('');

  const clearPendingSlider = useCallback(() => {
    pendingSliderRef.current = null;
  }, []);

  // Invalidate on an explicit token/chain change. A hydration from "no token"
  // to the first token keeps the pending gesture (that is the intended case).
  useEffect(() => {
    const tokenKey = fromToken?.id ? `${fromToken.chain}:${fromToken.id}` : '';
    const previousKey = lastTokenKeyRef.current;
    lastTokenKeyRef.current = tokenKey;
    if (!previousKey || previousKey === tokenKey) {
      return;
    }
    pendingSliderRef.current = null;
  }, [fromToken?.chain, fromToken?.id]);

  const onChangeSlider = useCallback(
    (v: number, syncAmount?: boolean) => {
      if (!fromToken?.amount) {
        pendingSliderRef.current = {
          value: v,
          tokenId: fromToken?.id,
          chainId: fromToken?.chain,
        };
        if (syncAmount) {
          setIsDraggingSlider(false);
        }
        return;
      }

      pendingSliderRef.current = null;
      setIsDraggingSlider(true);
      setUseSlider(true);
      setSlider(v);

      if (
        v !== previousSlider.current &&
        sliderHapticTriggerNumbers.includes(v)
      ) {
        trigger('impactLight', {
          enableVibrateFallback: true,
          ignoreAndroidSystemSettings: false,
        });
      }

      if (syncAmount) {
        setIsDraggingSlider(false);
      }

      previousSlider.current = v;

      if (v === 100) {
        handleSlider100();
        return;
      }
      const newAmountBn = new BigNumber(v)
        .div(100)
        .times(tokenAmountBn(fromToken));
      const isTooSmall = newAmountBn.lt(0.0001);
      setAmount(
        isTooSmall
          ? newAmountBn.toString(10)
          : new BigNumber(newAmountBn.toFixed(4, 1)).toString(10),
      );
    },
    [fromToken, setAmount, handleSlider100],
  );

  // Replay a gesture captured before the balance was ready. A manual amount
  // typed in the meantime wins, so the deferred gesture is dropped then.
  useEffect(() => {
    const pending = pendingSliderRef.current;
    if (!pending || !fromToken?.amount) {
      return;
    }
    pendingSliderRef.current = null;
    if (!shouldReplayPendingSlider(pending, fromToken)) {
      return;
    }
    if (currentAmount) {
      return;
    }
    onChangeSlider(pending.value, true);
  }, [
    currentAmount,
    fromToken,
    fromToken?.amount,
    fromToken?.id,
    onChangeSlider,
  ]);

  return {
    slider,
    setSlider,
    useSlider,
    setUseSlider,
    isDraggingSlider,
    setIsDraggingSlider,
    onChangeSlider,
    clearPendingSlider,
  };
};
