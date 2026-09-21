import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { TouchableOpacity } from 'react-native';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppBottomSheetModal } from '@/components/customized/BottomSheet';
import { BottomSheetView } from '@gorhom/bottom-sheet';
import { Text } from '@/components/Typography';
import {
  BOTTOM_BUTTON_SINGLE_HEIGHT,
  BOTTOM_BUTTON_TEXT_SIZE,
  getBottomButtonBottomOffset,
} from '@/constant/layout';

export const GiftInfoModal = ({
  visible,
  onClose,
  header,
  description,
  buttonText,
  snapPoints,
}: {
  visible: boolean;
  onClose: () => void;
  header?: React.ReactNode;
  description?: React.ReactNode;
  buttonText?: string;
  snapPoints?: number[] | string[];
}) => {
  const { styles } = useTheme2024({ getStyle: getStyles });
  const { t } = useTranslation();
  const { bottom } = useSafeAreaInsets();
  const modalRef = useRef<AppBottomSheetModal>(null);

  useEffect(() => {
    if (!visible) {
      modalRef.current?.close();
    } else {
      modalRef.current?.present();
    }
  }, [visible]);

  return (
    <AppBottomSheetModal
      ref={modalRef}
      snapPoints={snapPoints || ['30%']}
      enablePanDownToClose={true}
      onDismiss={onClose}
      enableDynamicSizing={false}>
      <BottomSheetView
        style={[
          styles.modalContent,
          { paddingBottom: getBottomButtonBottomOffset(bottom) },
        ]}>
        {header}
        {description}
        <TouchableOpacity
          style={styles.gotItButton}
          onPress={onClose}
          activeOpacity={0.8}>
          <Text style={styles.gotItButtonText}>
            {buttonText || t('component.gasAccount.giftInfo.gotIt')}
          </Text>
        </TouchableOpacity>
      </BottomSheetView>
    </AppBottomSheetModal>
  );
};

const getStyles = createGetStyles2024(({ colors2024 }) => ({
  modalContent: {
    backgroundColor: colors2024['neutral-bg-1'],
    padding: 24,
    alignItems: 'center',
  },
  gotItButton: {
    backgroundColor: colors2024['brand-default'],
    borderRadius: 12,
    height: BOTTOM_BUTTON_SINGLE_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    marginTop: 30,
  },
  gotItButtonText: {
    fontSize: BOTTOM_BUTTON_TEXT_SIZE,
    fontStyle: 'normal',
    fontWeight: '700',
    color: colors2024['neutral-InvertHighlight'],
  },
}));
