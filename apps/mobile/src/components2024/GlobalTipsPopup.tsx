import { AppBottomSheetModal } from '@/components/customized/BottomSheet';
import { Button } from '@/components2024/Button';
import { makeBottomSheetProps } from '@/components2024/GlobalBottomSheetModal/utils-help';
import { useTheme2024 } from '@/hooks/theme';
import { useTipsPopup } from '@/hooks/useTipsPopup';
import { createGetStyles2024 } from '@/utils/styles';
import { BottomSheetView } from '@gorhom/bottom-sheet';
import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
} from 'react';
import { useTranslation } from 'react-i18next';
import { useWindowDimensions, View } from 'react-native';
import { Text } from '@/components/Typography';

export const GlobalTipsPopup: React.FC<{}> = ({}) => {
  const modalRef = useRef<AppBottomSheetModal>(null);

  const { state, hideTipsPopup, hideTipsPopupIfCurrent } = useTipsPopup();
  const retainedRef = useRef<typeof state | null>(null);
  const closingRef = useRef<typeof state | null>(null);
  const [dismissalCount, finishDismissal] = useReducer(count => count + 1, 0);
  const { visible } = state;

  // The atom still clears immediately on close (including owner visibility).
  // Only opted-in presentations survive until the native sheet is unmounted.
  const presentation =
    closingRef.current ?? (visible ? state : retainedRef.current ?? state);

  useLayoutEffect(() => {
    if (closingRef.current) {
      return;
    }
    if (visible) {
      retainedRef.current = state.retainContentOnClose ? state : null;
    } else if (retainedRef.current) {
      closingRef.current = retainedRef.current;
    }
  }, [dismissalCount, state, visible]);

  const handleAnimate = useCallback((_fromIndex: number, toIndex: number) => {
    if (toIndex === -1 && retainedRef.current) {
      closingRef.current = retainedRef.current;
    }
  }, []);

  const handleDismiss = useCallback(() => {
    const dismissed = closingRef.current ?? retainedRef.current;
    if (!dismissed) {
      hideTipsPopup();
      return;
    }
    closingRef.current = null;
    retainedRef.current = null;
    // A newer popup may have arrived during the closing animation.
    hideTipsPopupIfCurrent(dismissed);
    finishDismissal();
  }, [hideTipsPopup, hideTipsPopupIfCurrent]);

  const {
    title,
    desc,
    buttonStyle,
    buttonTitleStyle,
    buttonType,
    buttonTitle,
    bgType,
    enablePanDownToClose,
  } = presentation;

  const { styles, colors2024 } = useTheme2024({
    getStyle: getStyle,
  });

  const { t } = useTranslation();

  const { height } = useWindowDimensions();
  const maxHeight = useMemo(() => {
    return height - 200;
  }, [height]);

  useEffect(() => {
    if (visible) {
      if (!closingRef.current) {
        modalRef.current?.present();
      }
    } else {
      modalRef.current?.close();
    }
  }, [dismissalCount, visible]);

  return (
    <>
      <AppBottomSheetModal
        ref={modalRef}
        // snapPoints={snapPoints}
        {...makeBottomSheetProps({
          colors: colors2024,
          linearGradientType: bgType || 'bg1',
        })}
        onAnimate={handleAnimate}
        onDismiss={handleDismiss}
        enablePanDownToClose={enablePanDownToClose}
        enableDynamicSizing
        maxDynamicContentSize={maxHeight}>
        <BottomSheetView
          style={[styles.container, bgType === 'bg0' && styles.containerBg0]}>
          <View>
            <Text style={styles.title}>{title}</Text>
          </View>
          <View style={styles.content}>
            {typeof desc === 'string' ? (
              <Text style={styles.desc}>{desc}</Text>
            ) : (
              desc
            )}
          </View>
          <Button
            type={buttonType || 'primary'}
            title={buttonTitle ?? t('component.GlobalTipsPopup.btn')}
            onPress={
              presentation.retainContentOnClose
                ? () => hideTipsPopupIfCurrent(presentation)
                : hideTipsPopup
            }
            buttonStyle={buttonStyle}
            titleStyle={buttonTitleStyle}
          />
        </BottomSheetView>
      </AppBottomSheetModal>
    </>
  );
};

const getStyle = createGetStyles2024(ctx => {
  return {
    container: {
      backgroundColor: ctx.colors2024['neutral-bg-1'],
      paddingBottom: 56,
      paddingHorizontal: 20,
      display: 'flex',
      flexDirection: 'column',
    },

    containerBg0: {
      backgroundColor: ctx.colors2024['neutral-bg-0'],
    },

    title: {
      fontFamily: 'SF Pro Rounded',
      fontSize: 20,
      lineHeight: 24,
      fontWeight: '900',
      color: ctx.colors2024['neutral-title-1'],
      marginTop: 12,
      marginBottom: 8,
      textAlign: 'center',
    },

    content: {
      minHeight: 40,
      marginBottom: 30,
    },

    desc: {
      fontSize: 16,
      lineHeight: 20,
      fontWeight: '400',
      fontFamily: 'SF Pro Rounded',
      color: ctx.colors2024['neutral-secondary'],
      textAlign: 'center',
    },
  };
});
