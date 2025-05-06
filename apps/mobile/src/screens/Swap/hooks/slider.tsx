import BigNumber from 'bignumber.js';
import { useCallback, useRef, useState } from 'react';
import { trigger } from 'react-native-haptic-feedback';
import { tokenAmountBn } from '../utils';
import { TokenItem } from '@rabby-wallet/rabby-api/dist/types';

const sliderHapticTriggerNumbers = [0, 50, 100];

export const useSwapBridgeSlider = ({
  setAmount,
  fromToken,
  handleSlider100,
}: {
  setAmount: (s: string) => void;
  handleSlider100: () => void;
  fromToken?: TokenItem;
}) => {
  const [slider, setSlider] = useState<number>(0);

  const [useSlider, setUseSlider] = useState<boolean>(false);

  const [isDraggingSlider, setIsDraggingSlider] = useState<boolean>(false);

  const previousSlider = useRef<number>(0);

  const onChangeSlider = useCallback(
    (v: number, syncAmount?: boolean) => {
      if (fromToken) {
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
      }
    },
    [fromToken, setAmount, handleSlider100],
  );

  return {
    slider,
    setSlider,
    useSlider,
    setUseSlider,
    isDraggingSlider,
    setIsDraggingSlider,
    onChangeSlider,
  };
};
