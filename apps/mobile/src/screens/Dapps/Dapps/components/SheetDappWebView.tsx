import { View, Text, StyleSheet, StyleProp, ViewStyle } from 'react-native';

import { BottomSheetScrollView } from '@gorhom/bottom-sheet';

import DappWebViewControl from '@/components/WebView/DappWebViewControl';
import { OpenedDappItem } from '../../hooks/useDappView';
import TouchableView from '@/components/Touchable/TouchableView';
import { ScreenLayouts } from '@/constant/layout';
import ChainIconImage from '@/components/Chain/ChainIconImage';
import { useThemeColors } from '@/hooks/theme';
import { DappCardInWebViewNav } from '../../components/DappCardInWebViewNav';
import { Button } from '@/components';
import { RcIconDisconnect } from '@/assets/icons/dapp';
import { useDapps } from '@/hooks/useDapps';
import { toast } from '@/components/Toast';
import clsx from 'clsx';

export default function SheetDappWebViewInner({
  dapp,
  style,
}: {
  dapp: OpenedDappItem | null;
  style: StyleProp<ViewStyle>;
}) {
  const colors = useThemeColors();

  const { disconnectDapp, isDappConnected } = useDapps();

  const isConnected = !!dapp && isDappConnected(dapp.origin);

  if (!dapp) return null;

  // // leave here for debug
  // useEffect(() => {
  //   return () => {
  //     console.log('SheetDappWebViewInner:: unmount', dapp);
  //   }
  // }, []);

  return (
    <DappWebViewControl
      style={style}
      dappOrigin={dapp.origin}
      initialUrl={dapp.$openParams?.initialUrl}
      bottomNavH={
        isConnected
          ? ScreenLayouts.dappWebViewNavBottomSheetHeight
          : ScreenLayouts.inConnectedDappWebViewNavBottomSheetHeight
      }
      headerLeft={() => {
        if (!isConnected) return null;
        if (!dapp.maybeDappInfo?.chainId) return null;

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
              chainEnum={dapp.maybeDappInfo?.chainId}
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
            {dapp?.maybeDappInfo && (
              <BottomSheetScrollView style={{ minHeight: 108 }}>
                <DappCardInWebViewNav data={dapp.maybeDappInfo} />
              </BottomSheetScrollView>
            )}

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
  );
}
