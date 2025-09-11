import AutoLockView from '@/components/AutoLockView';
import { AppBottomSheetModal } from '@/components/customized/BottomSheet';
import { makeBottomSheetProps } from '@/components2024/GlobalBottomSheetModal/utils-help';
import { Account } from '@/core/services/preference';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { ScrollView, useWindowDimensions, View } from 'react-native';
import { AccountSelectorPopupContent } from './AccountSelectorPopupContent';

export const AccountSelectorPopup: React.FC<{
  visible?: boolean;
  onClose?(): void;
  value?: Account | null;
  onChange?: (a: Account) => void;
  isShowSafeAddressSection?: boolean;
  isShowWatchAddressSection?: boolean;
  title?: React.ReactNode;
}> = ({
  visible,
  onClose,
  value,
  onChange,
  isShowSafeAddressSection = true,
  isShowWatchAddressSection = true,
  title,
}) => {
  const modalRef = useRef<AppBottomSheetModal>(null);

  const { styles, colors2024, isLight } = useTheme2024({
    getStyle: getModalStyle,
  });

  const { height } = useWindowDimensions();
  const maxHeight = useMemo(() => {
    return height - 200;
  }, [height]);

  const snapPoints = useMemo(() => [Math.max(maxHeight, 400)], [maxHeight]);
  const scrollViewRef = React.useRef<ScrollView>(null);
  const scrollToBottom = useCallback(() => {
    scrollViewRef.current?.scrollToEnd({ animated: true });
  }, []);

  useEffect(() => {
    if (visible) {
      modalRef.current?.present();
    } else {
      modalRef.current?.dismiss();
    }
  }, [visible]);

  return (
    <AppBottomSheetModal
      ref={modalRef}
      // snapPoints={snapPoints}
      {...makeBottomSheetProps({
        colors: colors2024,
        linearGradientType: isLight ? 'bg0' : 'bg1',
      })}
      onDismiss={onClose}
      enableDynamicSizing
      maxDynamicContentSize={maxHeight}>
      <BottomSheetScrollView ref={scrollViewRef}>
        <AutoLockView style={[styles.container]}>
          <View style={[styles.panelContainer]}>
            <AccountSelectorPopupContent
              scrollToBottom={scrollToBottom}
              value={value}
              onChange={onChange}
              isShowSafeAddressSection={isShowSafeAddressSection}
              isShowWatchAddressSection={isShowWatchAddressSection}
              title={title}
            />
          </View>
        </AutoLockView>
      </BottomSheetScrollView>
    </AppBottomSheetModal>
  );
};

const getModalStyle = createGetStyles2024(ctx => {
  return {
    handleStyle: {
      backgroundColor: ctx.isLight
        ? ctx.colors2024['neutral-bg-0']
        : ctx.colors2024['neutral-bg-1'],
      paddingTop: 10,
      height: 36,
    },
    container: {
      height: '100%',
      minHeight: 364,
      backgroundColor: ctx.isLight
        ? ctx.colors2024['neutral-bg-0']
        : ctx.colors2024['neutral-bg-1'],
    },
    panelContainer: {
      position: 'relative',
      width: '100%',
    },
  };
});
