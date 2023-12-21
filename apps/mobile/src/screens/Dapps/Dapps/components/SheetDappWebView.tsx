import { useCallback, useEffect, useRef } from 'react';
import { View, Text, Dimensions, StyleSheet } from 'react-native';

import { DappInfo } from '@rabby-wallet/service-dapp';

import {
  BottomSheetBackdrop,
  BottomSheetBackdropProps,
  BottomSheetModal,
  BottomSheetView,
} from '@gorhom/bottom-sheet';
import DappWebViewControl from '@/components/WebView/DappWebViewControl';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { devLog } from '@/utils/logger';
import { useSheetModals } from '@/hooks/useSheetModal';
import { useActiveDappView } from '../../hooks/useDappView';

// const openedDappModalsAtom = atom<DappBottomSheetModalRefs>({});

const renderBackdrop = (props: BottomSheetBackdropProps) => (
  <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} />
);

export default function SheetDappWebView() {
  const { activeDapp, setActiveDapp } = useActiveDappView();
  const {
    sheetModalRefs: { webviewRef },
    toggleShowSheetModal,
  } = useSheetModals({
    webviewRef: useRef<BottomSheetModal>(null),
  });

  const handleSheetChanges = useCallback(
    (index: number) => {
      devLog('SheetDappWebView::handleSheetChanges', index);
      if (index === -1) {
        toggleShowSheetModal('webviewRef', false);
        setActiveDapp(null);
      }
    },
    [toggleShowSheetModal, setActiveDapp],
  );

  const { top } = useSafeAreaInsets();

  useEffect(() => {
    if (!activeDapp) {
      webviewRef?.current?.dismiss();
    } else {
      webviewRef?.current?.present();
    }

    return () => {
      webviewRef?.current?.dismiss();
    };
  }, [webviewRef, activeDapp]);

  return (
    <BottomSheetModal
      backdropComponent={renderBackdrop}
      enableContentPanningGesture={false}
      ref={webviewRef}
      snapPoints={[Dimensions.get('screen').height - top]}
      onChange={handleSheetChanges}>
      <BottomSheetView className="px-[20] items-center justify-center">
        <View className="w-[100%]">
          {activeDapp && <DappWebViewControl dappId={activeDapp.info.id} />}
        </View>
      </BottomSheetView>
    </BottomSheetModal>
  );
}
