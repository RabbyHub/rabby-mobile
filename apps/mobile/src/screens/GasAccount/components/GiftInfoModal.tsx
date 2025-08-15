import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { View, Text, TouchableOpacity } from 'react-native';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import IconGift from '@/assets2024/icons/home/IconGift.svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppBottomSheetModal } from '@/components/customized/BottomSheet';
import { BottomSheetView } from '@gorhom/bottom-sheet';

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
        style={[styles.modalContent, { paddingBottom: bottom + 20 }]}>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 20,
    fontStyle: 'normal',
    fontWeight: '700',
    lineHeight: 24,
    color: colors2024['neutral-title-1'],
    marginLeft: 12,
  },
  description: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    fontStyle: 'normal',
    fontWeight: '400',
    lineHeight: 20,
    color: colors2024['neutral-info'],
    textAlign: 'center',
    marginBottom: 24,
  },
  gotItButton: {
    backgroundColor: colors2024['brand-default'],
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    marginTop: 30,
    marginBottom: 56,
  },
  gotItButtonText: {
    fontSize: 20,
    fontStyle: 'normal',
    fontWeight: '700',
    color: colors2024['neutral-InvertHighlight'],
  },
}));
