import { create } from 'zustand';

type AppBootstrapState = {
  couldRender: boolean;
};

const useAppBootstrapStore = create<AppBootstrapState>(() => ({
  couldRender: false,
}));

export function getAppBootstrapStateSnapshot() {
  return useAppBootstrapStore.getState();
}

export function setAppCouldRender(couldRender: boolean) {
  useAppBootstrapStore.setState({ couldRender });
}

export function useAppCouldRenderState() {
  return useAppBootstrapStore(state => state.couldRender);
}
