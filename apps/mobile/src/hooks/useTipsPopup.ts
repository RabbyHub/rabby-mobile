import { useMemoizedFn } from 'ahooks';
import { atom, useAtom } from 'jotai';
import { StyleProp, TextStyle, ViewStyle } from 'react-native';

type TipsPopupState = {
  visible: boolean;
  title: string;
  desc: string;
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

const tipsAtom = atom<TipsPopupState>({
  visible: false,
  title: '',
  desc: '',
});

export const useTipsPopup = () => {
  const [state, setState] = useAtom(tipsAtom);

  const showTipsPopup = useMemoizedFn(
    (payload: {
      title: string;
      desc: string;
      buttonStyle?: StyleProp<ViewStyle>;
      buttonTitleStyle?: StyleProp<TextStyle>;
      buttonType?: TipsPopupState['buttonType'];
    }) => {
      setState({
        visible: true,
        ...payload,
      });
    },
  );

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
