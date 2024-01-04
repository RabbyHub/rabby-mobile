import { MODAL_NAMES } from '@/components/GlobalBottomSheetModal/types';
import {
  createGlobalBottomSheetModal,
  removeGlobalBottomSheetModal,
} from '@/components/GlobalBottomSheetModal/utils';
import { atom, useAtom } from 'jotai';

export type CommonPopupComponentName = keyof typeof MODAL_NAMES;

const titleAtom = atom<React.ReactNode>('Sign');
const heightAtom = atom<number>(360);
const accountAtom = atom<
  | {
      address: string;
      brandName: string;
      realBrandName?: string;
      chainId?: number;
    }
  | undefined
>(undefined);
const dataAtom = atom<any>(undefined);
const visibleAtom = atom<boolean>(false);
const componentNameAtom = atom<CommonPopupComponentName | undefined | false>(
  false,
);

export const useCommonPopupView = () => {
  const [componentName, setComponentName] = useAtom(componentNameAtom);
  const [visible, setVisible] = useAtom(visibleAtom);
  const [title, setTitle] = useAtom(titleAtom);
  const [height, setHeight] = useAtom(heightAtom);
  const [account, setAccount] = useAtom(accountAtom);
  const [data, setData] = useAtom(dataAtom);

  const activePopup = (name: CommonPopupComponentName) => {
    setComponentName(name);
    setVisible(true);

    createGlobalBottomSheetModal({
      name: MODAL_NAMES[name],
    });
  };

  const closePopup = () => {
    setVisible(false);

    if (componentName) {
      removeGlobalBottomSheetModal(MODAL_NAMES[componentName]);
    }

    setComponentName(undefined);
  };

  const activeApprovalPopup = () => {
    if (componentName === 'APPROVAL' && visible === false) {
      setVisible(true);
      return true;
    }
    return false;
  };

  return {
    visible,
    setVisible,
    closePopup,
    componentName,
    activePopup,
    title,
    setTitle,
    height,
    setHeight,
    account,
    setAccount,
    activeApprovalPopup,
    data,
    setData,
  };
};
