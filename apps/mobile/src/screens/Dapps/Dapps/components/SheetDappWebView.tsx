import { useCallback, useEffect, useRef } from 'react';
import { View, Text, Dimensions, StyleSheet } from 'react-native';

import {
  BottomSheetBackdrop,
  BottomSheetBackdropProps,
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetView,
} from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import DappWebViewControl from '@/components/WebView/DappWebViewControl';
import { devLog } from '@/utils/logger';
import {
  useActiveDappView,
  useActiveDappViewSheetModalRefs,
} from '../../hooks/useDappView';
import TouchableView from '@/components/Touchable/TouchableView';
import { ScreenLayouts } from '@/constant/layout';
import ChainIconImage from '@/components/Chain/ChainIconImage';
import { useThemeColors } from '@/hooks/theme';
import { DappCardInWebViewNav } from '../../components/DappCardInWebViewNav';
import { Button } from '@/components';
import { RcIconDisconnect } from '@/assets/icons/dapp';

const renderBackdrop = (props: BottomSheetBackdropProps) => (
  <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} />
);

export default function SheetDappWebView() {
  const { activeDapp, setActiveDapp } = useActiveDappView();
  const {
    sheetModalRefs: { webviewContainerRef },
    toggleShowSheetModal,
  } = useActiveDappViewSheetModalRefs();

  const handleBottomSheetChanges = useCallback(
    (index: number) => {
      devLog('SheetDappWebView::handleBottomSheetChanges', index);
      if (index == -1) {
        toggleShowSheetModal('webviewContainerRef', false);
        setActiveDapp(null);
      }
    },
    [toggleShowSheetModal, setActiveDapp],
  );

  const { top } = useSafeAreaInsets();

  useEffect(() => {
    if (!activeDapp) {
      toggleShowSheetModal('webviewContainerRef', 'destroy');
    } else {
      toggleShowSheetModal('webviewContainerRef', true);
    }
  }, [toggleShowSheetModal, activeDapp]);

  const colors = useThemeColors();

  return (
    <BottomSheetModal
      index={1}
      backdropComponent={renderBackdrop}
      enableContentPanningGesture={false}
      name="webviewContainerRef"
      ref={webviewContainerRef}
      snapPoints={['100%', Dimensions.get('screen').height - top]}
      onChange={handleBottomSheetChanges}>
      <BottomSheetView className="px-[20] items-center justify-center">
        {activeDapp && (
          <DappWebViewControl
            dappId={activeDapp.info.id}
            bottomNavH={342}
            headerLeft={() => {
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
                    source={require('@/screens/Dapps/icons/sample-chain-icon-tp.png')}
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
                    <DappCardInWebViewNav data={activeDapp} />
                  </BottomSheetScrollView>

                  <View
                    style={{
                      // height: 179,
                      // height: 139,
                      paddingVertical: 16,
                      borderTopColor: colors['neutral-line'],
                      borderTopWidth: 1,
                      justifyContent: 'center',
                    }}>
                    <View className="flex-shrink-0">{bottomNavBar}</View>
                    <View className="flex-shrink-1 mt-[18] px-[20]">
                      <Button
                        onPress={() => {}}
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
        )}
      </BottomSheetView>
    </BottomSheetModal>
  );
}
