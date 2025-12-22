import { useMemoizedFn } from 'ahooks';
import { zCreate } from '@/core/utils/reexports';
import { UpdaterOrPartials, resolveValFromUpdater } from '@/core/utils/store';

type TipsState = {
  visible: boolean;
  title: string;
  desc: string;
};

const tipsStore = zCreate<TipsState>(() => ({
  visible: false,
  title: '',
  desc: '',
}));

function setTipsState(valOrFunc: UpdaterOrPartials<TipsState>) {
  tipsStore.setState(prev => {
    const { newVal, changed } = resolveValFromUpdater(prev, valOrFunc, {
      strict: false,
    });

    if (!changed) return prev;

    return newVal;
  });
}

export const useTipsPopup = () => {
  const state = tipsStore();

  const showTipsPopup = useMemoizedFn(
    (payload: { title: string; desc: string }) => {
      setTipsState({
        visible: true,
        ...payload,
      });
    },
  );

  const hideTipsPopup = useMemoizedFn(() => {
    setTipsState({
      visible: false,
      title: '',
      desc: '',
    });
  });

  return {
    showTipsPopup,
    hideTipsPopup,
    state,
    setState: setTipsState,
  };
};
