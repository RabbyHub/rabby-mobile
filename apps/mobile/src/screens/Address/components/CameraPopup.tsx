import { RcIconScannerDownArrowCC } from '@/assets/icons/address';
import { Text } from '@/components';
import { AppBottomSheetModal } from '@/components/customized/BottomSheet';
import {
  QRCodeScanner,
  QRCodeScannerProps,
} from '@/components/QRCodeScanner/QRCodeScanner';
import { useThemeColors, useThemeStyles } from '@/hooks/theme';
import { createGetStyles } from '@/utils/styles';
import { BottomSheetModal, BottomSheetView } from '@gorhom/bottom-sheet';
import React, { forwardRef } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

export const CameraPopup = forwardRef<
  BottomSheetModal,
  QRCodeScannerProps & {
    tip?: string;
  }
>(({ tip, ...props }, ref) => {
  const { colors, styles } = useThemeStyles(getStyle);
  const { t } = useTranslation();

  return (
    <AppBottomSheetModal ref={ref} snapPoints={[436]}>
      <BottomSheetView style={styles.container}>
        <View>
          <Text style={styles.title}>
            {tip || t('page.newAddress.addContacts.cameraTitle')}
          </Text>
        </View>
        <RcIconScannerDownArrowCC
          color={colors['neutral-line']}
          style={styles.icon}
        />
        <QRCodeScanner {...props} />
      </BottomSheetView>
    </AppBottomSheetModal>
  );
});

const getStyle = createGetStyles(colors => ({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    marginTop: 20,
    fontSize: 15,
    fontWeight: '500',
    color: colors['neutral-title1'],
  },
  icon: {
    marginTop: 20,
    marginBottom: 16,
    width: 28,
    height: 28,
  },
}));
