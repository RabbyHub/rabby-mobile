import { useMemoizedFn } from 'ahooks';
import { atom, useAtom, useSetAtom } from 'jotai';
import { StyleProp, TextStyle, ViewStyle } from 'react-native';

type TipsPopupState = {
  visible: boolean;
  title: string;
  desc: string | React.ReactNode;
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

export const useShowTipsPopup = () => {
  const setState = useSetAtom(tipsAtom);

  return useMemoizedFn((payload: TipsPopupPayload) => {
    setState({
      visible: true,
      ...payload,
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
    setState({
      visible: false,
      title: '',
      desc: '',
      buttonStyle: undefined,
      buttonTitleStyle: undefined,
      buttonType: undefined,
    });
  });

  return {
    showTipsPopup,
    hideTipsPopup,
    state,
    setState,
  };
};
