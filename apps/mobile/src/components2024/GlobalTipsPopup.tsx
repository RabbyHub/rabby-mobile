import AutoLockView from '@/components/AutoLockView';
import { AppBottomSheetModal } from '@/components/customized/BottomSheet';
import { Button } from '@/components2024/Button';
import { makeBottomSheetProps } from '@/components2024/GlobalBottomSheetModal/utils-help';
import { useTheme2024 } from '@/hooks/theme';
import { useTipsPopup } from '@/hooks/useTipsPopup';
import { createGetStyles2024 } from '@/utils/styles';
import { BottomSheetView } from '@gorhom/bottom-sheet';
import React, { useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, useWindowDimensions, View } from 'react-native';

export const GlobalTipsPopup: React.FC<{}> = ({}) => {
  const modalRef = useRef<AppBottomSheetModal>(null);

  const { state, hideTipsPopup } = useTipsPopup();

  const { title, desc, visible } = state || {};

  const { styles, colors2024, isLight } = useTheme2024({
    getStyle: getStyle,
  });

  const { t } = useTranslation();

  const { height } = useWindowDimensions();
  const maxHeight = useMemo(() => {
    return height - 200;
  }, [height]);

  useEffect(() => {
    if (visible) {
      modalRef.current?.present();
    } else {
      modalRef.current?.close();
    }
  }, [visible]);

  return (
    <>
      <AppBottomSheetModal
        ref={modalRef}
        // snapPoints={snapPoints}
        {...makeBottomSheetProps({
          colors: colors2024,
          linearGradientType: 'bg1',
        })}
        onDismiss={hideTipsPopup}
        enableDynamicSizing
        maxDynamicContentSize={maxHeight}>
        <BottomSheetView style={[styles.container]}>
          <View>
            <Text style={styles.title}>{title}</Text>
          </View>
          <View style={styles.content}>
            <Text style={styles.desc}>{desc}</Text>
          </View>
          <Button
            type="primary"
            title={t('component.GlobalTipsPopup.btn')}
            onPress={hideTipsPopup}
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
