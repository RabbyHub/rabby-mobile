import React, {
  forwardRef,
  useCallback,
  useContext,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { Keyboard, useWindowDimensions, View } from 'react-native';
import { NavigationContext } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppBottomSheetModal } from '@/components/customized/BottomSheet';
import { makeBottomSheetProps } from '@/components2024/GlobalBottomSheetModal/utils-help';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { getPerpsProMarketSelectorSnapPoint } from '@/screens/PerpsPro/model/layout';
import { getPerpsProBottomSheetChromeStyles } from '@/screens/PerpsPro/components/common/perpsProVisual';
import { PerpsSearchPanel } from '@/screens/PerpsSearch/components/PerpsSearchPanel';

export type PerpsMarketSelectorSheetHandle = {
  present: () => void;
};

/** Simple market picker in the Pro selector's sheet frame and height; the
 * Simple search panel keeps its data and categories.
 */
export const PerpsMarketSelectorSheet = forwardRef<
  PerpsMarketSelectorSheetHandle,
  {
    currentMarket: string;
    onSelect: (coin: string) => void;
  }
>(({ currentMarket, onSelect }, ref) => {
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const modalRef = useRef<AppBottomSheetModal>(null);
  // The sheet portals outside NavigationContainer; forward the screen's
  // navigation so focus-aware hooks in the panel keep working.
  const navigation = useContext(NavigationContext);
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  // Freeze the height while open so the keyboard cannot resize the sheet.
  const [windowHeight, setWindowHeight] = useState(height);
  const pendingMarketRef = useRef<string | null>(null);

  useImperativeHandle(
    ref,
    () => ({
      present: () => {
        pendingMarketRef.current = null;
        setWindowHeight(height);
        modalRef.current?.present();
      },
    }),
    [height],
  );

  const handleSelect = useCallback(
    (coin: string) => {
      Keyboard.dismiss();
      pendingMarketRef.current = coin === currentMarket ? null : coin;
      modalRef.current?.dismiss();
    },
    [currentMarket],
  );

  // Replace the screen only after the sheet has left.
  const handleDismiss = useCallback(() => {
    const coin = pendingMarketRef.current;
    pendingMarketRef.current = null;
    if (coin) {
      onSelect(coin);
    }
  }, [onSelect]);

  return (
    <AppBottomSheetModal
      android_keyboardInputMode="adjustPan"
      enableContentPanningGesture={false}
      enableDynamicSizing={false}
      enablePanDownToClose
      onDismiss={handleDismiss}
      ref={modalRef}
      snapPoints={[
        getPerpsProMarketSelectorSnapPoint({
          topInset: insets.top,
          windowHeight,
        }),
      ]}
      {...makeBottomSheetProps({
        colors: colors2024,
        linearGradientType: 'bg1',
      })}
      backgroundStyle={styles.background}
      handleIndicatorStyle={styles.handleIndicator}
      handleStyle={styles.handle}
      style={styles.modal}>
      <NavigationContext.Provider value={navigation}>
        <View style={styles.content} testID="perps-market-selector-sheet">
          <PerpsSearchPanel
            initialTab="topVolume"
            onSelect={handleSelect}
            style={styles.search}
          />
        </View>
      </NavigationContext.Provider>
    </AppBottomSheetModal>
  );
});

PerpsMarketSelectorSheet.displayName = 'PerpsMarketSelectorSheet';

// Same chrome as the Pro market selector.
const getStyle = createGetStyles2024(({ colors2024 }) => {
  const chrome = getPerpsProBottomSheetChromeStyles(colors2024);
  return {
    ...chrome,
    handle: { ...chrome.handle, paddingTop: 10, paddingBottom: 24 },
    handleIndicator: {
      ...chrome.handleIndicator,
      width: 50,
      height: 6,
      borderRadius: 3,
      borderCurve: 'continuous',
    },
    content: { flex: 1 },
    search: { paddingTop: 0, paddingLeft: 20 },
  };
});
