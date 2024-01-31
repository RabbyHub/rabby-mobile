import { useState, useEffect, useRef } from 'react';
import { View, Text } from 'react-native';

import { BottomSheetModal } from '@gorhom/bottom-sheet';
import { ConfirmBottomSheetModal } from '@/components/GlobalBottomSheetModal/ConfirmBottomSheetModal';

import { useWhitelist } from '@/hooks/whitelist';
import { useSheetModals } from '@/hooks/useSheetModal';
import { createGetStyles } from '@/utils/styles';
import { useThemeColors } from '@/hooks/theme';
import { RcIconCheckedFilledCC, RcIconUnCheckCC } from '../icons';
import TouchableView from '@/components/Touchable/TouchableView';
import ThemeIcon from '@/components/ThemeMode/ThemeIcon';

interface ConfirmAllowTransferModalProps {
  onFinished: (result: { confirmed: boolean }) => void;
  onCancel(): void;
}

export function ModalConfirmAllowTransfer({
  visible,
  onFinished,
  onCancel,
}: ConfirmAllowTransferModalProps & {
  visible: boolean;
}) {
  const modalRef = useRef<BottomSheetModal>(null);

  const colors = useThemeColors();
  const styles = getStyles(colors);

  const { toggleShowSheetModal } = useSheetModals({ modalRef });
  const [isAllowed, setIsAllowed] = useState(false);

  useEffect(() => {
    toggleShowSheetModal('modalRef', visible || 'destroy');
  }, [toggleShowSheetModal, visible]);

  return (
    <>
      <ConfirmBottomSheetModal
        ref={modalRef}
        onConfirm={() => {
          onFinished?.({ confirmed: isAllowed });
        }}
        onCancel={onCancel}
        height={279}
        confirmButtonProps={{
          type: 'primary',
        }}>
        <View style={styles.bodyContainer}>
          <Text style={styles.title}>Enter the Password to Confirm</Text>

          <TouchableView
            style={styles.confirmTextBtn}
            onPress={() => {
              setIsAllowed(prev => !prev);
            }}>
            <ThemeIcon
              src={isAllowed ? RcIconCheckedFilledCC : RcIconUnCheckCC}
              style={styles.checkboxIcon}
              color={
                isAllowed ? colors['blue-default'] : colors['neutral-title1']
              }
            />
            <Text>Add to whitelist</Text>
          </TouchableView>
        </View>
      </ConfirmBottomSheetModal>
    </>
  );
}

const getStyles = createGetStyles(colors => {
  return {
    bodyContainer: {
      height: '100%',
      alignItems: 'center',
    },
    title: {
      color: colors['neutral-title1'],
      textAlign: 'center',
      fontSize: 24,
      fontStyle: 'normal',
      fontWeight: '500',
    },
    confirmTextBtn: {
      marginTop: 24,
      flexDirection: 'row',
      position: 'relative',
      paddingLeft: 20,

      marginHorizontal: 'auto',
    },
    checkboxIcon: {
      position: 'absolute',
      top: 1,
      width: 16,
      height: 16,
    },
  };
});
