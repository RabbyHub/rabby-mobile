import { CHAINS_ENUM } from '@debank/common';
import type { TokenItem } from '@rabby-wallet/rabby-api/dist/types';
import { createStore } from 'zustand/vanilla';

import type { PendingSliderGesture } from '@/screens/Swap/hooks/pendingSlider';
import { swapAmountControl } from './swapAmountControl';

export type SwapAmountSource = 'slider' | 'input' | 'external';

export type SwapFormActions = {
  setTokens: (input: {
    chain?: CHAINS_ENUM;
    payToken?: TokenItem;
    receiveToken?: TokenItem;
  }) => void;
  beginSlider: () => void;
  /**
   * A slider gesture made before the pay token (or its balance) is loaded is
   * remembered and replayed once that same token's balance exists. It is scoped
   * to the token it was made on so it can never be replayed onto a different
   * (possibly funded) token.
   */
  deferSlider: (pending: PendingSliderGesture) => void;
  clearPendingSlider: () => void;
  setAmountFromInput: (input: { draft: string; slider: number }) => void;
  endSlider: (input: {
    draft: string;
    isMax: boolean;
    passGasPrice?: boolean;
  }) => void;
  commitAmount: () => void;
  resetAmount: () => void;
  setSlippage: (value: string) => void;
  setPassGasPrice: (value: boolean) => void;
};

export type SwapFormState = {
  chain: CHAINS_ENUM;
  payToken?: TokenItem;
  receiveToken?: TokenItem;
  /** High-frequency display value (slider / input). */
  draft: string;
  /** Low-frequency business value (quote / fee / button / build). */
  committed: string;
  source: SwapAmountSource;
  isDragging: boolean;
  pendingSlider: PendingSliderGesture | null;
  isMax: boolean;
  slippage: string;
  passGasPrice: boolean;
  actions: SwapFormActions;
};

const INPUT_COMMIT_DELAY_MS = 300;

export function createSwapFormStore(initial?: {
  chain?: CHAINS_ENUM;
  slippage?: string;
}) {
  let commitTimer: ReturnType<typeof setTimeout> | null = null;
  const clearCommitTimer = () => {
    if (commitTimer) {
      clearTimeout(commitTimer);
      commitTimer = null;
    }
  };

  return createStore<SwapFormState>()((set, get) => ({
    chain: initial?.chain ?? CHAINS_ENUM.ETH,
    payToken: undefined,
    receiveToken: undefined,
    draft: '',
    committed: '',
    source: 'external',
    isDragging: false,
    pendingSlider: null,
    isMax: false,
    slippage: initial?.slippage ?? '0.1',
    passGasPrice: false,
    actions: {
      setTokens: input =>
        set(state => ({
          chain: input.chain ?? state.chain,
          payToken: 'payToken' in input ? input.payToken : state.payToken,
          receiveToken:
            'receiveToken' in input ? input.receiveToken : state.receiveToken,
        })),
      beginSlider: () => {
        clearCommitTimer();
        set({
          source: 'slider',
          isDragging: true,
          isMax: false,
          pendingSlider: null,
        });
      },
      deferSlider: pending => {
        clearCommitTimer();
        set({
          source: 'slider',
          isDragging: false,
          pendingSlider: pending,
        });
      },
      clearPendingSlider: () => set({ pendingSlider: null }),
      setAmountFromInput: ({ draft, slider }) => {
        clearCommitTimer();
        swapAmountControl.value = slider;
        set({
          draft,
          isMax: false,
          source: 'input',
          isDragging: false,
          pendingSlider: null,
        });
        commitTimer = setTimeout(() => {
          commitTimer = null;
          get().actions.commitAmount();
        }, INPUT_COMMIT_DELAY_MS);
      },
      endSlider: ({ draft, isMax, passGasPrice }) => {
        clearCommitTimer();
        set(state => ({
          draft,
          committed: draft,
          isMax,
          source: 'slider',
          isDragging: false,
          pendingSlider: null,
          passGasPrice: passGasPrice ?? state.passGasPrice,
        }));
      },
      commitAmount: () => {
        clearCommitTimer();
        const { draft, committed } = get();
        if (draft !== committed) {
          set({ committed: draft });
        }
      },
      resetAmount: () => {
        clearCommitTimer();
        swapAmountControl.value = 0;
        set({
          draft: '',
          committed: '',
          isMax: false,
          source: 'external',
          isDragging: false,
          pendingSlider: null,
          passGasPrice: false,
        });
      },
      setSlippage: value => set({ slippage: value }),
      setPassGasPrice: value => set({ passGasPrice: value }),
    },
  }));
}
