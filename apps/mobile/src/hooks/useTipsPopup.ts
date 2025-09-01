import { useMemoizedFn } from 'ahooks';
import { atom, useAtom } from 'jotai';

const tipsAtom = atom({
  visible: false,
  title: '',
  desc: '',
});

export const useTipsPopup = () => {
  const [state, setState] = useAtom(tipsAtom);

  const showTipsPopup = useMemoizedFn(
    (payload: { title: string; desc: string }) => {
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
    });
  });

  return {
    showTipsPopup,
    hideTipsPopup,
    state,
    setState,
  };
};
