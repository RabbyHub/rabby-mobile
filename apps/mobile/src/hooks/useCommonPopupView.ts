import { MODAL_NAMES } from '@/components/GlobalBottomSheetModal/types';
import {
  createGlobalBottomSheetModal,
  removeGlobalBottomSheetModal,
} from '@/components/GlobalBottomSheetModal';
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
const idAtom = atom<string | undefined>(undefined);

export const useCommonPopupView = () => {
  const [componentName, setComponentName] = useAtom(componentNameAtom);
  const [visible, setVisible] = useAtom(visibleAtom);
  const [title, setTitle] = useAtom(titleAtom);
  const [height, setHeight] = useAtom(heightAtom);
  const [account, setAccount] = useAtom(accountAtom);
  const [data, setData] = useAtom(dataAtom);
  const [id, setId] = useAtom(idAtom);

  const activePopup = (name: CommonPopupComponentName) => {
    setComponentName(name);
    setVisible(true);

    setId(
      createGlobalBottomSheetModal({
        name: MODAL_NAMES[name],
      }),
    );
  };

  const closePopup = () => {
    setVisible(false);

    if (componentName) {
      removeGlobalBottomSheetModal(id);
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
