import {
  RcIconInfo2CC,
  RcIconInfoCC,
  RcIconInfoFillCC,
} from '@/assets/icons/common';
import AutoLockView from '@/components/AutoLockView';
import { AppBottomSheetModal } from '@/components/customized/BottomSheet';
import { Button } from '@/components2024/Button';
import { makeBottomSheetProps } from '@/components2024/GlobalBottomSheetModal/utils-help';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { BottomSheetTextInput } from '@gorhom/bottom-sheet';
import React, { useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';

export const PerpsWithdrawFeePopup: React.FC<{
  visible?: boolean;
  onClose?(): void;
}> = ({ visible, onClose }) => {
  const modalRef = useRef<AppBottomSheetModal>(null);

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
      modalRef.current?.dismiss();
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
        onDismiss={onClose}
        // enableDynamicSizing
        snapPoints={[262]}
        maxDynamicContentSize={maxHeight}>
        <AutoLockView style={[styles.container]}>
          <View>
            <Text style={styles.title}>
              {t('page.perps.PerpsWithdrawFeePopup.title')}
            </Text>
          </View>
          <View style={styles.content}>
            <Text style={styles.desc}>
              {t('page.perps.PerpsWithdrawFeePopup.desc')}
            </Text>
          </View>
          <Button
            type="primary"
            title={t('page.perps.PerpsWithdrawFeePopup.btn')}
            onPress={() => {}}
          />
        </AutoLockView>
      </AppBottomSheetModal>
    </>
  );
};

const getStyle = createGetStyles2024(ctx => {
  return {
    container: {
      height: '100%',
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
      fontWeight: '800',
      color: ctx.colors2024['neutral-title-1'],
      marginTop: 12,
      marginBottom: 8,
      textAlign: 'center',
    },

    content: {
      marginBottom: 50,
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
