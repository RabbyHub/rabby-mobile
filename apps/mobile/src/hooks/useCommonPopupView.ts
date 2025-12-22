import { MODAL_NAMES } from '@/components/GlobalBottomSheetModal/types';
import {
  createGlobalBottomSheetModal,
  removeGlobalBottomSheetModal,
} from '@/components/GlobalBottomSheetModal';
import { zCreate } from '@/core/utils/reexports';
import { UpdaterOrPartials, resolveValFromUpdater } from '@/core/utils/store';

export type CommonPopupComponentName = keyof typeof MODAL_NAMES;

type CommonPopupViewState = {
  title: React.ReactNode;
  height: number;
  account:
    | {
        address: string;
        brandName: string;
        realBrandName?: string;
        chainId?: number;
      }
    | undefined;
  data: any;
  visible: boolean;
  componentName: CommonPopupComponentName | undefined | false;
  id: string | undefined;
};

const commonPopupViewStore = zCreate<CommonPopupViewState>(() => ({
  title: 'Sign',
  height: 360,
  account: undefined,
  data: undefined,
  visible: false,
  componentName: false,
  id: undefined,
}));

function setCommonPopupViewState(
  valOrFunc: UpdaterOrPartials<CommonPopupViewState>,
) {
  commonPopupViewStore.setState(prev => {
    const { newVal } = resolveValFromUpdater(prev, valOrFunc, {
      strict: false,
    });
    return newVal;
  });
}

const setComponentName = (
  valOrFunc: UpdaterOrPartials<CommonPopupComponentName | undefined | false>,
) => {
  setCommonPopupViewState(prev => {
    const { newVal } = resolveValFromUpdater(prev.componentName, valOrFunc, {
      strict: false,
    });
    return { ...prev, componentName: newVal };
  });
};

const setVisible = (valOrFunc: UpdaterOrPartials<boolean>) => {
  setCommonPopupViewState(prev => {
    const { newVal } = resolveValFromUpdater(prev.visible, valOrFunc, {
      strict: false,
    });
    return { ...prev, visible: newVal };
  });
};

const setTitle = (valOrFunc: UpdaterOrPartials<React.ReactNode>) => {
  setCommonPopupViewState(prev => {
    const { newVal } = resolveValFromUpdater(prev.title, valOrFunc, {
      strict: false,
    });
    return { ...prev, title: newVal };
  });
};

const setHeight = (valOrFunc: UpdaterOrPartials<number>) => {
  setCommonPopupViewState(prev => {
    const { newVal } = resolveValFromUpdater(prev.height, valOrFunc, {
      strict: false,
    });
    return { ...prev, height: newVal };
  });
};

const setAccount = (
  valOrFunc: UpdaterOrPartials<CommonPopupViewState['account']>,
) => {
  setCommonPopupViewState(prev => {
    const { newVal } = resolveValFromUpdater(prev.account, valOrFunc, {
      strict: false,
    });
    return { ...prev, account: newVal };
  });
};

const setData = (valOrFunc: UpdaterOrPartials<any>) => {
  setCommonPopupViewState(prev => {
    const { newVal } = resolveValFromUpdater(prev.data, valOrFunc, {
      strict: false,
    });
    return { ...prev, data: newVal };
  });
};

const setId = (valOrFunc: UpdaterOrPartials<string | undefined>) => {
  setCommonPopupViewState(prev => {
    const { newVal } = resolveValFromUpdater(prev.id, valOrFunc, {
      strict: false,
    });
    return { ...prev, id: newVal };
  });
};

export const useCommonPopupView = () => {
  const commonPopupState = commonPopupViewStore();

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

    if (commonPopupState.componentName) {
      removeGlobalBottomSheetModal(commonPopupState.id);
    }

    setComponentName(undefined);
  };

  const activeApprovalPopup = () => {
    if (
      commonPopupState.componentName === 'APPROVAL' &&
      commonPopupState.visible === false
    ) {
      setVisible(true);
      return true;
    }
    return false;
  };

  return {
    visible: commonPopupState.visible,
    setVisible,
    closePopup,
    componentName: commonPopupState.componentName,
    activePopup,
    title: commonPopupState.title,
    setTitle,
    height: commonPopupState.height,
    setHeight,
    account: commonPopupState.account,
    setAccount,
    activeApprovalPopup,
    data: commonPopupState.data,
    setData,
  };
};
