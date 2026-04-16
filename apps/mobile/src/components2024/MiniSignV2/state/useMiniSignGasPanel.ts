import { useMemo, useSyncExternalStore } from 'react';

import type { GasLevel } from '@rabby-wallet/rabby-api/dist/types';

import type { SignatureManager } from './SignatureManager';
import { useSignatureInstance } from './SignatureInstanceContext';

export type MiniSignGasPanelInfo = {
  externalPanelSelection: (gas: GasLevel) => void;
  handleClickEdit: () => void;
  gasCostUsdStr: string;
  gasUsdList: {
    slow: string;
    normal: string;
    fast: string;
  };
  gasIsNotEnough: {
    slow: boolean;
    normal: boolean;
    fast: boolean;
  };
  gasAccountIsNotEnough: {
    slow: [boolean, string];
    normal: [boolean, string];
    fast: [boolean, string];
  };
  gasAccountCost?: {
    total_cost: number;
    tx_cost: number;
    gas_cost: number;
    estimate_tx_cost: number;
  };
};

type MiniSignGasPanelState = {
  gasInfo?: MiniSignGasPanelInfo;
  showMoreVisible: boolean;
};

type MiniSignGasPanelListener = () => void;

class MiniSignGasPanelController {
  private state: MiniSignGasPanelState = {
    gasInfo: undefined,
    showMoreVisible: false,
  };

  private listeners = new Set<MiniSignGasPanelListener>();

  subscribe = (listener: MiniSignGasPanelListener) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getState = () => this.state;

  setGasInfo = (gasInfo: MiniSignGasPanelInfo | undefined) => {
    this.setState({ gasInfo });
  };

  setShowMoreVisible = (showMoreVisible: boolean) => {
    this.setState({ showMoreVisible });
  };

  reset = () => {
    this.setState({
      gasInfo: undefined,
      showMoreVisible: false,
    });
  };

  private setState = (partial: Partial<MiniSignGasPanelState>) => {
    const nextState = {
      ...this.state,
      ...partial,
    };

    if (
      nextState.gasInfo === this.state.gasInfo &&
      nextState.showMoreVisible === this.state.showMoreVisible
    ) {
      return;
    }

    this.state = nextState;
    this.listeners.forEach(listener => listener());
  };
}

// Keep gas panel UI state scoped to each SignatureManager instance so separate
// MiniSign portals can share the same model without falling back to a global singleton.
const controllerMap = new WeakMap<
  SignatureManager,
  MiniSignGasPanelController
>();

export const getMiniSignGasPanelController = (
  instance: SignatureManager,
): MiniSignGasPanelController => {
  let controller = controllerMap.get(instance);
  if (!controller) {
    controller = new MiniSignGasPanelController();
    controllerMap.set(instance, controller);
  }
  return controller;
};

export const useMiniSignGasPanelController = () => {
  const instance = useSignatureInstance();
  return useMemo(() => getMiniSignGasPanelController(instance), [instance]);
};

export const useMiniSignGasPanelState = <T = MiniSignGasPanelState>(
  selector?: (state: MiniSignGasPanelState) => T,
) => {
  const controller = useMiniSignGasPanelController();
  return useSyncExternalStore(
    controller.subscribe,
    selector
      ? () => selector(controller.getState())
      : (controller.getState as () => T),
  );
};
