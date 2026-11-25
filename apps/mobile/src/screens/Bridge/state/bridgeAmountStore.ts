import { createStore } from 'zustand/vanilla';

import { bridgeAmountControl } from './bridgeAmountControl';

export type BridgeAmountSource = 'slider' | 'input' | 'external';

export type BridgeAmountActions = {
  beginSlider: () => void;
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
    isMax: false,
    passGasPrice: false,
    actions: {
      beginSlider: () => {
        clearCommitTimer();
        set({ source: 'slider', isDragging: true, isMax: false });
      },
      setAmountFromInput: ({ draft, slider }) => {
        clearCommitTimer();
        bridgeAmountControl.value = slider;
        set({
          draft,
          source: 'input',
          isDragging: false,
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
          isMax: false,
          passGasPrice: false,
        });
      },
      setPassGasPrice: value => set({ passGasPrice: value }),
    },
  }));
}
