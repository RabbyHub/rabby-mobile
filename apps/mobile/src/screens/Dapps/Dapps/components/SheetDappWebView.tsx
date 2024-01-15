import { useCallback, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';

import {
  BottomSheetBackdrop,
  BottomSheetBackdropProps,
  BottomSheetScrollView,
  BottomSheetView,
} from '@gorhom/bottom-sheet';
import { AppBottomSheetModal } from '@/components/customized/BottomSheet';

import DappWebViewControl from '@/components/WebView/DappWebViewControl';
import { devLog } from '@/utils/logger';
import { useActiveViewSheetModalRefs } from '../../hooks/useDappView';
import TouchableView from '@/components/Touchable/TouchableView';
import { ScreenLayouts } from '@/constant/layout';
import ChainIconImage from '@/components/Chain/ChainIconImage';
import { useThemeColors } from '@/hooks/theme';
import { DappCardInWebViewNav } from '../../components/DappCardInWebViewNav';
import { Button } from '@/components';
import { RcIconDisconnect } from '@/assets/icons/dapp';
import { useSafeSizes } from '@/hooks/useAppLayout';
import { useDapps } from '@/hooks/useDapps';
import { toast } from '@/components/Toast';
import clsx from 'clsx';
import { DappInfo } from '@rabby-wallet/service-dapp';

const renderBackdrop = (props: BottomSheetBackdropProps) => (
  <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} />
);

export default function SheetDappWebView({
  dapp,
  onHideModal,
}: {
  dapp: DappInfo | null;
  onHideModal?: (dapp: DappInfo | null) => void;
}) {
  const {
    sheetModalRefs: { dappWebviewContainerRef },
    toggleShowSheetModal,
  } = useActiveViewSheetModalRefs();

  const handleBottomSheetChanges = useCallback(
    (index: number) => {
      devLog('SheetDappWebView::handleBottomSheetChanges', index);
      if (index == -1) {
        toggleShowSheetModal('dappWebviewContainerRef', false);
        onHideModal?.(dapp);
      }
    },
    [toggleShowSheetModal],
  );

  useEffect(() => {
    if (!dapp) {
      toggleShowSheetModal('dappWebviewContainerRef', 'destroy');
    } else {
      toggleShowSheetModal('dappWebviewContainerRef', true);
    }
  }, [toggleShowSheetModal, dapp]);

  const colors = useThemeColors();
  const { safeOffScreenTop } = useSafeSizes();

  const { disconnectDapp, isDappConnected } = useDapps();

  const isConnected = !!dapp && isDappConnected(dapp.origin);

  if (!dapp) return null;

  return (
    <AppBottomSheetModal
      index={0}
      backdropComponent={renderBackdrop}
      enableContentPanningGesture={false}
      enablePanDownToClose
      enableHandlePanningGesture
      name="dappWebviewContainerRef"
      ref={dappWebviewContainerRef}
      snapPoints={[safeOffScreenTop]}
      onChange={handleBottomSheetChanges}>
      <BottomSheetView className="px-[20] items-center justify-center">
        <DappWebViewControl
          dappId={dapp.origin}
          bottomNavH={
            isConnected
              ? ScreenLayouts.dappWebViewNavBottomSheetHeight
              : ScreenLayouts.inConnectedDappWebViewNavBottomSheetHeight
          }
          headerLeft={() => {
            if (!isConnected) return null;

            return (
              <TouchableView
                style={[
                  {
                    height: ScreenLayouts.dappWebViewControlHeaderHeight,
                    justifyContent: 'center',
                  },
                ]}
                onPress={() => {}}>
                <ChainIconImage
                  chainEnum={dapp.chainId}
                  size={24}
                  width={24}
                  height={24}
                />
              </TouchableView>
            );
          }}
          bottomSheetContent={({ bottomNavBar }) => {
            return (
              <View>
                <BottomSheetScrollView style={{ minHeight: 108 }}>
                  <DappCardInWebViewNav data={dapp} />
                </BottomSheetScrollView>

                <View
                  style={{
                    paddingVertical: 16,
                    borderTopColor: colors['neutral-line'],
                    borderTopWidth: 1,
                    justifyContent: 'center',
                  }}>
                  <View className="flex-shrink-0">{bottomNavBar}</View>
                  <View
                    className={clsx(
                      'flex-shrink-1 mt-[18] px-[20]',
                      !isConnected && 'hidden',
                    )}>
                    <Button
                      onPress={() => {
                        disconnectDapp(dapp.origin);
                        toast.success('Disconnected');
                      }}
                      title={
                        <View className="flex-row items-center justify-center">
                          <RcIconDisconnect
                            width={20}
                            height={20}
                            className="mr-[6]"
                          />
                          <Text
                            style={{
                              color: colors['red-default'],
                              fontSize: 16,
                              fontWeight: '500',
                            }}>
                            Disconnect
                          </Text>
                        </View>
                      }
                      style={{
                        width: '100%',
                        height: '100%',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                      containerStyle={{
                        flexGrow: 1,
                        display: 'flex',
                        height: 52,
                        justifyContent: 'center',
                        alignItems: 'center',
                        borderBlockColor: colors['red-default'],
                        borderWidth: StyleSheet.hairlineWidth,
                        borderRadius: 6,
                      }}
                      titleStyle={{
                        color: colors['red-default'],
                      }}
                    />
                  </View>
                </View>
              </View>
            );
          }}
        />
      </BottomSheetView>
    </AppBottomSheetModal>
  );
}
