import { createStore } from 'zustand/vanilla';

import { bridgeAmountControl } from './bridgeAmountControl';

export type BridgeAmountSource = 'slider' | 'input' | 'external';

export type BridgeAmountActions = {
  beginSlider: () => void;
  /**
   * A slider gesture finished before the from token (balance) was ready: keep
   * the position and replay the commit once the token arrives. Without this the
   * gesture is simply lost and never turns into a quote.
   */
  deferSlider: (value: number) => void;
  setAmountFromInput: (input: { draft: string; slider: number }) => void;
  endSlider: (input: {
    draft: string;
    isMax: boolean;
    passGasPrice?: boolean;
  }) => void;
  commitAmount: () => void;
  resetAmount: () => void;
  setPassGasPrice: (value: boolean) => void;
};

export type BridgeAmountState = {
  draft: string;
  committed: string;
  source: BridgeAmountSource;
  isDragging: boolean;
  /** Slider position waiting for the from token to become available. */
  pendingSlider: number | null;
  isMax: boolean;
  passGasPrice: boolean;
  actions: BridgeAmountActions;
};

const INPUT_COMMIT_DELAY_MS = 300;

export function createBridgeAmountStore() {
  let commitTimer: ReturnType<typeof setTimeout> | null = null;
  const clearCommitTimer = () => {
    if (commitTimer) {
      clearTimeout(commitTimer);
      commitTimer = null;
    }
  };

  return createStore<BridgeAmountState>()((set, get) => ({
    draft: '',
    committed: '',
    source: 'external',
    isDragging: false,
    pendingSlider: null,
    isMax: false,
    passGasPrice: false,
    actions: {
      beginSlider: () => {
        clearCommitTimer();
        set({
          source: 'slider',
          isDragging: true,
          isMax: false,
          pendingSlider: null,
        });
      },
      deferSlider: (value: number) => {
        clearCommitTimer();
        set({
          source: 'slider',
          isDragging: false,
          pendingSlider: value,
        });
      },
      setAmountFromInput: ({ draft, slider }) => {
        clearCommitTimer();
        bridgeAmountControl.value = slider;
        set({
          draft,
          source: 'input',
          isDragging: false,
          pendingSlider: null,
          isMax: false,
          passGasPrice: false,
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
          source: 'slider',
          isDragging: false,
          pendingSlider: null,
          isMax,
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
        bridgeAmountControl.value = 0;
        set({
          draft: '',
          committed: '',
          source: 'external',
          isDragging: false,
          pendingSlider: null,
          isMax: false,
          passGasPrice: false,
        });
      },
      setPassGasPrice: value => set({ passGasPrice: value }),
    },
  }));
}
