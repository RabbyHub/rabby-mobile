import { useMemoizedFn } from 'ahooks';
import { atom, useAtom, useSetAtom } from 'jotai';
import { StyleProp, TextStyle, ViewStyle } from 'react-native';

type TipsPopupState = {
  visible: boolean;
  title: string;
  desc: string | React.ReactNode;
  owner?: string;
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
