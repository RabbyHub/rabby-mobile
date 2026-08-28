import { useMemoizedFn } from 'ahooks';
import { atom, useAtom, useAtomValue, useSetAtom } from 'jotai';
import { selectAtom } from 'jotai/utils';
import { useMemo } from 'react';
import { StyleProp, TextStyle, ViewStyle } from 'react-native';

type TipsPopupState = {
  visible: boolean;
  title: string;
  desc: string | React.ReactNode;
  owner?: string;
  /** Opts this popup into the bottom sheet's pan-down dismissal gesture. */
  enablePanDownToClose?: boolean;
  /** Sheet background; defaults to 'bg1'. */
  bgType?: 'bg0' | 'bg1';
  buttonStyle?: StyleProp<ViewStyle>;
  buttonTitleStyle?: StyleProp<TextStyle>;
  buttonType?:
    | 'primary'
    | 'ghost'
    | 'success'
    | 'danger'
    | 'warning'
    | 'hyperliquid'
    | 'hyperliquid-light'
    | 'aave';
};

export type TipsPopupPayload = Omit<TipsPopupState, 'visible'>;

const tipsAtom = atom<TipsPopupState>({
  visible: false,
  title: '',
  desc: '',
});

const getHiddenTipsPopupState = (): TipsPopupState => ({
  visible: false,
  title: '',
  desc: '',
});

export const useShowTipsPopup = () => {
  const setState = useSetAtom(tipsAtom);

  return useMemoizedFn((payload: TipsPopupPayload) => {
    setState({
      visible: true,
      ...payload,
    });
  });
};

export const useHideTipsPopup = (owner?: string) => {
  const setState = useSetAtom(tipsAtom);

  return useMemoizedFn(() => {
    setState(current => {
      if (owner && current.owner !== owner) {
        return current;
      }
      return getHiddenTipsPopupState();
    });
  });
};

export const useIsTipsPopupVisible = (owner: string) => {
  const ownedVisibilityAtom = useMemo(
    () => selectAtom(tipsAtom, state => state.visible && state.owner === owner),
    [owner],
  );
  return useAtomValue(ownedVisibilityAtom);
};

export const useTipsPopup = () => {
  const [state, setState] = useAtom(tipsAtom);

  const showTipsPopup = useMemoizedFn((payload: TipsPopupPayload) => {
    setState({
      visible: true,
      ...payload,
    });
  });

  const hideTipsPopup = useMemoizedFn(() => {
    setState(getHiddenTipsPopupState());
  });

  return {
    showTipsPopup,
    hideTipsPopup,
    state,
    setState,
  };
};
